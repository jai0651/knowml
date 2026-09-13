#!/usr/bin/env python3
"""Emit sitemap.xml and llms.txt from the pages that actually exist on disk.

Both are generated rather than hand-listed, so a new page appears in them the
moment it is built — which is the whole point given how many more are coming.
"""
import glob, os, re, html, json, pathlib, datetime

BASE = "https://knowml.vercel.app"
SKIP = {"admin.html"}                      # password-gated, and robots disallows it

def title_of(path):
    t = open(path, encoding="utf-8").read()
    m = re.search(r"<title>(.*?)</title>", t, re.S)
    return html.unescape(m.group(1)).replace(" · KnowML", "").replace(" — KnowML", "").strip() if m else path
def desc_of(path):
    t = open(path, encoding="utf-8").read()
    m = re.search(r'<meta name="description" content="(.*?)">', t, re.S)
    return html.unescape(m.group(1)).strip() if m else ""

pages = sorted(glob.glob("*.html")) + sorted(glob.glob("topics/*.html"))
pages = [p for p in pages if os.path.basename(p) not in SKIP and not os.path.basename(p).startswith("_of_")]

# priority: the homepage, then hubs, then topics, then the rest
def priority(p):
    b = os.path.basename(p)
    if b == "index.html": return "1.0"
    if b in {"sections.html","roadmaps.html","labs.html","map.html","practice.html","review.html"}: return "0.9"
    if p.startswith("topics/"): return "0.8"
    return "0.6"

today = datetime.date.today().isoformat()
urls = []
for p in pages:
    loc = BASE + "/" + p.replace(os.sep, "/")
    urls.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{today}</lastmod>\n"
                f"    <changefreq>weekly</changefreq>\n    <priority>{priority(p)}</priority>\n  </url>")
pathlib.Path("sitemap.xml").write_text(
  '<?xml version="1.0" encoding="UTF-8"?>\n'
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")

# llms.txt — the emerging convention for telling an agent what a site holds,
# so it does not have to crawl 50 pages to find out.
man = json.load(open("content/manifest.json"))
lines = ["# KnowML", "",
         "> Machine learning and modern AI, from first principles to the 2026 frontier. "
         "Every section answers the same six questions; every runnable code block is executed in CI; "
         "numbers are derived on the page or attributed.", "",
         "## Start here", ""]
for label, href in [("Browse every section","sections.html"),("Learning roadmaps","roadmaps.html"),
                    ("Interactive labs","labs.html"),("Site map (graph)","map.html"),
                    ("Where to practise","practice.html"),("Spaced-repetition drill","review.html")]:
    lines.append(f"- [{label}]({BASE}/{href})")
for g in man["groups"]:
    lines += ["", f"## {g['name']}", ""]
    for pg in g["pages"]:
        lines.append(f"- [{pg['title']}]({BASE}/{pg['href']}): {pg['hook']}")
pathlib.Path("llms.txt").write_text("\n".join(lines) + "\n")

print(f"sitemap.xml: {len(urls)} urls")
print(f"llms.txt:    {sum(len(g['pages']) for g in man['groups'])} pages described")
