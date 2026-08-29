# The "Build this" section

Every topic page ended with `<section id="applications">`: a hand-computed
worked example followed by a production use case. The worked examples were the
weakest thing on the site. They are arithmetic a reader skims and forgets, and
they take the place of the one thing that actually teaches a mechanism, which is
building the smallest version of it and watching it behave.

That section becomes `<section id="build">`. **The section number does not
change** — several pages carry `§NN` cross-references keyed to it.

## What makes a project worth putting on the page

**1. It must reveal something you cannot get from reading.** The test: name the
moment the reader sees the concept happen. A diagonal appearing in an attention
heatmap. Loss refusing to drop until the residual connection goes in. Two
clusters separating in a t-SNE plot. If you cannot name that moment, the project
is a homework exercise, not a teaching device.

**2. Trivial task, legible mechanism.** Do not pick an impressive task. Pick a
task so simple that there is exactly one correct answer, so the reader can tell
at a glance whether the mechanism worked. Copying a sequence beats language
modelling. Two Gaussians beat CIFAR-10.

**3. Build the mechanism by hand, not by import.** The reader implements the
thing the page is about from its equation. Everything around it can be a library
call. Calling `nn.MultiheadAttention` on the attention page teaches nothing.

**4. Include a deliberate breakage.** The strongest step is "now remove X and
retrain." Ablation is where intuition comes from: you do not understand what
positional encoding does until you have watched a model fail without it. Tie the
breakage to a claim made earlier on the page.

**5. Hours, not weekends.** Runnable on a laptop CPU or a free Colab T4. State
the estimate honestly. If the concept genuinely needs a GPU, say so.

**6. No fabricated results.** Never state a specific accuracy, loss value, or
runtime the project "will" produce. Describe the *qualitative* outcome, which is
what the success criterion is for. "The heatmap shows a clean diagonal" is
verifiable. "You'll reach 94.2% accuracy" is invented.

## Markup

Worked reference: `topics/08-attention-transformers.html`, `id="build"`.

```html
<section id="build">
  <h2><span class="num">07</span>Build this</h2>
  <p class="lede">One or two sentences on why building beats reading here.</p>

  <div class="project">
    <div class="proj-head">
      <span class="proj-label">Project</span>
      <span class="proj-title">Imperative, specific title</span>
      <span class="proj-meta">~3 hours · PyTorch</span>
    </div>
    <p>What you build and why this task, not another.</p>
    <ol class="proj-steps">
      <li>Five or six steps. The last is the deliberate breakage.</li>
    </ol>
    <div class="proj-done"><strong>You'll know it worked when</strong> …</div>
    <div class="proj-stretch"><strong>What the breakage teaches.</strong> …</div>
  </div>

  <h3>Where this runs in production</h3>
  <!-- the existing production-use-case prose, kept verbatim -->
</section>
```

`proj-meta` is `~N hours · <tool>`. Keep `proj-steps` to 5–6 items.

## What to keep from the old section

Delete only the worked-example subsection: the hand-computed arithmetic and its
`eq-block`s. **Keep the production use case verbatim**, retitled
`<h3>Where this runs in production</h3>`. If a page's `id="applications"`
section contains a third subsection that is not a worked example — page 15's
"Why DQN needs a replay buffer and a target network" is real teaching content —
keep that too, above the project.

Prose follows `docs/STYLE.md`: short sentences, bold the load-bearing term,
em-dashes are a last resort.
