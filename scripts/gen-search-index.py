#!/usr/bin/env python3
"""Extract per-section ("subtopic") search entries from every topic page's
h2/h3 headings, and merge them into search-data.js alongside the hand-curated,
per-page entries. This is what lets searching "chunked prefill" or "InfoNCE"
jump straight into the middle of a page instead of only ever finding the page
itself.

Safe to re-run: it keeps every entry without "kind":"section" untouched (the
hand-curated page-level entries) and fully regenerates the section entries
from the current HTML each time.

    python3 scripts/gen-search-index.py
"""
import re, json, glob, os, html

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SEARCH_JS = os.path.join(ROOT, "assets", "js", "search-data.js")

src = open(SEARCH_JS, encoding="utf-8").read()
header, rest = src.split("window.SEARCH_INDEX = ", 1)
existing = json.loads(rest.rstrip().rstrip(";"))
pages = [e for e in existing if e.get("kind") != "section"]

by_slug = {}
for e in pages:
    m = re.match(r"topics/([^.]+)\.html$", e.get("url", ""))
    if m:
        by_slug[m.group(1)] = e

# Headings that repeat near-verbatim across most pages: indexing them would
# flood results with entries a query can't tell apart. Anything with real
# per-page content after the colon (page 07's two variants) is kept.
GENERIC_H3 = {"Where this runs in production", "What actually shows up in production"}
# Section ids whose h2 is boilerplate navigation chrome, not page content.
SKIP_SECTION_IDS = {"techmap-embed", "interview", "resources", "related"}

def text_of(fragment):
    fragment = re.sub(r'<span class="num">.*?</span>', "", fragment, flags=re.DOTALL)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", fragment)).strip())

def slugify(text):
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", text.lower()))

SECTION_RE = re.compile(r'<section id="([^"]+)">(.*?)</section>', re.DOTALL)
H2_RE = re.compile(r"<h2>(.*?)</h2>", re.DOTALL)
H3_RE = re.compile(r"<h3>(.*?)</h3>", re.DOTALL)
PROJ_TITLE_RE = re.compile(r'<span class="proj-title">(.*?)</span>', re.DOTALL)

subtopics = []
for path in sorted(glob.glob(os.path.join(ROOT, "topics", "*.html"))):
    slug = os.path.basename(path)[:-5]
    if slug not in by_slug:
        continue
    parent = by_slug[slug]
    page_src = open(path, encoding="utf-8").read()
    if "<main" not in page_src or "</main>" not in page_src:
        continue
    main = page_src[page_src.index("<main"):page_src.index("</main>")]

    for sec_id, body in SECTION_RE.findall(main):
        if sec_id in SKIP_SECTION_IDS:
            continue
        h2 = H2_RE.search(body)
        if h2:
            title = text_of(h2.group(1))
            if sec_id == "build":
                proj = PROJ_TITLE_RE.search(body)
                if proj:
                    title = text_of(proj.group(1))
            if title:
                subtopics.append({
                    "kind": "section", "title": title,
                    "parentTitle": parent["title"], "section": parent["section"],
                    "url": "topics/%s.html#%s" % (slug, sec_id),
                    "tags": [], "summary": "", "color": parent["color"],
                })
        for h3_html in H3_RE.findall(body):
            title = text_of(h3_html)
            if not title or title in GENERIC_H3:
                continue
            subtopics.append({
                "kind": "section", "title": title,
                "parentTitle": parent["title"], "section": parent["section"],
                "url": "topics/%s.html#%s" % (slug, slugify(title)),
                "tags": [], "summary": "", "color": parent["color"],
            })

combined = pages + subtopics
out = header + "window.SEARCH_INDEX = " + json.dumps(combined, ensure_ascii=False, indent=2) + ";\n"
open(SEARCH_JS, "w", encoding="utf-8").write(out)
print("page entries: %d, subtopic entries: %d, total: %d" % (len(pages), len(subtopics), len(combined)))
