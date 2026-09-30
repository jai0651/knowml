# Editing a KnowML topic page (the opening pattern)

**First load the `teach-writing` skill** (`~/.claude/skills/teach-writing`). It holds the
rules for every page: ease in then go deep, the sentence rules, the banned phrasing, and
the evidence rules. This file adds what is specific to this repo. `docs/STYLE.md` still
governs sentence rhythm; where it says "an editing pass, not a rewrite", read that as
"never change a fact, number, equation or link". Reordering sections and adding a first
experiment are allowed.

## Hard constraints (unchanged)

- Do not change any fact, number, equation, claim or external link. Do not invent a new
  technical claim.
- Leave alone: `<details class="qa">` answers (they are flashcards), `<details
  class="derivation">` steps, everything inside `<svg>`, the `techmap-embed` dek, KaTeX
  spans and all `id` attributes.
- Any new number you print must come from code you ran. A hand-picked toy example is
  fine if the page says the numbers are hand-picked.

## The pattern for a page

Most pages open with `#tldr`, then `01 Where this sits in the timeline`, then `02 The
intuition, before any math`. The history is a poor first thing to read. So:

1. **Move the intuition section to 01** and the timeline to 02. Swap the two
   `<span class="num">` values and the two entries in the `th-toc` contents list.
2. **Add one runnable first experiment to the intuition section**: a small numpy
   (or torch) block with numbers the reader can check by hand, placed after the
   analogy or teach callout. Use the site's Try it markup exactly:
   `<details class="tryit" open>`, `tryit-label`, `tryit-what`, `<pre><code>` with the
   code HTML-escaped, and a `tryit-out` caption that states what it printed. Keep code
   lines at 74 characters or fewer.
3. **Plain-language fixes** to headings and prose outside the protected zones
   ("how the data actually flows" becomes "how the data flows"). Headings also appear in
   the contents list and the search index.

Pages whose sections differ from this anatomy need judgement; do not force the swap.

## After every page (all must pass)

```
python3 scripts/gen-search-index.py     # headings changed, so the search entries change
npm run build                           # re-stamps the shell hash on every page (expected)
git checkout sitemap.xml llms.txt       # build rewrites these with unrelated noise; revert
npm test                                # build --check-strict, page ids, highlighting, try-it structure
TRYIT_PY=<python with numpy+torch> python3 scripts/check-tryit.py --run   # executes every block
python3 ~/.claude/skills/teach-writing/scripts/tells.py topics/<page>.html
```

`tells.py` also counts words inside the protected zones (qa, derivations); those you may
not edit, so a nonzero count there is expected. Look at the page in a browser before
calling it done (`python3 -m http.server`); the `/api/*` 404s on a static server are
normal.
