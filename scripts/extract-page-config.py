#!/usr/bin/env python3
"""Record what each page needs from the shell, into content/pages.json.

The build composes partials; this is the per-page half of that — the values
that legitimately differ (title, description, ids) and the optional pieces a
page opts into (KaTeX, the notes drawer, the counters widget, lab scripts).

Run once to capture the current state. After that pages.json is the source of
truth and this script is only for re-deriving it if something drifts.
"""
import glob, re, json, html, os, pathlib

def find(pat, t, group=1, flags=re.S):
    m = re.search(pat, t, flags)
    return m.group(group) if m else None

cfg = {}
for f in sorted(glob.glob("*.html")) + sorted(glob.glob("topics/*.html")):
    if os.path.basename(f).startswith("_of_"): continue
    t = open(f, encoding="utf-8").read()
    head = find(r"<head>.*?</head>", t, 0) or ""
    body_tag = find(r"<body[^>]*>", t, 0) or "<body>"

    # every <script src> that is not part of the shared shell
    scripts = re.findall(r'<script src="([^"]+)"></script>', t)
    def base(s): return s.split("/")[-1]
    SHELL_JS = {"search-data.js","app.js","back-link.js","code-highlight.js","find-in-page.js",
                "anchor.js","notes.js","community.js","kml-modal.js"}
    extra_js = [s for s in scripts if base(s) not in SHELL_JS]

    cfg[f] = {
        "title":       html.unescape(find(r"<title>(.*?)</title>", t) or ""),
        "description": html.unescape(find(r'<meta name="description" content="(.*?)">', t) or ""),
        "pageId":      find(r'data-page-id="([^"]*)"', body_tag) or "",
        "section":     find(r'data-section="([^"]*)"', body_tag) or "",
        "prefix":      "../" if f.startswith("topics/") else "./",
        "katex":       "katex" in head,
        "sidebar":     '<aside class="sidebar-left"' in t,
        "notes":       '<div class="notes-drawer"' in t,
        "notesTitle":  (find(r'<div class="notes-head"><h3>(.*?)</h3>', t) or "").replace("My Notes — ", ""),
        "community":   "community.js" in t,
        "hamburger":   'id="hamburger"' in t,
        "notesBtn":    'id="notesToggleTop"' in t,
        "extraJs":     extra_js,
        "contentAttr": find(r'(<main class="content"[^>]*>)', t) or '<main class="content" id="content">',
    }

pathlib.Path("content/pages.json").write_text(json.dumps(cfg, indent=1, ensure_ascii=False))
opt = lambda k: sum(1 for v in cfg.values() if v[k])
print(f"{len(cfg)} pages recorded")
for k in ("katex","sidebar","notes","community","hamburger","notesBtn"):
    print(f"  {k:11} {opt(k):3} pages")
print(f"  pages with extra JS: {sum(1 for v in cfg.values() if v['extraJs'])}")
