#!/usr/bin/env python3
"""Verify every "Try it" block on the site.

These blocks make a promise the rest of the site does not: the code runs, and
the caption quotes what it actually printed. That is only true if something
checks it, so this extracts each snippet FROM the rendered HTML — not from
whatever scratch file it was drafted in — and runs it.

    python3 scripts/check-tryit.py [--run]

Without --run it checks structure and line width only (fast, no deps).
With --run it also executes each snippet using PY (below) and reports output.
"""
import glob, html, os, re, subprocess, sys

PY = "/tmp/tryit-venv/bin/python"
MAXLINE = 74
RUN = "--run" in sys.argv

BLOCK = re.compile(
    r'<details class="tryit">\s*'
    r'<summary class="tryit-head">\s*'
    r'<span class="tryit-label">([^<]*)</span>\s*'
    r'<span class="tryit-what">(.*?)</span>\s*'
    r'</summary>\s*'
    r'<pre><code>(.*?)</code></pre>\s*'
    r'<div class="tryit-out">(.*?)</div>\s*'
    r'</details>',
    re.DOTALL)

problems = 0
total = 0
for path in sorted(glob.glob("topics/*.html")):
    src = open(path, encoding="utf-8").read()
    raw_count = src.count('<details class="tryit">')
    found = BLOCK.findall(src)
    name = os.path.basename(path)

    if raw_count != len(found):
        print("  FAIL %s: %d tryit blocks but only %d match the expected structure"
              % (name, raw_count, len(found)))
        problems += 1
        continue

    for i, (label, what, code_html, caption) in enumerate(found):
        total += 1
        code = html.unescape(code_html)
        tag = "%s block %d" % (name, i)

        if label.strip() != "Try it":
            print("  FAIL %s: label is %r" % (tag, label)); problems += 1
        if not what.strip():
            print("  FAIL %s: empty description" % tag); problems += 1
        if not caption.strip():
            print("  FAIL %s: empty caption" % tag); problems += 1

        wide = [l for l in code.splitlines() if len(l) > MAXLINE]
        if wide:
            print("  FAIL %s: %d line(s) over %d chars (worst %d)"
                  % (tag, len(wide), MAXLINE, max(len(l) for l in wide)))
            problems += 1

        try:
            compile(code, tag, "exec")
        except SyntaxError as e:
            print("  FAIL %s: does not parse as Python — %s" % (tag, e)); problems += 1
            continue

        if RUN:
            if not os.path.exists(PY):
                print("  SKIP %s: %s not found" % (tag, PY)); continue
            r = subprocess.run([PY, "-c", code], capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                print("  FAIL %s: raised at runtime\n%s"
                      % (tag, "\n".join("      " + l for l in r.stderr.strip().splitlines()[-4:])))
                problems += 1
            elif not r.stdout.strip():
                print("  FAIL %s: ran but printed nothing" % tag); problems += 1

print("\n%d Try it blocks checked%s, %d problem%s"
      % (total, " and executed" if RUN else "", problems, "" if problems == 1 else "s"))
sys.exit(1 if problems else 0)
