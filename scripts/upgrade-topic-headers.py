#!/usr/bin/env python3
"""One-time migration: give every topic page the KnowSys-style chapter header.

Before: a grey breadcrumb, a plain h1, a dek, and one long meta line
("~28 min · prerequisites: ...").

After: a group chip and chapter number (views/likes mount to the right of
them), an h1 whose last words carry the accent gradient, the same dek, the
meta line split into pills, Start reading / Mark as complete buttons, and an
empty <nav class="th-toc"> that scripts/build.py fills from the page's h2s.

Idempotent: pages that already have .th-top are skipped.

    python3 scripts/upgrade-topic-headers.py && python3 scripts/build.py
"""
import glob, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "content/manifest.json").read_text())
COLOUR = {p["id"]: p["colour"] for g in MANIFEST["groups"] for p in g["pages"]}

HEAD = re.compile(r'(<div class="topic-header">\s*)<div class="crumbs">(.*?)</div>\s*<h1>(.*?)</h1>(\s*<p class="dek">.*?</p>)\s*<div class="meta-row">(.*?)</div>', re.S)
SMALL = {"&amp;", "and", "&", "of", "for", "the", "a", "in", "to", "vs", "—"}

def grad_title(h1):
    toks = h1.split(" ")
    if len(toks) < 2: return h1
    k = 1
    if len(toks) >= 4 and toks[-2] not in SMALL: k = 2
    elif len(toks) >= 3 and len(re.sub(r"<[^>]+>|&\w+;", "", toks[-1])) <= 3 and toks[-2] not in SMALL: k = 2
    return " ".join(toks[:-k]) + ' <span class="th-grad">' + " ".join(toks[-k:]) + "</span>"

def pills(meta):
    out = [m.group(0).replace('class="tag"', 'class="th-pill tag"') for m in re.finditer(r'<span class="tag">.*?</span>', meta, re.S)]
    rt = re.search(r'<span class="reading-time">(.*?)</span>', meta, re.S)
    if rt:
        for part in [x.strip() for x in rt.group(1).split(" · ") if x.strip()]:
            m = re.match(r"~?\s*(\d+)\s*min\b\s*(.*)", part)
            if m:
                part = f'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>{m.group(1)} min read'
            else:
                part = re.sub(r"^prerequisites:\s*", "Assumes: ", part, flags=re.I)
                part = part[:1].upper() + part[1:]
            out.append(f'<span class="th-pill">{part}</span>')
    return "\n      ".join(out)

n = 0
for f in sorted(glob.glob(str(ROOT / "topics/*.html"))):
    src = open(f, encoding="utf-8").read()
    if 'class="th-top"' in src: continue
    m = HEAD.search(src)
    if not m: continue
    pid = pathlib.Path(f).stem
    parts = [x.strip() for x in re.sub(r"<[^>]+>", "", m.group(2)).split("/")]
    group, num = (parts[1], parts[2]) if len(parts) >= 3 else ("", "")
    first = re.search(r'<section id="([^"]+)"', src[m.end():])
    start = f'#{first.group(1)}' if first else '#content'
    new = (f'{m.group(1)}<div class="th-top"><span class="th-chip" style="--c:var({COLOUR.get(pid, "--c-map")})">{group}</span>'
           f'<span class="th-num">Chapter {num}</span></div>\n'
           f'    <h1>{grad_title(m.group(3))}</h1>{m.group(4)}\n'
           f'    <div class="meta-row">\n      {pills(m.group(5))}\n    </div>\n'
           f'    <div class="th-actions"><a class="th-start" href="{start}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>Start reading</a>'
           f'<button class="th-done" type="button" data-mark-done><span class="th-done-ic"></span><span class="th-done-lbl">Mark as complete</span></button></div>\n'
           f'    <nav class="th-toc"></nav>')
    open(f, "w", encoding="utf-8").write(src[:m.start()] + new + src[m.end():])
    n += 1
print(f"upgraded {n} topic headers")
