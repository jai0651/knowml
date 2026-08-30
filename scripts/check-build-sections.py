#!/usr/bin/env python3
"""Verify the "Build this" sweep that replaced the worked-example sections.

The old `<section id="applications">` held a hand-computed worked example plus a
production use case. It became `<section id="build">`: a project, then the same
production prose. Three things can silently go wrong in that swap, and this
checks all three.

1. **Section numbers drift.** Pages cross-reference each other by `§NN`, and the
   numbers were not uniform: most pages used 07, but 06 and 24 used 09, and 23
   and 28 used 14. An agent normalising them to 07 breaks the references.
2. **The production use case gets rewritten** instead of carried over. It was
   already verified prose; it should survive byte-identical.
3. **Projects promise results.** "You'll reach 94% accuracy" is invented. The
   success criterion has to be qualitative and observable.

    python3 scripts/check-build-sections.py
"""
import glob, os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(ROOT)

# Section number each page used before the sweep. Must survive unchanged.
EXPECTED_NUM = {
    "01-math-foundations": "07", "02-classical-ml": "07",
    "03-unsupervised-self-supervised": "07", "04-neural-network-fundamentals": "07",
    "05-cnn-vision-foundations": "07", "06-modern-vision-foundation-models": "09",
    "07-sequence-modeling-pre-transformer": "07", "08-attention-transformers": "07",
    "09-nlp-evolution": "07", "10-llm-architecture-training": "07",
    "11-rag-agents-reasoning": "07", "12-generative-models": "07",
    "13-speech-audio": "07", "14-multimodal-ai": "07",
    "15-reinforcement-learning": "07", "20-3d-spatial-autonomous-driving": "07",
    "21-robotics-embodied-ai": "07", "23-efficient-ai-systems": "14",
    "24-mlops": "09", "25-evaluation-reliability-safety": "07",
    "26-frontier-2026": "07", "28-gpu-architecture-cuda-distributed": "14",
    "31-llm-inference-serving": "07", "32-preference-optimization": "09",
}

# Page 30's "Worked example" is the VRAM sizing calculation, which is the whole
# point of that page and is already collapsed behind a <details>. It is not one
# of the arithmetic walkthroughs this sweep removed.
WORKED_EXAMPLE_OK = {"30-running-models-locally"}

# A digit next to one of these, inside a success criterion, is probably a
# promised result rather than a parameter the reader sets.
PROMISE = re.compile(
    r"(?:reach|hit|achiev\w*|get|see|obtain|yield\w*|score|converge\w*\s+to)\s+"
    r"(?:about\s+|around\s+|roughly\s+|~)?\d+(?:\.\d+)?\s*(?:%|×|x\b|ms\b|dB\b)",
    re.I,
)

problems, notes = [], []

for slug, want_num in sorted(EXPECTED_NUM.items()):
    path = f"topics/{slug}.html"
    src = open(path, encoding="utf-8").read()

    if 'id="applications"' in src:
        problems.append(f"{slug}: still has id=\"applications\"")
        continue
    m = re.search(r'<section id="build">(.*?)</section>', src, re.DOTALL)
    if not m:
        problems.append(f"{slug}: no <section id=\"build\">")
        continue
    sec = m.group(1)

    num = re.search(r'<h2><span class="num">(\d+)</span>', sec)
    if not num:
        problems.append(f"{slug}: build section has no numbered h2")
    elif num.group(1) != want_num:
        problems.append(f"{slug}: section number {num.group(1)}, expected {want_num}")

    for tag in ("div", "ol", "li", "h3", "p"):
        o = len(re.findall(rf"<{tag}\b(?:\s[^>]*)?>", sec))
        c = len(re.findall(rf"</{tag}>", sec))
        if o != c:
            problems.append(f"{slug}: unbalanced <{tag}> in build section ({o} open, {c} close)")

    for need, label in (("project", "project card"), ("proj-steps", "steps"),
                        ("proj-done", "success criterion")):
        if need not in sec:
            problems.append(f"{slug}: build section missing {label}")

    if "Where this runs in production" not in sec:
        notes.append(f"{slug}: no 'Where this runs in production' heading")

    text = re.sub(r"<[^>]+>", " ", sec)
    for hit in PROMISE.findall(text):
        problems.append(f"{slug}: promises a result: …{hit}…")
    if re.search(r"worked example", text, re.I):
        problems.append(f"{slug}: 'worked example' text survives")

# The production use case should be carried over, not rewritten. Pull the old
# section out of HEAD and check every sentence of it still appears verbatim.
def sentences(html):
    # Drop h3 titles first: they are *meant* to change ("Production use case: X"
    # became "Where this runs in production: X"), and leaving them in makes the
    # renamed heading look like altered body prose.
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<h3>.*?</h3>", " ", html, flags=re.DOTALL)))
    return [s.strip() for s in re.split(r"(?<=[.!?]) ", text) if len(s.strip()) > 45]

if subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True).returncode != 0:
    notes.append("no git repo: could not diff production prose against HEAD")
else:
    for slug in sorted(EXPECTED_NUM):
        old = subprocess.run(["git", "show", f"HEAD:topics/{slug}.html"],
                             capture_output=True, text=True).stdout
        m = re.search(r'<section id="applications">(.*?)</section>', old, re.DOTALL)
        if not m:
            continue
        # Only the production half: everything from the first "production" h3 on.
        parts = re.split(r'<h3>[^<]*[Pp]roduction[^<]*</h3>', m.group(1), maxsplit=1)
        if len(parts) < 2:
            notes.append(f"{slug}: no production h3 in HEAD, nothing to compare")
            continue
        now = open(f"topics/{slug}.html", encoding="utf-8").read()
        lost = [s for s in sentences(parts[1]) if s not in re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", now))]
        for s in lost[:2]:
            problems.append(f"{slug}: production prose altered: \"{s[:70]}…\"")
        if len(lost) > 2:
            problems.append(f"{slug}: …and {len(lost) - 2} more altered production sentences")

# No prose still pointing at the deleted worked examples. A `§NN` pointer is
# only dangling if NN is the number the build section took over — every other
# section is still there and still says what it always said.
for path in sorted(glob.glob("topics/*.html")):
    slug = os.path.basename(path)[:-5]
    src = open(path, encoding="utf-8").read()
    if slug not in WORKED_EXAMPLE_OK and re.search(r"worked example", re.sub(r"<[^>]+>", " ", src), re.I):
        problems.append(f"{slug}: prose still says 'worked example'")
    build_num = EXPECTED_NUM.get(slug)
    if build_num and f"§{build_num}" in src:
        problems.append(f"{slug}: prose points at §{build_num}, now the Build section")

for n in notes:
    print(f"note  {n}")
for p in problems:
    print(f"FAIL  {p}")
print(f"\n{len(EXPECTED_NUM)} pages checked, {len(problems)} problems, {len(notes)} notes")
sys.exit(1 if problems else 0)
