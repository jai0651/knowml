# KnowML prose style

The content is accurate. What it lacks is **texture**: it reads as uniform grey
walls of long, clause-chained sentences with no visual hierarchy. That is the
thing that makes writing feel machine-generated, and it is what this guide
exists to fix.

Measured across the 23 full pages before the editing pass:

| | measured | target |
|---|---|---|
| words per sentence | 31.6 | **16–22**, with deliberate variance |
| em-dashes | 1,688 (0.58/sentence) | **≤ 1 per 5 sentences** |
| bold key terms | 65 (across only 4 pages) | **≥ 6 per page** |
| lists | 23 total | **≥ 2 per page** |
| `em.term` | 0 | use on first definition |
| `callout-teach` | 3 total | **1–3 per page** |
| "actually" | 209 | cut by ~70% |

## The rules

**1. One idea per sentence.** The single biggest problem is a 40-word sentence
chaining three ideas with em-dashes and semicolons. Break it. Vary the length —
a four-word sentence after a twenty-word one is what creates rhythm.

**2. Em-dashes are a last resort.** They are the signature tell. If a clause is
worth an em-dash, it is usually worth a full stop. Use a colon when introducing,
a full stop when separating, brackets for a genuine aside.

**3. Enumerable things become lists.** If a sentence describes a sequence of
steps, a set of options, or a comparison of three things, it is a `<ul>`, not a
comma chain. This is the highest-leverage single change on most pages.

**4. Bold the term being defined; italicise the contrast.**
`<strong>` marks the thing a reader is meant to remember. `<em>` marks emphasis
and contrast (*this*, not *that*). Use `<em class="term">` on the first
definition of a key term — it renders with an accent underline and is currently
unused site-wide.

**5. Give the insight its own box.** Every page has one or two moments where
something genuinely clicks — the example, the analogy, the reframe. Pull those
into `<div class="callout callout-teach">` with a specific label. Not "Key
insight" — a label that says what it is: "The sentence that makes it click",
"Why the naive version fails".

**6. No paragraph over ~70 words.**

**7. Prefer the concrete.** A number, a shape, a named failure beats an
intensifier. Cut "actually", "essentially", "simply", "of course" unless the
word is doing real work.

## Hard constraint

**This is an editing pass, not a rewrite.** Do not change any fact, number,
equation, claim, or external link. Every external link on this site was verified
before it was embedded; leave the URLs exactly as they are. Do not add new
technical claims. If a sentence is wrong you may flag it, but do not invent a
replacement fact.

Keep the existing section anatomy, `id` attributes, diagrams, and KaTeX spans
untouched. You are changing sentence rhythm and visual hierarchy, nothing else.

## Worked reference

See `topics/08-attention-transformers.html`, section `id="intuition"`. Same
facts, same length (248 → 264 words), 24.8 → 10.2 words per sentence, 7 → 0
em-dashes, 0 → 7 bold terms, 0 → 3 list items, and the central example moved
into a teach callout.
