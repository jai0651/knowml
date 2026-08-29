/* KnowML — shared text-anchoring utilities.

   Used by personal highlights (notes.js) and shared inline comments (community.js).

   The first version searched one text node at a time and wrapped with
   Range.surroundContents(). Both of those break the moment a selection crosses
   an inline element, because the phrase exists in no single text node and
   surroundContents() throws on a partially-selected element. Highlights were
   saved and then silently never painted. Almost every paragraph on this site
   carries a <strong> or an <em>, so in practice that was most selections.

   This version flattens the content into one string, anchors on character
   offsets into it, and paints a range by wrapping each text node it touches
   separately. A highlight over "the **softmax** step" becomes three <mark>s and
   looks like one.

   Offsets are stored alongside the selected text. On restore the offsets are
   tried first and validated against that text; if the page has shifted under
   them, it falls back to searching for the Nth occurrence of the text itself. */
(function () {
  'use strict';

  /* KaTeX emits every equation twice: once as visible HTML and once as a hidden
     MathML tree for screen readers. Indexing both would double every offset
     past the first equation on the page. */
  var SKIP = 'script,style,.katex-mathml';

  function index(root) {
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], text = '', n;
    while ((n = walk.nextNode())) {
      nodes.push({ node: n, start: text.length, end: text.length + n.nodeValue.length });
      text += n.nodeValue;
    }
    return { nodes: nodes, text: text };
  }

  /* A Range boundary is either (textNode, charOffset) or (element, childIndex). */
  function boundary(idx, container, offset, atEnd) {
    var i;
    if (container.nodeType === 3) {
      for (i = 0; i < idx.nodes.length; i++) {
        if (idx.nodes[i].node === container) return idx.nodes[i].start + offset;
      }
      return -1;
    }
    var child = container.childNodes[offset];
    if (child) {
      for (i = 0; i < idx.nodes.length; i++) {
        if (child === idx.nodes[i].node || child.contains(idx.nodes[i].node)) return idx.nodes[i].start;
      }
    }
    /* offset points past the last child, or at a subtree with no indexed text:
       fall back to the edge of whatever text the container does hold */
    var first = -1, last = -1;
    for (i = 0; i < idx.nodes.length; i++) {
      if (container.contains(idx.nodes[i].node)) {
        if (first < 0) first = idx.nodes[i].start;
        last = idx.nodes[i].end;
      }
    }
    return atEnd ? last : first;
  }

  /* live selection Range -> {start, end, text} in flattened-content coordinates */
  function rangeToOffsets(root, range) {
    var idx = index(root);
    var s = boundary(idx, range.startContainer, range.startOffset, false);
    var e = boundary(idx, range.endContainer, range.endOffset, true);
    if (s < 0 || e < 0 || e <= s) return null;
    return { start: s, end: e, text: idx.text.slice(s, e) };
  }

  /* Nth occurrence of `text` anywhere in the flattened content */
  function findText(root, text, occurrence) {
    if (!text) return null;
    var idx = index(root), want = occurrence || 0, seen = -1, at = -1;
    while (seen < want) {
      at = idx.text.indexOf(text, at + 1);
      if (at < 0) return null;
      seen++;
    }
    return { start: at, end: at + text.length, text: text };
  }

  /* how many earlier occurrences of `text` sit before `start` — lets a highlight
     survive as "the 3rd time this phrase appears" if its offsets ever go stale */
  function occurrenceAt(root, start, text) {
    var idx = index(root), n = 0, at = idx.text.indexOf(text);
    while (at > -1 && at < start) { n++; at = idx.text.indexOf(text, at + 1); }
    return n;
  }

  /* Paint [start, end) by wrapping every text node it touches. Returns the
     wrappers in document order, or [] if the range hit nothing. */
  function wrapOffsets(root, start, end, makeWrapper) {
    if (!(end > start)) return [];
    var idx = index(root), out = [];
    idx.nodes.forEach(function (rec) {
      if (rec.end <= start || rec.start >= end) return;
      var from = Math.max(start - rec.start, 0);
      var to = Math.min(end - rec.start, rec.node.nodeValue.length);
      if (to <= from) return;
      /* split off the tail first: splitText leaves `node` as the head, so doing
         it in this order keeps `from` valid */
      var node = rec.node;
      if (to < node.nodeValue.length) node.splitText(to);
      if (from > 0) node = node.splitText(from);
      var wrapper = makeWrapper();
      node.parentNode.insertBefore(wrapper, node);
      wrapper.appendChild(node);
      out.push(wrapper);
    });
    return out;
  }

  /* Resolve a stored anchor {text, occurrence, start, end} against the page as
     it is now. Offsets win when they still point at the expected text. */
  function resolve(root, anchor) {
    if (!anchor || !anchor.text) return null;
    if (typeof anchor.start === 'number' && typeof anchor.end === 'number') {
      var idx = index(root);
      if (idx.text.slice(anchor.start, anchor.end) === anchor.text) {
        return { start: anchor.start, end: anchor.end, text: anchor.text };
      }
    }
    return findText(root, anchor.text, anchor.occurrence || 0);
  }

  function paint(root, anchor, makeWrapper) {
    var at = resolve(root, anchor);
    return at ? wrapOffsets(root, at.start, at.end, makeWrapper) : [];
  }

  window.KMLAnchor = {
    index: index,
    rangeToOffsets: rangeToOffsets,
    findText: findText,
    occurrenceAt: occurrenceAt,
    wrapOffsets: wrapOffsets,
    resolve: resolve,
    paint: paint,

    /* kept for callers that still think in text + occurrence; returns the last
       wrapper so a trailing badge can be appended next to it */
    wrapOccurrence: function (root, text, occurrence, makeWrapper) {
      var marks = paint(root, { text: text, occurrence: occurrence || 0 }, makeWrapper);
      return marks.length ? marks[marks.length - 1] : null;
    },
    computeOccurrence: function (root, range, text) {
      var at = rangeToOffsets(root, range);
      return at ? occurrenceAt(root, at.start, text) : 0;
    }
  };
})();
