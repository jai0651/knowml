#!/usr/bin/env python3
"""Extract the interview Q&As already written across the topic pages into a
single question bank consumed by the Review page. Run this again after adding
or editing any <details class="qa"> block."""
import re, json, glob, os, html

ROOT = "/Users/jai/Desktop/ML/site"

# page -> accent colour, taken from the topic cards on the home page
with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
    index_src = f.read()
COLORS = dict(
    (m.group(2), m.group(1))
    for m in re.finditer(r'style="border-top-color:var\((--c-[a-z0-9]+)\)" href="topics/([^"]+)\.html"', index_src)
)

QA_RE = re.compile(
    r'<details class="qa">\s*'
    r'<summary>\s*<span class="qa-level (\w+)">[^<]*</span>(.*?)</summary>\s*'
    r'<div class="qa-body">(.*?)</div>\s*'
    r'</details>',
    re.DOTALL,
)

def text_of(fragment):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", fragment)).strip()

cards = []
pages = []
for path in sorted(glob.glob(os.path.join(ROOT, "topics", "*.html"))):
    slug = os.path.basename(path)[:-5]
    if slug == "technique-map":
        continue
    with open(path, encoding="utf-8") as f:
        src = f.read()

    page_id = re.search(r'data-page-id="([^"]+)"', src).group(1)
    h1 = re.search(r"<h1>(.*?)</h1>", src, re.DOTALL)
    title = html.unescape(text_of(h1.group(1))) if h1 else page_id
    crumbs = re.search(r'<div class="crumbs">(.*?)</div>', src, re.DOTALL)
    group = ""
    if crumbs:
        # strip tags first — the crumb's own <a href="../index.html"> contains a slash
        parts = [p.strip() for p in html.unescape(text_of(crumbs.group(1))).split("/")]
        if len(parts) >= 2:
            group = parts[1]
    color = "var(%s)" % COLORS.get(slug, "--c-map")

    found = QA_RE.findall(src)
    for i, (level, q_html, a_html) in enumerate(found):
        cards.append({
            "id": "%s::%d" % (page_id, i),
            "pageId": page_id,
            "page": slug,
            "pageTitle": title,
            "group": group,
            "color": color,
            "level": level,
            "q": q_html.strip(),
            "a": a_html.strip(),
        })
    if found:
        pages.append({
            "pageId": page_id, "page": slug, "pageTitle": title,
            "group": group, "color": color, "count": len(found),
        })

HEADER = ("/* Auto-generated from the interview Q&As on each topic page.\n"
          "   Regenerate with scripts/build-question-bank.py after editing any Q&A. */\n")

# Full bank — only loaded by the Review page.
out = os.path.join(ROOT, "assets", "js", "question-bank.js")
with open(out, "w", encoding="utf-8") as f:
    f.write(HEADER)
    f.write("window.KML_QUESTIONS = " + json.dumps(cards, ensure_ascii=False, indent=0) + ";\n")

# Tiny index — loaded on every topic page for the sidebar mastery widget.
out_idx = os.path.join(ROOT, "assets", "js", "question-index.js")
with open(out_idx, "w", encoding="utf-8") as f:
    f.write(HEADER)
    f.write("window.KML_QUESTION_PAGES = " + json.dumps(pages, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("wrote:", out_idx, "(%.1f KB)" % (os.path.getsize(out_idx) / 1024))

by_level = {}
for c in cards:
    by_level[c["level"]] = by_level.get(c["level"], 0) + 1
print("pages with Q&As:", len(pages))
print("cards:", len(cards), by_level)
print("wrote:", out, "(%.1f KB)" % (os.path.getsize(out) / 1024))
