#!/usr/bin/env python3
"""Compose the shared shell into every page.

Why this exists: the shell — head, top nav, sidebar, search modal, notes drawer
— was copy-pasted into 51 files. Six recent commits touched 38 to 59 files each
and every one of them was a shell edit. 21% of the topic-page HTML (536KB) was
duplicated boilerplate. Adding the back button alone was a 51-file change.

What it does NOT do: touch <main>. Page content stays exactly where it is, in
the page's own file. This replaces only the regions the shell owns, which keeps
the change reversible and means nothing about the 2.5MB of prose moves.

  partials/*.html      the shell, with {{placeholders}}
  content/pages.json   the per-page values and opt-ins
  content/manifest.json the section list the sidebar is generated from

    python3 scripts/build.py [--check]

--check reports what would change without writing, which is what CI wants.
"""
import json, re, sys, glob, os, pathlib, html as H

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHECK = "--check" in sys.argv

def load(p): return (ROOT / p).read_text(encoding="utf-8")

PARTIALS = {n: load(f"partials/{n}.html") for n in
            ("head", "topnav", "searchmodal", "notesdrawer")}
PAGES    = json.loads(load("content/pages.json"))
MANIFEST = json.loads(load("content/manifest.json"))


def render(tpl, ctx):
    """Minimal mustache: {{var}}, {{#flag}}...{{/flag}}, {{#here:x}}...{{/here}}."""
    def section(m):
        name, body = m.group(1), m.group(2)
        if name.startswith("here:"):
            return body if ctx.get("here") == name.split(":", 1)[1] else ""
        return body if ctx.get(name) else ""
    tpl = re.sub(r"\{\{#(here:[a-z]+)\}\}(.*?)\{\{/here\}\}", section, tpl, flags=re.S)
    tpl = re.sub(r"\{\{#([a-zA-Z]+)\}\}(.*?)\{\{/\1\}\}", section, tpl, flags=re.S)
    # A placeholder alone on a line leaves a blank line behind when it is
    # empty; drop the whole line instead. headExtra is empty on 49 of 51 pages.
    tpl = re.sub(r"^\{\{([a-zA-Z]+)\}\}\n",
                 lambda m: (str(ctx.get(m.group(1)) or "") + "\n") if ctx.get(m.group(1)) else "",
                 tpl, flags=re.M)
    return re.sub(r"\{\{([a-zA-Z]+)\}\}", lambda m: str(ctx.get(m.group(1), "")), tpl)


def sidebar_html(prefix, current_id):
    """Generated from the manifest, so a new section appears in all 38 sidebars
    by adding one manifest entry rather than by editing 38 files."""
    o = ['<aside class="sidebar-left" id="sidebarLeft">']
    o.append(f'  <a href="{prefix}index.html" style="display:block;padding:8px;margin-bottom:8px;font-size:12.5px;color:var(--text-faint);border-bottom:1px solid var(--border-soft)">⌂ Home</a>')
    for label, href in [("🧭 Roadmaps", f"{prefix}roadmaps.html"), ("🌳 Technique Map", "./technique-map.html"),
                        ("↺ Review &amp; drill", f"{prefix}review.html"), ("🏋️ Where to practise", f"{prefix}practice.html")]:
        cls = ' class="active"' if False else ''
        o.append(f'  <a{cls} href="{href}" style="display:block;padding:8px;margin-bottom:8px;font-size:12.5px;color:var(--accent);font-weight:700;border-bottom:1px solid var(--border-soft)">{label}</a>')
    o.append('  <div class="sb-primary">')
    for label, href in [("Browse all sections", "sections.html"), ("Roadmaps", "roadmaps.html"),
                        ("The Labs", "labs.html"), ("Where to practise", "practice.html"), ("Site map", "map.html")]:
        o.append(f'    <a href="{prefix}{href}">{label}</a>')
    o.append('  </div>')
    o.append('')
    for g in MANIFEST["groups"]:
        o.append('  <details class="navgroup" open>')
        o.append(f'    <summary><span class="chev">▸</span><span class="swatch" style="background:var({g["colour"]});color:var({g["colour"]})"></span>{H.escape(g["name"])}</summary>')
        o.append('    <div class="links">')
        for p in g["pages"]:
            href = p["href"] if p["href"].startswith("topics/") else prefix + p["href"]
            href = href.replace("topics/", "./") if prefix == "../" else href
            mark = ' class="active"' if p["id"] == current_id else ''
            dp = f' data-page="{p["id"]}"' if p["kind"] == "topic" else ''
            # `short` not `title`: the rail is 280px wide and the labels are
            # curated for it. "AI in Industry: What It Is Actually Solving"
            # wraps to three lines; "AI in Industry" does not.
            lbl = H.escape(p.get("short") or p["title"])
            label = (f'{p["num"]} · {lbl}' if p["kind"] == "topic"
                     else f'🔬 {lbl} <span class="lab-mark">interactive</span>')
            o.append(f'      <a{mark} href="{href}"{dp}><span class="done"></span>{label}</a>')
        o.append('    </div>')
        o.append('  </details>')
    o.append('</aside>')
    return "\n".join(o)


HERE = {"sections.html": "sections", "roadmaps.html": "roadmaps", "labs.html": "labs",
        "practice.html": "practice", "map.html": "map"}

REGIONS = [
    ("head",        r"<head>.*?</head>"),
    ("topnav",      r'<header class="topnav">.*?</header>'),
    ("searchmodal", r'<div class="search-modal".*?\n</div>'),
    ("notesdrawer", r'<div class="notes-drawer".*?\n</div>'),
    ("sidebar",     r'<aside class="sidebar-left".*?</aside>'),
]

def build():
    changed, same = [], 0
    for rel, cfg in PAGES.items():
        f = ROOT / rel
        if not f.exists(): continue
        src = f.read_text(encoding="utf-8")
        out = src
        ctx = dict(cfg)
        ctx["here"] = HERE.get(os.path.basename(rel), "")
        ctx["description"] = H.escape(cfg["description"], quote=False).replace('"', "&quot;")
        ctx["title"] = H.escape(cfg["title"], quote=False)
        ctx["notesPlaceholder"] = cfg.get("notesPlaceholder", "")
        ctx["headExtra"] = cfg.get("headExtra", "")

        for name, pat in REGIONS:
            m = re.search(pat, out, re.S)
            if not m: continue
            if name == "sidebar":
                new = sidebar_html(cfg["prefix"], cfg["pageId"])
            else:
                new = render(PARTIALS[name], ctx).rstrip("\n")
            out = out[:m.start()] + new + out[m.end():]

        if out != src:
            changed.append(rel)
            if not CHECK: f.write_text(out, encoding="utf-8")
        else:
            same += 1
    return changed, same

if __name__ == "__main__":
    changed, same = build()
    verb = "would change" if CHECK else "rebuilt"
    print(f"{len(changed)} pages {verb}, {same} already identical")
    for c in changed[:12]: print("   ", c)
    if len(changed) > 12: print(f"    … and {len(changed)-12} more")
