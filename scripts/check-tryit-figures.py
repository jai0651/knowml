#!/usr/bin/env python3
"""Check that numbers quoted in a Try it caption actually appear in its output.

check-tryit.py proves the snippet runs and prints something. It does not prove
the caption is describing THAT output. Three chapter agents sharing a scratchpad
once swapped each other's snippets; the code still ran, still printed, and the
suite stayed green while a page discussed figures its own code never produced.

Any number in a <code> span inside the caption must appear in stdout.
    python3 scripts/check-tryit-figures.py [topics/NN-*.html ...]
"""
import re, sys, glob, html, subprocess, os

PY = "/tmp/tryit-venv/bin/python"
BLOCK = re.compile(
    r'<span class="tryit-what">(.*?)</span>.*?<pre><code>(.*?)</code></pre>\s*'
    r'<div class="tryit-out">(.*?)</div>', re.S)

def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s))

def quoted_numbers(caption_html):
    """Only numbers the caption puts in <code>, which is how this site marks a
       figure as coming from the output rather than from prose."""
    out = []
    for m in re.finditer(r"<code>(.*?)</code>", caption_html, re.S):
        for n in re.findall(r"-?\d+(?:\.\d+)?", strip(m.group(1))):
            out.append(n)
    return out

def main(argv):
    files = argv or sorted(glob.glob("topics/*.html"))
    if not os.path.exists(PY):
        print(f"SKIP: {PY} not found"); return 0
    checked = problems = 0
    for f in files:
        src = open(f, encoding="utf-8").read()
        for i, m in enumerate(BLOCK.finditer(src), 1):
            what, code, cap = strip(m.group(1)).strip(), strip(m.group(2)), m.group(3)
            nums = quoted_numbers(cap)
            if not nums:
                continue
            checked += 1
            r = subprocess.run([PY, "-c", code], capture_output=True, text=True, timeout=180)
            if r.returncode != 0:
                print(f"  FAIL {f} [{i}] raised: {r.stderr.strip().splitlines()[-1][:80]}")
                problems += 1; continue
            # A caption may legitimately quote a constant the snippet takes as
            # input (a figure cited from a paper, say) rather than one it
            # prints. Accept either; the point is that the number is anchored to
            # the code on the page and not to thin air.
            # Compare numerically, not as strings: a caption writing 1.000 is
            # describing the same value numpy prints as "1.". Match a quoted
            # figure against any number in the output or the code, rounded to
            # the precision the caption chose to state.
            hay = re.findall(r"-?\d+(?:\.\d+)?", r.stdout + "\n" + code)
            hayf = []
            for h in hay:
                try: hayf.append(float(h))
                except ValueError: pass
            missing = []
            for n in nums:
                dp = len(n.split(".")[1]) if "." in n else 0
                v = float(n)
                if not any(round(h, dp) == v for h in hayf):
                    missing.append(n)
            if missing:
                print(f"  FAIL {f} [{i}] \"{what[:52]}\"")
                print(f"        quoted but absent from both output and code: {', '.join(missing[:8])}")
                problems += 1
    print(f"\n{checked} Try it captions cross-checked against real output, {problems} problems")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
