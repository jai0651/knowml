#!/usr/bin/env python3
"""Insert the Deep-ML practice block into each topic page, from
content/practice.json. Idempotent: an existing block is replaced, so this can
be re-run after the mapping changes."""
import json, re, pathlib, html

DIFF_ORDER = {"easy": 0, "medium": 1, "hard": 2}

def block(page_id, items):
    rows = []
    for it in sorted(items, key=lambda x: (DIFF_ORDER.get(x["difficulty"], 1), x["title"])):
        rows.append(
            '        <a class="dm-item" href="https://www.deep-ml.com/problems/%s" target="_blank" rel="noopener">'
            '<span class="dm-diff dm-%s">%s</span>'
            '<span class="dm-title">%s</span>'
            '<span class="dm-go">Solve <span class="arrow">&rarr;</span></span></a>'
            % (it["id"], it["difficulty"], it["difficulty"], html.escape(it["title"])))
    return (
'  <section id="practice-problems">\n'
'    <h2><span class="num">&#9679;</span>Now write it yourself</h2>\n'
'    <p class="lede">Reading the derivation and being able to produce it are different skills. '
'These are Deep-ML problems that exercise what this page covers &mdash; each one is checked against real test '
'cases, not multiple choice.</p>\n'
'    <div class="dm-list">\n' + "\n".join(rows) + '\n    </div>\n'
'    <p class="dm-foot">Matched to this page from Deep-ML\'s catalogue of 1,380 problems. '
'More at <a href="https://www.deep-ml.com/problems" target="_blank" rel="noopener">deep-ml.com</a>, '
'and <a href="../practice.html">Where to practise</a> covers the other platforms and what each one trains.</p>\n'
'  </section>\n\n')

def main():
    data = json.load(open("content/practice.json"))
    done = 0
    for page_id, items in data.items():
        f = pathlib.Path("topics") / (page_id + ".html")
        if not f.exists():
            print("  no such page:", f); continue
        t = f.read_text()
        t = re.sub(r'  <section id="practice-problems">.*?</section>\n\n', '', t, flags=re.S)
        new = block(page_id, items)
        m = re.search(r'(  <section id="related">)', t)
        if not m:
            m = re.search(r'(  <nav class="prevnext">)', t)
        if not m:
            print("  no anchor in", f); continue
        f.write_text(t[:m.start(1)] + new + t[m.start(1):])
        done += 1
    print(f"practice block written into {done} pages")

if __name__ == "__main__":
    main()
