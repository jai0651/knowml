#!/usr/bin/env python3
"""Keep every page's copy of the sidebar consistent.

Each of the 31 pages carries its own hand-copied sidebar. Editing them with
exact-string matching on the visible label is brittle: an earlier sweep removed
"soon" stub-marks by matching `20 · 3D, Spatial &amp; AD`, missed the nine pages
using the longer `20 · 3D, Spatial AI &amp; Autonomous Driving` variant, and left
both a stale stub-mark and three competing labels for the same page.

This matches on the `data-page` attribute instead, which is stable, and derives
the canonical label per page by majority vote across the site. Stub status comes
from the page itself: a page is a stub if it still carries the
"mapped in the learning graph" status callout.

    python3 scripts/normalize-sidebars.py --check   # report drift, change nothing
    python3 scripts/normalize-sidebars.py           # fix it
"""
import glob, os, re, sys
from collections import Counter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CHECK = "--check" in sys.argv

pages = sorted(glob.glob(os.path.join(ROOT, "topics", "*.html")))
index = os.path.join(ROOT, "index.html")

# A page is a stub if its own body still says so.
stubs = set()
for p in pages:
    src = open(p, encoding="utf-8").read()
    if "callout-status" in src and "mapped in the learning graph" in src:
        stubs.add(os.path.basename(p)[:-5])

# Canonical label per data-page: whichever spelling most pages already use.
LINK = re.compile(
    r'(<a\b[^>]*\bdata-page="(?P<page>[^"]+)"[^>]*>)'
    r'(?P<done><span class="done"></span>)'
    r'(?P<label>[^<]*)'
    r'(?P<stub>\s*<span class="stub-mark">soon</span>)?'
    r'</a>'
)
votes = {}
for p in pages + [index]:
    for m in LINK.finditer(open(p, encoding="utf-8").read()):
        votes.setdefault(m.group("page"), Counter())[m.group("label").strip()] += 1
canonical = {k: c.most_common(1)[0][0] for k, c in votes.items()}

fixed_labels = fixed_stubs = touched = 0
for p in pages + [index]:
    src = open(p, encoding="utf-8").read()

    def repl(m):
        global fixed_labels, fixed_stubs
        page, label = m.group("page"), m.group("label").strip()
        want = canonical.get(page, label)
        if label != want:
            fixed_labels += 1
        want_stub = page in stubs
        has_stub = m.group("stub") is not None
        if has_stub != want_stub:
            fixed_stubs += 1
        stub = ' <span class="stub-mark">soon</span>' if want_stub else ""
        return f'{m.group(1)}{m.group("done")}{want}{stub}</a>'

    out = LINK.sub(repl, src)
    if out != src:
        touched += 1
        if not CHECK:
            open(p, "w", encoding="utf-8").write(out)

verb = "would fix" if CHECK else "fixed"
print(f"stubs (from page content): {', '.join(sorted(stubs))}")
print(f"{verb} {fixed_labels} label mismatches and {fixed_stubs} stub-mark mismatches across {touched} files")
sys.exit(1 if (CHECK and touched) else 0)
