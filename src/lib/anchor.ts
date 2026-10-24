/* Text anchoring for highlights.
 *
 * Ported from KnowML's anchor.js, whose header records why it looks like this:
 * the first version searched one text node at a time and wrapped with
 * Range.surroundContents(). Both break the moment a selection crosses an inline
 * element, because the phrase exists in no single text node and
 * surroundContents() throws on a partially-selected element. Highlights were
 * saved and then silently never painted — and nearly every paragraph here
 * carries a <strong>, a <code> or a Shiki token span.
 *
 * So: flatten the content into one string, anchor on character offsets into it,
 * and paint by wrapping each text node the range touches separately. A
 * highlight over "the **listpack** encoding" becomes three <mark>s and reads as
 * one band.
 *
 * Offsets are stored alongside the selected text. On restore the offsets are
 * tried first and validated against that text; if the page shifted under them,
 * it falls back to the Nth occurrence of the text itself.
 */

export interface Anchor {
  text: string;
  /** index of this phrase among identical ones, used when offsets go stale */
  occurrence: number;
  start: number;
  end: number;
}

interface Indexed {
  nodes: { node: Text; start: number; end: number }[];
  text: string;
}

/* Elements whose text must not be indexed. KaTeX emits every equation twice —
   visible HTML plus a hidden MathML tree — and indexing both would double every
   offset past the first equation. The line-number gutter Shiki can emit is the
   same problem in miniature. */
const SKIP = "script,style,.katex-mathml,[data-line-numbers-gutter]";

function index(root: HTMLElement): Indexed {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
      const parent = (n as Text).parentElement;
      if (parent && parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Indexed["nodes"] = [];
  let text = "";
  let n: Node | null;
  while ((n = walk.nextNode())) {
    const t = n as Text;
    nodes.push({ node: t, start: text.length, end: text.length + t.nodeValue!.length });
    text += t.nodeValue;
  }
  return { nodes, text };
}

/** A Range boundary is either (textNode, charOffset) or (element, childIndex). */
function boundary(idx: Indexed, container: Node, offset: number, atEnd: boolean): number {
  if (container.nodeType === Node.TEXT_NODE) {
    for (const rec of idx.nodes) if (rec.node === container) return rec.start + offset;
    return -1;
  }
  const child = container.childNodes[offset];
  if (child) {
    for (const rec of idx.nodes) {
      if (child === rec.node || child.contains(rec.node)) return rec.start;
    }
  }
  /* offset points past the last child, or at a subtree with no indexed text:
     fall back to the edge of whatever text the container does hold */
  let first = -1;
  let last = -1;
  for (const rec of idx.nodes) {
    if (container.contains(rec.node)) {
      if (first < 0) first = rec.start;
      last = rec.end;
    }
  }
  return atEnd ? last : first;
}

/** A live selection Range, in flattened-content coordinates. */
export function rangeToOffsets(root: HTMLElement, range: Range) {
  const idx = index(root);
  const s = boundary(idx, range.startContainer, range.startOffset, false);
  const e = boundary(idx, range.endContainer, range.endOffset, true);
  if (s < 0 || e < 0 || e <= s) return null;
  return { start: s, end: e, text: idx.text.slice(s, e) };
}

/** How many earlier occurrences sit before `start` — lets a highlight survive
 *  as "the 3rd time this phrase appears" once its offsets go stale. */
export function occurrenceAt(root: HTMLElement, start: number, text: string): number {
  const idx = index(root);
  let n = 0;
  let at = idx.text.indexOf(text);
  while (at > -1 && at < start) {
    n++;
    at = idx.text.indexOf(text, at + 1);
  }
  return n;
}

function findText(root: HTMLElement, text: string, occurrence: number) {
  if (!text) return null;
  const idx = index(root);
  let seen = -1;
  let at = -1;
  while (seen < occurrence) {
    at = idx.text.indexOf(text, at + 1);
    if (at < 0) return null;
    seen++;
  }
  return { start: at, end: at + text.length, text };
}

function resolve(root: HTMLElement, a: Anchor) {
  if (!a?.text) return null;
  if (typeof a.start === "number" && typeof a.end === "number") {
    const idx = index(root);
    if (idx.text.slice(a.start, a.end) === a.text) {
      return { start: a.start, end: a.end, text: a.text };
    }
  }
  return findText(root, a.text, a.occurrence || 0);
}

/** Paint [start, end) by wrapping every text node it touches. Returns the
 *  wrappers in document order, or [] if the range hit nothing. */
export function paint(
  root: HTMLElement,
  anchor: Anchor,
  makeWrapper: () => HTMLElement,
): HTMLElement[] {
  const at = resolve(root, anchor);
  if (!at) return [];
  const { start, end } = at;
  if (!(end > start)) return [];

  const idx = index(root);
  const out: HTMLElement[] = [];
  for (const rec of idx.nodes) {
    if (rec.end <= start || rec.start >= end) continue;
    const from = Math.max(start - rec.start, 0);
    const to = Math.min(end - rec.start, rec.node.nodeValue!.length);
    if (to <= from) continue;
    /* Split the tail off first: splitText leaves `node` as the head, so doing
       it in this order keeps `from` valid. */
    let node = rec.node;
    if (to < node.nodeValue!.length) node.splitText(to);
    if (from > 0) node = node.splitText(from);
    const wrapper = makeWrapper();
    node.parentNode!.insertBefore(wrapper, node);
    wrapper.appendChild(node);
    out.push(wrapper);
  }
  return out;
}

/** Remove a wrapper and glue the text back together, so repeated
 *  highlight/unhighlight cycles don't shred the DOM into fragments. */
export function unwrap(mark: HTMLElement) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  (parent as Element).normalize();
}
