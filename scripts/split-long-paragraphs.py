#!/usr/bin/env python3
"""Split paragraphs over ~70 words into two, at a sentence boundary.

The style guide sets a 70-word ceiling and 99 paragraphs were over it — the
"grey wall" the earlier editing pass fixed at sentence level but not at block
level. This does the block-level half mechanically.

Safety is the whole design. A paragraph is raw hand-written HTML containing
<strong>, <em>, <a>, <code> and KaTeX spans, so a naive split on ". " can cut
through markup and silently corrupt the page. This only cuts at a boundary
where:

  * the split point is outside every tag (tag depth zero), and
  * it is outside any $...$ or $$...$$ math span, and
  * both halves independently have balanced tags, and
  * the text content of the two halves, concatenated, is byte-identical to the
    original — so no character is ever added, lost or reordered.

Any paragraph failing a check is left alone and reported.

    python3 scripts/split-long-paragraphs.py --check   # report only
    python3 scripts/split-long-paragraphs.py           # rewrite
"""
import glob, os, re, sys

CHECK = "--check" in sys.argv
LIMIT = 70          # words; the style guide's ceiling
MIN_HALF = 25       # never leave a stub paragraph behind

P_RE = re.compile(r'(<p\b[^>]*>)(.*?)(</p>)', re.DOTALL)


def text_of(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def safe_offsets(inner):
    """Character offsets just after a sentence end that are safe to cut at."""
    depth = 0
    math = False            # inside $...$
    dmath = False           # inside $$...$$
    out = []
    i = 0
    while i < len(inner):
        c = inner[i]
        if c == "<":
            depth += 1
        elif c == ">":
            depth = max(0, depth - 1)
        elif c == "$" and depth == 0:
            if inner.startswith("$$", i):
                dmath = not dmath
                i += 2
                continue
            math = not math
        elif c in ".!?" and depth == 0 and not math and not dmath:
            j = i + 1
            # a sentence end is followed by whitespace then a capital/opening tag
            if j < len(inner) and inner[j] in " \n":
                k = j
                while k < len(inner) and inner[k] in " \n":
                    k += 1
                if k < len(inner) and (inner[k].isupper() or inner[k] == "<"):
                    out.append((i + 1, k))
        i += 1
    return out


def balanced(fragment):
    """Every tag opened in the fragment is closed in it, and vice versa."""
    stack = []
    for m in re.finditer(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*?(/?)>', fragment):
        closing, name, selfclose = m.group(1), m.group(2).lower(), m.group(3)
        if name in ("br", "img", "hr", "input"):
            continue
        if selfclose:
            continue
        if closing:
            if not stack or stack[-1] != name:
                return False
            stack.pop()
        else:
            stack.append(name)
    return not stack


def split_paragraph(open_tag, inner, close_tag, _depth=0):
    """Split once, then recurse: a 242-word paragraph halves to two over-long
    ones, so a single pass is not enough. Depth-capped so a pathological input
    cannot loop."""
    words = len(text_of(inner).split())
    if words <= LIMIT or _depth > 3:
        return None
    cuts = safe_offsets(inner)
    if not cuts:
        return None
    target = len(inner) / 2
    # prefer the cut nearest the middle that leaves both halves substantial
    for end, nxt in sorted(cuts, key=lambda c: abs(c[0] - target)):
        a, b = inner[:end], inner[nxt:]
        if not a.strip() or not b.strip():
            continue
        if len(text_of(a).split()) < MIN_HALF or len(text_of(b).split()) < MIN_HALF:
            continue
        if not balanced(a) or not balanced(b):
            continue
        if text_of(a) + " " + text_of(b) != text_of(inner):
            continue        # content changed: refuse
        left = split_paragraph(open_tag, a.strip(), close_tag, _depth + 1) \
            or (open_tag + a.strip() + close_tag)
        right = split_paragraph(open_tag, b.strip(), close_tag, _depth + 1) \
            or (open_tag + b.strip() + close_tag)
        return left + "\n    " + right
    return None


changed = split = skipped = 0
for path in sorted(glob.glob("topics/*.html")):
    src = open(path, encoding="utf-8").read()
    if "<main" not in src or "mapped in the learning graph" in src:
        continue
    head, main, tail = (src[:src.index("<main")],
                        src[src.index("<main"):src.index("</main>")],
                        src[src.index("</main>"):])

    # never touch interview answers or derivations: their phrasing is load-bearing elsewhere
    protected = []
    def stash(m):
        protected.append(m.group(0))
        return "\x00%d\x00" % (len(protected) - 1)
    main = re.sub(r'<details class="(?:qa|derivation)">.*?</details>', stash, main, flags=re.DOTALL)

    counts = {"split": 0, "skip": 0}
    def repl(m):
        out = split_paragraph(m.group(1), m.group(2), m.group(3))
        if out is None:
            if len(text_of(m.group(2)).split()) > LIMIT:
                counts["skip"] += 1
            return m.group(0)
        counts["split"] += 1
        return out
    main = P_RE.sub(repl, main)
    local_split, local_skip = counts["split"], counts["skip"]
    split += local_split
    skipped += local_skip

    for i, frag in enumerate(protected):
        main = main.replace("\x00%d\x00" % i, frag)

    if local_split:
        changed += 1
        if not CHECK:
            open(path, "w", encoding="utf-8").write(head + main + tail)
        print("  %-44s split %d%s" % (os.path.basename(path), local_split,
                                      (", left %d" % local_skip) if local_skip else ""))

print("\n%s: %d paragraphs split across %d pages, %d left alone"
      % ("would change" if CHECK else "changed", split, changed, skipped))
