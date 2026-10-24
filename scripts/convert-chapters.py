#!/usr/bin/env python3
"""Turn the legacy static topic pages into chapter bodies the Next app renders.

    python3 scripts/convert-chapters.py [content/legacy/topics/NN-slug.html ...]

Each legacy page carried its own copy of the site shell (nav, sidebar, notes
drawer, scripts) around the chapter. The Next app owns the shell now, so this
keeps only what is the chapter's own: the header facts, which become front
matter, and the sections from the opening down to Related, which become the
body. Links are rewritten from file paths to routes.

Re-runnable: it overwrites content/chapters/<slug>.html from the legacy file.
"""
import glob, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "content/legacy/topics")
OUT = os.path.join(ROOT, "content/chapters")


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", text(s).lower()).strip("-")
    return s[:60] or "section"


def rewrite_links(body):
    def fix(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r"^(https?:|mailto:|#|data:)", url):
            return m.group(0)
        u = url
        # ./NN-slug.html#x or ../topics/NN-slug.html  ->  /topics/NN-slug#x
        t = re.match(r"^(?:\./|\.\./topics/|topics/)?(\d{2}-[a-z0-9-]+)\.html(#.*)?$", u)
        if t:
            return f'{attr}="/topics/{t.group(1)}{t.group(2) or ""}"'
        if re.match(r"^(?:\./)?technique-map\.html", u):
            return f'{attr}="/topics/{u.split("/")[-1]}"'
        u = re.sub(r"^\.\./", "/", u)
        u = re.sub(r"^\./", "/topics/", u) if u.startswith("./") else u
        if u in ("/index.html", "index.html"):
            u = "/"
        elif u.startswith("/sections.html"):
            u = "/sections" + u[len("/sections.html"):]
        elif not u.startswith("/"):
            u = "/" + u
        return f'{attr}="{u}"'

    return re.sub(r'\b(href|src)="([^"]*)"', fix, body)


def add_h3_ids(body):
    seen = set(re.findall(r'\bid="([^"]+)"', body))

    def fix(m):
        attrs, inner = m.group(1), m.group(2)
        if "id=" in attrs:
            return m.group(0)
        base = slugify(inner)
        i, sid = 2, base
        while sid in seen:
            sid = f"{base}-{i}"
            i += 1
        seen.add(sid)
        return f'<h3{attrs} id="{sid}">{inner}</h3>'

    return re.sub(r"<h3([^>]*)>([\s\S]*?)</h3>", fix, body)


def convert(path):
    slug = os.path.basename(path)[:-5]
    s = open(path, encoding="utf-8").read()
    head = re.search(r'<div class="topic-header">([\s\S]*?)<nav class="th-toc"', s)
    if not head:
        print(f"skip {slug}: no topic-header")
        return
    h = head.group(1)
    title = text(re.search(r"<h1>([\s\S]*?)</h1>", h).group(1))
    dek = text(re.search(r'<p class="dek">([\s\S]*?)</p>', h).group(1))
    pills = [text(p) for p in re.findall(r'<span class="th-pill">([\s\S]*?)</span>\s*(?=<span|</div>)', h)]
    pills = [re.sub(r"^\s*", "", p) for p in pills]
    read = next((p for p in pills if "min read" in p), "")
    minutes = re.search(r"(\d+)", read)
    prereqs = next((p for p in pills if p.startswith("Assumes")), "")
    prereqs = re.sub(r"^Assumes:\s*", "", prereqs)
    chip = re.search(r'<span class="th-chip"[^>]*>([\s\S]*?)</span>', h)
    num = re.search(r'<span class="th-num">([\s\S]*?)</span>', h)
    desc = re.search(r'<meta name="description" content="([^"]*)"', s)

    a = s.find('<section id="tldr"')
    if a < 0:
        a = s.find("<section", head.end())
    b = s.find('<section id="techmap-embed"', a)
    if b < 0:
        b = s.find('<nav class="prevnext"', a)
    if b < 0:
        b = s.find("</main>", a)
    body = s[a:b].rstrip()
    body = rewrite_links(add_h3_ids(body))

    fm = [
        "---",
        f"title: {yaml_str(title)}",
        f"dek: {yaml_str(dek)}",
        f"readingTime: {yaml_str('~' + minutes.group(1) + ' min' if minutes else '')}",
        f"prereqs: {yaml_str(prereqs)}",
        f"group: {yaml_str(text(chip.group(1)) if chip else '')}",
        f"label: {yaml_str(text(num.group(1)) if num else '')}",
        f"description: {yaml_str(html.unescape(desc.group(1)) if desc else dek)}",
        "---",
        "",
    ]
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, slug + ".html"), "w", encoding="utf-8") as f:
        f.write("\n".join(fm) + body + "\n")
    print(f"ok   {slug}  {len(body)//1024} KB")


files = sys.argv[1:] or sorted(glob.glob(os.path.join(SRC, "[0-9][0-9]-*.html")))
for p in files:
    convert(p)
