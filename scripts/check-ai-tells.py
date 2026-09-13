#!/usr/bin/env python3
"""Scan page prose for the AI-writing patterns in WikiProject AI Cleanup's list.

Prose only: code blocks, SVG, script and style are stripped first, so a variable
named `key` or a CSS `landscape` does not count against the text.
"""
import re, glob, html, sys, collections

PATTERNS = {
 "inflated importance": r"\b(stands? as|serves? as|is a testament|testament to|pivotal|underscor\w+|highlights? (the )?(importance|significance)|evolving landscape|marks? a (shift|turning)|indelible|deeply rooted|cements? its)\b",
 "shallow -ing phrase": r",\s+(highlighting|underscoring|emphasi[sz]ing|ensuring|reflecting|symboli[sz]ing|contributing to|fostering|showcasing|encompassing|cultivating)\b",
 "sales language":      r"\b(boasts?|vibrant|breathtaking|renowned|nestled|in the heart of|must-\w+|stunning|profound|groundbreaking)\b",
 "vague sources":       r"\b(industry reports|observers have|experts (argue|believe|say)|some critics|several (sources|publications))\b",
 "overused AI words":   r"\b(delve|crucial|intricac\w+|intricate|tapestry|garner\w*|interplay|showcase\w*|holistic|myriad|plethora|realm of)\b",
 "not X but Y":         r"\b(not (just|only|merely) [^.;]{3,40}(but|it's|it is))\b",
 "deeper-truth":        r"\b(the real question is|at its core|in reality|what really matters|fundamentally,|the heart of the matter)\b",
 "announcing":          r"\b(let's (dive|explore|break this down)|here's what you need to know|without further ado|now let's look)\b",
 "fake-candid open":    r"(^|[.!?]\s)(Honestly\?|Look,|Here's the thing|The thing is,|Let's be honest)",
 "generic uplift":      r"\b(the future looks|exciting times|a major step in the right direction|continues to thrive)\b",
 "filler":              r"\b(in order to|due to the fact that|at this point in time|it is important to note that|has the ability to)\b",
}

def prose(path):
    t = open(path, encoding="utf-8").read()
    m = re.search(r"<main.*?</main>", t, re.S)
    if not m: return ""
    b = m.group(0)
    b = re.sub(r"<pre>.*?</pre>|<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<code>.*?</code>", " ", b, flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", " ", b))

def main():
    files = sorted(glob.glob("topics/*.html"))
    totals = collections.Counter(); per_page = {}
    examples = collections.defaultdict(list)
    words_total = 0
    for f in files:
        p = prose(f); words_total += len(p.split())
        hits = collections.Counter()
        for name, pat in PATTERNS.items():
            for mm in re.finditer(pat, p, re.I):
                hits[name] += 1; totals[name] += 1
                if len(examples[name]) < 3:
                    s = " ".join(p[max(0,mm.start()-58):mm.end()+58].split())
                    examples[name].append(f"{f.split('/')[1][:22]}: …{s}…")
        per_page[f] = sum(hits.values())
    print(f"{len(files)} chapters, {words_total:,} words of prose\n")
    print("tells by kind:")
    for k, n in totals.most_common():
        print(f"  {n:4}  {k}")
    print(f"\n  {sum(totals.values()):4}  TOTAL  ({sum(totals.values())/words_total*1000:.1f} per 1,000 words)\n")
    print("worst pages:")
    for f, n in sorted(per_page.items(), key=lambda x: -x[1])[:8]:
        print(f"  {n:3}  {f}")
    print()
    for k in totals:
        print(f"[{k}]")
        for e in examples[k][:2]: print("   ", e[:150])
    return 0

if __name__ == "__main__":
    sys.exit(main())
