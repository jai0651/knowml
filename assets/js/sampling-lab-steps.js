/* KnowML — Sampling Lab: how a next-token distribution becomes an actual token.
   Five walkthroughs over one seeded example. Every step is one primitive
   operation — one matmul, one subtraction, one exponentiation, one division —
   never several folded together, so stepping through matches tracing it by hand.

   Nothing here is hand-typed: every number in every caption is read back out of
   the live computation in sampling-lab-model.js. */
(function () {
  'use strict';
  var M = window.KMLLabMath, Mo = window.SamplingLabModel, UI = window.KMLLabUI, CFG = Mo.CFG;

  var A = Mo.FOCUSED;   // "The cat sat on the ___" — the model is nearly sure
  var B = Mo.OPEN;      // "On Saturday I went down to the ___" — a dozen fine answers

  // ---------- formatting helpers (display only; never used to produce a value) ----------
  var f1 = function (x) { return x.toFixed(1); };
  var f2 = function (x) { return x.toFixed(2); };
  var f3 = function (x) { return x.toFixed(3); };
  var f4 = function (x) { return x.toFixed(4); };
  var fe = function (x) { return x.toExponential(1); };
  var zeroOr = function (x) { return x === 0 ? 'exactly 0' : fe(x); };
  var pct = function (x) { return (x * 100).toFixed(1) + '%'; };
  var R2 = function (m) { return m.map(function (r) { return r.map(function (v) { return M.round(v, 2); }); }); };
  var LOGIT_MAXABS = Math.max(Math.abs(Mo.maxOf(A.logits)), Math.abs(Mo.maxOf(A.logits.map(function (v) { return -v; }))));

  var CTX_COLORS = { focused: 'var(--c-attention)', open: 'var(--c-gpu)' };

  // ---------- reusable panels ----------
  function probPanel(ctx, values, opts) {
    opts = opts || {};
    return UI.matrixPanel({
      title: opts.title || 'p — next-token distribution',
      shapeLabel: opts.shapeLabel || ('1 × |V|=' + CFG.V),
      matrix: [values], rowLabels: [opts.rowLabel || 'p'], colLabels: opts.words || ctx.words,
      colorMode: 'prob', mask: opts.mask, badge: opts.badge, dim: opts.dim, fresh: opts.fresh,
      meaning: opts.meaning
    });
  }
  function sortedPanel(ctx, values, opts) {
    opts = opts || {};
    return UI.matrixPanel({
      title: opts.title, shapeLabel: opts.shapeLabel || ('1 × |V|=' + CFG.V),
      matrix: [values], rowLabels: [opts.rowLabel || 'p'], colLabels: ctx.sortedWords,
      colorMode: 'prob', mask: opts.mask, badge: opts.badge || 'sorted by probability, descending',
      dim: opts.dim, fresh: opts.fresh, meaning: opts.meaning
    });
  }
  function logitPanel(ctx, values, opts) {
    opts = opts || {};
    return UI.matrixPanel({
      title: opts.title || 'z — logits', shapeLabel: opts.shapeLabel || ('1 × |V|=' + CFG.V),
      matrix: R2([values]), rowLabels: [opts.rowLabel || 'z'], colLabels: opts.words || ctx.words,
      colorMode: 'diverging', maxAbs: opts.maxAbs || LOGIT_MAXABS, badge: opts.badge,
      dim: opts.dim, fresh: opts.fresh, meaning: opts.meaning
    });
  }
  function promptStrip(ctx) {
    var wrap = UI.el('div', 'lab-textcard');
    wrap.innerHTML = '<strong>' + ctx.prompt + '</strong> <span style="opacity:.55">___</span> &nbsp;·&nbsp; ' +
      CFG.V + ' candidate next tokens, listed alphabetically so nothing on this page arrives pre-sorted.';
    return wrap;
  }
  function tokenChips(ctx, values, keep, opts) {
    opts = opts || {};
    var wrap = UI.el('div', 'lab-tokens');
    var idx = opts.order || ctx.words.map(function (_, i) { return i; });
    idx.forEach(function (i) {
      var kept = keep ? keep[i] : true;
      var chip = UI.el('div', 'lab-token' + (kept ? ' lab-token--active' : ''));
      chip.style.setProperty('--tc', kept ? 'var(--c-practice)' : 'var(--know-cold)');
      chip.style.opacity = kept ? '1' : '.55';
      chip.innerHTML = '<span class="lab-token-word">' + ctx.words[i] + '</span>' +
        '<span class="lab-token-id">' + (values ? f3(values[i]) : '') + '</span>';
      wrap.appendChild(chip);
    });
    return wrap;
  }
  /* A |V|-wide row is ~520px, so four of them side by side would need 2,100px and
     the stage would scroll sideways. .lab-heads-group is flex-shrink:0, so it
     sizes to max-content unless told otherwise; capping it lets .lab-heads-row do
     the wrapping it was already set up for. */
  function headsPanel(opts) {
    var g = UI.headsPanel(opts);
    g.style.maxWidth = '100%';
    g.style.flexBasis = '100%';
    return g;
  }
  function badgeStack(badges) {
    var wrap = UI.el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;align-items:flex-start;';
    badges.forEach(function (b) { wrap.appendChild(b); });
    return wrap;
  }
  function table(headers, rows, highlightRow) {
    var t = UI.el('table', 'lab-table');
    t.innerHTML = '<thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>';
    var tb = UI.el('tbody');
    rows.forEach(function (r, i) {
      var tr = UI.el('tr', i === highlightRow ? 'lab-row--highlight' : '');
      tr.innerHTML = r.map(function (c) { return '<td>' + c + '</td>'; }).join('');
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    var wrap = UI.el('div', 'lab-panel');
    wrap.appendChild(t);
    return wrap;
  }

  // ---------- computed once, shared by the tabs ----------
  var CHECKS = Mo.stabilityChecks(A);
  var STRAW = Mo.naiveNormalise(A.logits);
  var TEMPS_A = Mo.temperatureSweep(A, CFG.temps);
  var TEMPS_B = Mo.temperatureSweep(B, CFG.temps);
  var LIMITS_A = Mo.temperatureSweep(A, CFG.tempLimits);
  var LIMITS_B = Mo.temperatureSweep(B, CFG.tempLimits);
  var KS_A = Mo.kSweep(A, CFG.kSweep);
  var KS_B = Mo.kSweep(B, CFG.kSweep);
  var TK_A = Mo.topK(A.probs, CFG.k), TK_B = Mo.topK(B.probs, CFG.k);
  var TP_A = Mo.topP(A.probs, CFG.p), TP_B = Mo.topP(B.probs, CFG.p);
  var ONLY_K_A = Mo.setDiff(TK_A.keptIdx, TP_A.keptIdx), ONLY_P_A = Mo.setDiff(TP_A.keptIdx, TK_A.keptIdx);
  var ONLY_K_B = Mo.setDiff(TK_B.keptIdx, TP_B.keptIdx), ONLY_P_B = Mo.setDiff(TP_B.keptIdx, TK_B.keptIdx);
  var STACK = Mo.samplerStack(B, CFG.stackT, CFG.stackK, CFG.stackP);
  var RUN = Mo.sampleRun(B.probs, CFG.draws, CFG.drawSeed, CFG.drawStages, CFG.showDraws);
  var MAXH = Math.log2(CFG.V);
  var UNIFORM = 1 / CFG.V;
  var wordsOf = function (ctx, idxs) { return idxs.map(function (i) { return ctx.words[i]; }); };
  var listWords = function (ctx, idxs) {
    var w = wordsOf(ctx, idxs);
    return w.length ? '"' + w.join('", "') + '"' : 'nothing';
  };
  var sameOrder = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  // ============================================================ SOFTMAX ============================================================
  function buildSoftmax() {
    var steps = [];
    var sm = A.softmax;

    steps.push({
      title: 'The one question this page answers',
      formula: null,
      note: 'A transformer has just finished its last layer. What it holds is a single vector of numbers for the current position — not a word, not a probability, just a vector. Turning that into the token you actually see is the job of four operations: <strong>unembed → softmax → truncate → draw</strong>. This tab does the first two. Everything below runs on the prompt <strong>' + A.prompt + ' ___</strong> with ' + CFG.V + ' candidate next tokens.',
      render: function (stage) {
        stage.appendChild(promptStrip(A));
        stage.appendChild(tokenChips(A, null, null));
      }
    });

    steps.push({
      title: 'What the model actually hands you: one hidden state',
      formula: 'h \\in \\mathbb{R}^{1 \\times d_{model}}',
      note: 'One row, <span>$d_{model}=' + CFG.dModel + '$</span> wide — the last layer\'s output at the last position. It carries no vocabulary information at all yet: nothing in these ' + CFG.dModel + ' numbers knows what a "mat" is.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({
          title: 'h — final hidden state', shapeLabel: '1 × d_model=' + CFG.dModel,
          matrix: R2(A.h), rowLabels: ['h'], colLabels: A.h[0].map(function (_, i) { return 'd' + i; }),
          fresh: true, meaning: 'The entire state of the model at this position, compressed to ' + CFG.dModel + ' numbers. Real models use thousands.'
        }));
      }
    });

    steps.push({
      title: 'Unembedding: one dot product per candidate token',
      formula: 'z = h W_U \\in \\mathbb{R}^{1 \\times |V|}',
      note: 'The unembedding matrix <code>W_U</code> has one column per vocabulary token. Multiplying gives one number per token — the <strong>logit</strong>. Column <span>$j$</span> of the product is literally <span>$h \\cdot W_U[:,j]$</span>: how well the hidden state lines up with token <span>$j$</span>\'s direction. The largest logit here is <strong>' + f2(A.logits[A.argmax]) + '</strong> on "' + A.words[A.argmax] + '"; the smallest is ' + f2(Mo.maxOf(A.logits.map(function (v) { return -v; })) * -1) + '.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'h', shapeLabel: '1 × ' + CFG.dModel, matrix: R2(A.h), rowLabels: ['h'], dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_U (' + CFG.dModel + '×' + CFG.V + ')'));
        stage.appendChild(UI.matrixPanel({
          title: 'W_U — unembedding', shapeLabel: 'd_model=' + CFG.dModel + ' × |V|=' + CFG.V,
          matrix: R2(A.WU), rowLabels: A.WU.map(function (_, i) { return 'd' + i; }), colLabels: A.words,
          colorMode: 'diverging', maxAbs: CFG.hi, dim: true,
          meaning: 'One column per candidate token. In a real model this matrix is most of the parameter count at the output end.'
        }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(logitPanel(A, A.logits, { fresh: true, meaning: 'Unbounded and signed. Not probabilities — not yet, and not by any amount of wishing.' }));
      }
    });

    steps.push({
      title: 'Why you cannot just divide by the sum',
      formula: 'q_i = \\frac{z_i}{\\sum_j z_j} \\quad \\text{— sums to 1, and is nonsense}',
      note: 'The obvious way to normalise anything is to divide by its total. It fails here for a reason worth seeing rather than being told: the logits sum to <strong>' + f2(STRAW.sum) + '</strong>, which is <em>negative</em>, so dividing flips every sign. The winning token "' + A.words[A.argmax] + '" ends up with the most negative "probability" of all (' + f2(STRAW.row[A.argmax]) + '), and the row still sums to exactly 1. Summing to 1 is necessary, not sufficient — you also need every entry non-negative, and you need the order preserved.',
      render: function (stage) {
        stage.appendChild(logitPanel(A, A.logits, { dim: true }));
        stage.appendChild(UI.arrow('÷', 'Σz = ' + f2(STRAW.sum)));
        stage.appendChild(UI.matrixPanel({
          title: 'z / Σz — the strawman', shapeLabel: '1 × |V|=' + CFG.V,
          matrix: R2([STRAW.row]), rowLabels: ['q'], colLabels: A.words,
          colorMode: 'diverging', maxAbs: 2, fresh: true,
          meaning: 'Six of these are negative. A distribution this is not.'
        }));
        stage.appendChild(UI.checkBadge(false, 'sums to ' + f2(Mo.sum(STRAW.row)) + ' and is still not a distribution'));
      }
    });

    steps.push({
      title: 'Softmax, step 1 of 3: subtract the max',
      formula: 'z\'_i = z_i - \\max_j z_j',
      note: 'Exponentiating is what makes every entry positive, and softmax is <strong>shift-invariant</strong>: adding the same constant to every logit changes nothing about the answer, because the constant factors out of the numerator and denominator alike. So you are free to shift by whatever you like — and the useful choice is <span>$-\\max_j z_j$</span>, which puts the largest entry at exactly 0 and every other entry below it. Here <span>$\\max_j z_j = ' + f2(sm.max) + '$</span>. The next-but-one step shows what happens if you skip this.',
      render: function (stage) {
        stage.appendChild(logitPanel(A, A.logits, { dim: true }));
        stage.appendChild(UI.arrow('−', 'max z = ' + f2(sm.max)));
        stage.appendChild(logitPanel(A, sm.shifted, {
          title: 'z − max z', rowLabel: 'z\'', fresh: true, maxAbs: LOGIT_MAXABS * 2,
          meaning: 'Every entry is now ≤ 0, and exactly one entry is 0 — the argmax. Nothing about the eventual answer has changed.'
        }));
      }
    });

    steps.push({
      title: 'Softmax, step 2 of 3: exponentiate',
      formula: 'e^{z\'_i} \\in (0, 1]',
      note: 'One <span>$e^x$</span> per entry. Because every shifted logit is at most 0, every exponential lands in <span>$(0,1]$</span> — no overflow is possible, and the largest entry is exactly <span>$e^0 = 1$</span>. This is also the step that makes the gaps multiplicative: a logit gap of ' + f2(A.logits[A.argmax] - A.logits[A.order[1]]) + ' between "' + A.words[A.argmax] + '" and "' + A.words[A.order[1]] + '" becomes a probability <em>ratio</em> of ' + f2(Math.exp(A.logits[A.argmax] - A.logits[A.order[1]])) + '×.',
      render: function (stage) {
        stage.appendChild(logitPanel(A, sm.shifted, { title: 'z − max z', rowLabel: 'z\'', dim: true, maxAbs: LOGIT_MAXABS * 2 }));
        stage.appendChild(UI.arrow('↑', 'exp'));
        stage.appendChild(probPanel(A, sm.exps, {
          title: 'exp(z − max z)', rowLabel: 'e', fresh: true,
          meaning: 'All positive, all ≤ 1. These are unnormalised weights: their relative sizes are already the answer, only the scale is wrong.'
        }));
      }
    });

    steps.push({
      title: 'Softmax, step 3 of 3: divide by the sum',
      formula: 'p_i = \\frac{e^{z_i - \\max_j z_j}}{\\sum_k e^{z_k - \\max_j z_j}}, \\qquad Z = \\sum_k e^{z_k - \\max_j z_j} = ' + f3(sm.Z),
      note: 'One number, <span>$Z = ' + f3(sm.Z) + '$</span>, divides the whole row. That is the entire softmax: shift, exponentiate, normalise. The model now says "' + A.words[A.argmax] + '" with probability <strong>' + pct(A.top1) + '</strong>, "' + A.words[A.order[1]] + '" with ' + pct(A.probs[A.order[1]]) + ', and everything else with the remaining ' + pct(1 - A.top1 - A.probs[A.order[1]]) + '.',
      render: function (stage) {
        stage.appendChild(probPanel(A, sm.exps, { title: 'exp(z − max z)', rowLabel: 'e', dim: true }));
        stage.appendChild(UI.arrow('÷', 'Z = ' + f3(sm.Z)));
        stage.appendChild(probPanel(A, A.probs, {
          fresh: true,
          meaning: 'A real distribution at last: every entry in [0,1], the whole row summing to 1, and the ranking identical to the logits it came from.'
        }));
      }
    });

    steps.push({
      title: 'Self-check 1: is this actually a probability distribution?',
      formula: '\\left|\\sum_i p_i - 1\\right| = ' + (CHECKS.sumErr === 0 ? '0' : fe(CHECKS.sumErr)),
      note: 'Three things have to hold, and none of them are taken on trust. The row must sum to 1 to within floating point; every entry must be in <span>$[0,1]$</span>; and the ranking must be unchanged from the logits, since softmax is monotonic. The third is the one the strawman two steps ago failed. For good measure the hand-written trace above is also compared against the shared engine\'s own <code>softmaxRows()</code> — two independent code paths, one answer.',
      render: function (stage) {
        stage.appendChild(probPanel(A, A.probs, { dim: true }));
        var allIn = A.probs.every(function (v) { return v >= 0 && v <= 1; });
        var ranksMatch = sameOrder(Mo.orderDesc(A.probs), Mo.orderDesc(A.logits));
        stage.appendChild(badgeStack([
          UI.checkBadge(CHECKS.sumErr < 1e-12, 'Σp = ' + Mo.sum(A.probs).toFixed(15) + '  (error ' + zeroOr(CHECKS.sumErr) + ')'),
          UI.checkBadge(allIn, 'every entry in [0, 1] — min ' + f3(Math.min.apply(null, A.probs)) + ', max ' + f3(A.top1)),
          UI.checkBadge(ranksMatch, 'ranking preserved — softmax is monotonic, argmax is still "' + A.words[A.argmax] + '"'),
          UI.checkBadge(CHECKS.frameworkDiff < 1e-12, 'matches the engine\'s softmaxRows() — max |Δ| = ' + zeroOr(CHECKS.frameworkDiff))
        ]));
      }
    });

    steps.push({
      title: 'Self-check 2: the max subtraction is not decoration',
      formula: '\\text{softmax}(z + c) = \\text{softmax}(z) \\quad \\text{for any } c',
      note: 'On this well-conditioned row, the naive version — exponentiate the raw logits, then divide — agrees with the stable one to <strong>' + (CHECKS.naiveDiff === 0 ? 'exactly 0' : fe(CHECKS.naiveDiff)) + '</strong>. So subtracting the max costs nothing and changes nothing, here. Now add ' + CHECKS.shift + ' to every logit. Mathematically that is the identity — softmax is shift-invariant — and the stable version indeed returns the same distribution to <strong>' + fe(CHECKS.shiftInvariantDiff) + '</strong>. The naive version returns <strong>NaN</strong> for every token, because <span>$e^{' + f2(Mo.maxOf(CHECKS.big)) + '}$</span> is not representable and <span>$\\infty/\\infty$</span> is undefined. Double precision gives up at <span>$e^{' + CHECKS.overflowAt + '}$</span>; float32 at <span>$e^{' + f2(CHECKS.fp32Limit) + '}$</span>; float16 — what inference actually runs in — at <span>$e^{' + f2(CHECKS.fp16Limit) + '}$</span>, a logit gap you can hit by accident.',
      render: function (stage) {
        var wrap = UI.el('div', 'lab-heads-group');
        wrap.appendChild(UI.el('div', 'lab-heads-group-title', 'well-conditioned input — the two routes agree'));
        var r1 = UI.el('div', 'lab-heads-row');
        r1.appendChild(probPanel(A, A.probs, { title: 'stable: exp(z − max z) / Z', rowLabel: 'p' }));
        r1.appendChild(probPanel(A, CHECKS.naiveProbs, { title: 'naive: exp(z) / Z', rowLabel: 'p' }));
        wrap.appendChild(r1);
        wrap.appendChild(badgeStack([UI.checkBadge(CHECKS.naiveDiff < 1e-12, 'identical — max |Δ| = ' + zeroOr(CHECKS.naiveDiff))]));
        stage.appendChild(wrap);

        var w2 = UI.el('div', 'lab-heads-group');
        w2.appendChild(UI.el('div', 'lab-heads-group-title', 'the same logits, shifted by +' + CHECKS.shift));
        w2.appendChild(table(
          ['token', 'z + ' + CHECKS.shift, 'naive: exp(z+c)', 'stable: exp(z+c − max)', 'naive p', 'stable p'],
          A.order.slice(0, 4).map(function (i) {
            return [A.words[i], f2(CHECKS.big[i]), String(CHECKS.naiveBigExps[i]),
                    f3(Math.exp(CHECKS.big[i] - Mo.maxOf(CHECKS.big))), String(CHECKS.naiveBigProbs[i]), f3(CHECKS.stableBigProbs[i])];
          })
        ));
        w2.appendChild(badgeStack([
          UI.checkBadge(CHECKS.naiveBroke, 'naive overflowed: Z = ' + String(CHECKS.naiveBigZ) + ', every probability NaN'),
          UI.checkBadge(CHECKS.shiftInvariantDiff < 1e-12, 'stable version unchanged by the shift — max |Δ| = ' + zeroOr(CHECKS.shiftInvariantDiff))
        ]));
        stage.appendChild(w2);
      }
    });

    steps.push({
      title: 'One number for the shape of a distribution: entropy',
      formula: 'H(p) = -\\sum_i p_i \\log_2 p_i \\quad \\text{bits}, \\qquad 0 \\le H \\le \\log_2 |V| = ' + f2(MAXH),
      note: 'Everything the rest of this lab does — temperature, top-k, top-p — is a way of reshaping this one curve, so it helps to have a single number for how peaked it is. This row sits at <strong>' + f2(A.entropy) + ' bits</strong> against a ceiling of ' + f2(MAXH) + ', which is to say it behaves like a choice between <strong>' + f2(Math.pow(2, A.entropy)) + '</strong> equally-likely tokens rather than ' + CFG.V + '. The second context used later on this page — <em>' + B.prompt + ' ___</em> — sits at ' + f2(B.entropy) + ' bits, or ' + f2(Math.pow(2, B.entropy)) + ' effective choices. Same vocabulary size, completely different problem.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Entropy (bits)', unit: ' bits',
          items: [
            { label: 'uniform over ' + CFG.V + ' tokens — the ceiling', value: M.round(MAXH, 2), colorVar: 'var(--c-efficient)' },
            { label: '"' + B.prompt + ' ___" (the open context)', value: M.round(B.entropy, 2), colorVar: CTX_COLORS.open },
            { label: '"' + A.prompt + ' ___" (this one)', value: M.round(A.entropy, 2), colorVar: CTX_COLORS.focused }
          ],
          meaning: 'Low entropy means the decision is nearly made. High entropy means the sampler\'s settings are about to matter a great deal.'
        }));
        stage.appendChild(UI.textCard('Keep the gap between these two rows in mind — <strong>' + f2(A.entropy) + '</strong> bits against <strong>' + f2(B.entropy) + '</strong> bits. The top-p tab is entirely an argument about what a single fixed setting does to two distributions this far apart.'));
      }
    });

    return steps;
  }

  // ============================================================ TEMPERATURE ============================================================
  function buildTemperature() {
    var steps = [];
    var T1 = TEMPS_A.filter(function (t) { return t.T === 1; })[0];

    steps.push({
      title: 'Temperature is one division, applied before the softmax',
      formula: 'p_i(T) = \\text{softmax}(z/T)_i = \\frac{e^{z_i/T}}{\\sum_j e^{z_j/T}}',
      note: 'It does not touch the probabilities. It divides the <strong>logits</strong>, and the softmax then does what it always does. That ordering is the whole mechanism: dividing logits by <span>$T<1$</span> stretches the gaps between them, and since the exponential turns gaps into ratios, stretched gaps mean a sharper distribution. Dividing by <span>$T>1$</span> compresses the gaps toward zero, and equal logits mean a uniform distribution.',
      render: function (stage) {
        stage.appendChild(logitPanel(A, A.logits, { dim: true, meaning: 'The logits from the previous tab — unchanged.' }));
        stage.appendChild(UI.arrow('÷', 'T = ' + CFG.temps[1]));
        stage.appendChild(logitPanel(A, TEMPS_A[1].scaled, {
          title: 'z / T', rowLabel: 'z/T', fresh: true, maxAbs: LOGIT_MAXABS * 2,
          meaning: 'Same signs, same order, bigger spread. The gap between the top two logits went from ' + f2(A.logits[A.order[0]] - A.logits[A.order[1]]) + ' to ' + f2(TEMPS_A[1].scaled[A.order[0]] - TEMPS_A[1].scaled[A.order[1]]) + '.'
        }));
      }
    });

    CFG.temps.forEach(function (T, ti) {
      var s = TEMPS_A[ti];
      var isOne = T === 1;
      var note;
      if (T < 1) {
        note = 'Dividing by <span>$T=' + T + '$</span> multiplies every logit by ' + f2(1 / T) + '. The top-1 probability goes from ' + pct(A.top1) + ' at <span>$T=1$</span> to <strong>' + pct(s.top1) + '</strong>, and the runner-up "' + A.words[A.order[1]] + '" collapses from ' + pct(A.probs[A.order[1]]) + ' to ' + (s.probs[A.order[1]] < 0.001 ? fe(s.probs[A.order[1]]) : pct(s.probs[A.order[1]])) + '. Entropy: ' + f2(A.entropy) + ' → <strong>' + f2(s.entropy) + ' bits</strong>.';
      } else if (isOne) {
        note = '<span>$T=1$</span> divides by one. It is the identity, and the row below is bit-for-bit the row the previous tab produced — checked, not asserted. This matters because "temperature 1" is not a neutral-sounding default someone picked: it is literally the absence of the operation.';
      } else {
        note = 'Dividing by <span>$T=' + T + '$</span> halves every logit, which shrinks every gap. The top-1 probability drops from ' + pct(A.top1) + ' to <strong>' + pct(s.top1) + '</strong>, and tokens that were rounding errors become live options — "' + A.words[A.order[4]] + '" goes from ' + pct(A.probs[A.order[4]]) + ' to ' + pct(s.probs[A.order[4]]) + '. Entropy: ' + f2(A.entropy) + ' → <strong>' + f2(s.entropy) + ' bits</strong>, against a ceiling of ' + f2(MAXH) + '.';
      }
      steps.push({
        title: 'T = ' + T + (T < 1 ? ' — sharpening' : isOne ? ' — the identity' : ' — flattening'),
        formula: 'p = \\text{softmax}(z / ' + T + ')',
        note: note,
        render: function (stage) {
          stage.appendChild(logitPanel(A, s.scaled, { title: 'z / ' + T, rowLabel: 'z/T', maxAbs: LOGIT_MAXABS * (T < 1 ? 5 : 1) }));
          stage.appendChild(UI.arrow('→', 'softmax'));
          stage.appendChild(probPanel(A, s.probs, {
            title: 'p at T = ' + T, fresh: true,
            badge: 'top-1 ' + pct(s.top1) + ' · H = ' + f2(s.entropy) + ' bits',
            meaning: isOne ? 'Identical to the softmax tab\'s output — see the badge below.' : 'Same ranking as T = 1. Only the spacing changed.'
          }));
          if (isOne) {
            stage.appendChild(UI.checkBadge(Mo.maxDev(s.probs, A.probs) === 0,
              'bit-for-bit identical to the T = 1 row on the softmax tab — max |Δ| = ' + (Mo.maxDev(s.probs, A.probs) === 0 ? 'exactly 0' : fe(Mo.maxDev(s.probs, A.probs)))));
          }
        }
      });
    });

    steps.push({
      title: 'The four rows side by side',
      formula: null,
      note: 'Read down any one column and you can watch a single token\'s probability move. "' + A.words[A.argmax] + '" goes ' + CFG.temps.map(function (T, i) { return pct(TEMPS_A[i].probs[A.argmax]); }).join(' → ') + ' as <span>$T$</span> goes ' + CFG.temps.join(' → ') + '. Everything else moves the opposite way, because the row has to keep summing to 1 — probability taken from the leader has to land somewhere.',
      render: function (stage) {
        stage.appendChild(headsPanel({
          title: 'The same logits at four temperatures',
          heads: TEMPS_A.map(function (s) {
            return {
              title: 'T = ' + s.T, shapeLabel: '1 × ' + CFG.V, matrix: [s.probs],
              rowLabels: ['p'], colLabels: A.words, colorMode: 'prob',
              badge: 'H = ' + f2(s.entropy) + ' bits'
            };
          }),
          groupMeaning: 'Four rows, one set of logits. Every row sums to 1; only the shape differs.'
        }));
      }
    });

    steps.push({
      title: 'Entropy makes the trend a single curve',
      formula: 'H(p(T)) \\nearrow \\text{ with } T',
      note: 'Entropy rises monotonically with temperature, from ' + f2(TEMPS_A[0].entropy) + ' bits at <span>$T=' + CFG.temps[0] + '$</span> to ' + f2(TEMPS_A[TEMPS_A.length - 1].entropy) + ' bits at <span>$T=' + CFG.temps[CFG.temps.length - 1] + '$</span>, with the ceiling at <span>$\\log_2 ' + CFG.V + ' = ' + f2(MAXH) + '$</span>. This is the honest description of what the knob does: it is an entropy dial, not a "creativity" dial. Nothing about it knows which token is a good idea.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Entropy vs temperature', unit: ' bits',
          items: TEMPS_A.map(function (s) {
            return { label: 'T = ' + s.T, value: M.round(s.entropy, 2), colorVar: CTX_COLORS.focused };
          }).concat([{ label: 'uniform ceiling', value: M.round(MAXH, 2), colorVar: 'var(--c-efficient)' }]),
          meaning: 'Monotonic in T, for any starting distribution.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Top-1 probability vs temperature', unit: '',
          items: TEMPS_A.map(function (s) {
            return { label: 'T = ' + s.T + ' — "' + A.words[s.argmax] + '"', value: M.round(s.top1, 3), colorVar: CTX_COLORS.focused };
          }),
          meaning: 'The mirror image of the entropy chart.'
        }));
      }
    });

    steps.push({
      title: 'The two limits: greedy at one end, uniform at the other',
      formula: '\\lim_{T \\to 0^+} p(T) = \\text{onehot}(\\arg\\max_i z_i), \\qquad \\lim_{T \\to \\infty} p(T) = \\tfrac{1}{|V|}',
      note: 'At <span>$T=' + CFG.tempLimits[0] + '$</span> the top token holds ' + pct(LIMITS_A[0].top1) + ' and the row is a one-hot vector in all but name — which is to say <strong>greedy decoding is temperature 0</strong>, not a separate algorithm. At <span>$T=' + CFG.tempLimits[1] + '$</span> every token sits at ' + f3(LIMITS_A[1].probs[0]) + ', against the exact uniform value <span>$1/' + CFG.V + ' = ' + f3(UNIFORM) + '$</span> — the logits have been divided into irrelevance. Note how fast the first limit arrives: it depends on the <em>logit gaps</em>, and this context\'s top gap is a comfortable ' + f2(A.logits[A.order[0]] - A.logits[A.order[1]]) + '.',
      render: function (stage) {
        stage.appendChild(probPanel(A, LIMITS_A[0].probs, {
          title: 'T = ' + CFG.tempLimits[0] + ' (→ 0)', fresh: true, badge: 'H = ' + f2(LIMITS_A[0].entropy) + ' bits',
          meaning: 'Greedy. The argmax takes everything; nothing else is ever drawn.'
        }));
        stage.appendChild(probPanel(A, LIMITS_A[1].probs, {
          title: 'T = ' + CFG.tempLimits[1] + ' (→ ∞)', fresh: true, badge: 'H = ' + f2(LIMITS_A[1].entropy) + ' bits',
          meaning: 'Uniform noise. The model\'s opinion has been divided away.'
        }));
        stage.appendChild(UI.checkBadge(Math.abs(LIMITS_A[1].probs[0] - UNIFORM) < 0.01,
          'flat row is within ' + fe(Math.abs(LIMITS_A[1].probs[0] - UNIFORM)) + ' of exactly 1/' + CFG.V));
      }
    });

    steps.push({
      title: 'What temperature can never do: change the ranking',
      formula: 'z_i > z_j \\iff z_i/T > z_j/T \\quad \\text{for all } T > 0',
      note: 'Dividing by a positive number preserves order, and softmax is monotonic, so the <em>ranking</em> of tokens is identical at every temperature — verified below across all ' + (CFG.temps.length + CFG.tempLimits.length) + ' temperatures on this page. This is worth holding onto, because it means temperature alone can never promote a token past another one. If a token is ranked 7th, no temperature makes it the most likely; a high temperature only makes it more likely to be <em>drawn</em>. And the argmax is the same token at every temperature, which is exactly why greedy decoding and <span>$T \\to 0$</span> are the same thing.',
      render: function (stage) {
        var all = TEMPS_A.concat(LIMITS_A);
        var allSame = all.every(function (s) { return sameOrder(s.order, A.order); });
        stage.appendChild(table(
          ['T', 'rank 1', 'rank 2', 'rank 3', 'rank 4', 'argmax', 'order = T=1 order?'],
          all.map(function (s) {
            return [String(s.T)].concat(s.order.slice(0, 4).map(function (i) { return A.words[i]; }))
              .concat([A.words[s.argmax], sameOrder(s.order, A.order) ? 'yes' : 'NO']);
          })
        ));
        stage.appendChild(UI.checkBadge(allSame, 'identical ranking at every temperature tested — ' + all.map(function (s) { return 'T=' + s.T; }).join(', ')));
      }
    });

    steps.push({
      title: 'The same T means different things in different contexts',
      formula: null,
      note: 'Here is the same four-temperature sweep on the other context, <em>' + B.prompt + ' ___</em>, which starts at ' + f2(B.entropy) + ' bits instead of ' + f2(A.entropy) + '. At <span>$T=' + CFG.temps[0] + '$</span> the focused context is already decided (' + pct(TEMPS_A[0].top1) + ' on one token) while this one is still a near coin-flip: ' + pct(TEMPS_B[0].probs[B.order[0]]) + ' on "' + B.words[B.order[0]] + '" against ' + pct(TEMPS_B[0].probs[B.order[1]]) + ' on "' + B.words[B.order[1]] + '". Even at <span>$T=' + CFG.tempLimits[0] + '$</span> it has only reached ' + pct(LIMITS_B[0].top1) + ', because its top two logits differ by just ' + f2(B.logits[B.order[0]] - B.logits[B.order[1]]) + '. <strong>A temperature setting is not a level of randomness</strong> — it is a multiplier on a gap you do not control.',
      render: function (stage) {
        stage.appendChild(headsPanel({
          title: 'Open context — ' + B.prompt + ' ___',
          heads: TEMPS_B.map(function (s) {
            return {
              title: 'T = ' + s.T, shapeLabel: '1 × ' + CFG.V, matrix: [s.probs],
              rowLabels: ['p'], colLabels: B.words, colorMode: 'prob',
              badge: 'top-1 ' + pct(s.top1) + ' · H = ' + f2(s.entropy) + ' bits'
            };
          }),
          groupMeaning: 'Compare the T = ' + CFG.temps[0] + ' panel here (H = ' + f2(TEMPS_B[0].entropy) + ' bits) with the T = ' + CFG.temps[0] + ' panel on the focused context (H = ' + f2(TEMPS_A[0].entropy) + ' bits). Same knob, same setting, entirely different outcome.'
        }));
      }
    });

    return steps;
  }

  // ============================================================ TOP-K ============================================================
  function buildTopK() {
    var steps = [];
    var kFull = KS_A[KS_A.length - 1];

    steps.push({
      title: 'Sort the distribution, descending',
      formula: '\\text{order} = \\arg\\text{sort}_{\\downarrow}(p)',
      note: 'Every truncation method starts here, and it is the only part they share. On the focused context the sorted row falls off a cliff after the first entry: ' + A.sortedProbs.slice(0, 4).map(function (v) { return f3(v); }).join(', ') + ', …  A real implementation does not sort all ' + CFG.V + ' — for top-k it only needs a partial selection of the k largest, which is why top-k is the cheaper of the two methods on a 100k-token vocabulary.',
      render: function (stage) {
        stage.appendChild(probPanel(A, A.probs, { dim: true, title: 'p — alphabetical order' }));
        stage.appendChild(UI.arrow('⇅', 'sort desc'));
        stage.appendChild(sortedPanel(A, A.sortedProbs, {
          title: 'p — sorted', fresh: true,
          meaning: 'Same ' + CFG.V + ' numbers, reordered. "' + A.sortedWords[0] + '" at ' + pct(A.sortedProbs[0]) + ', then a long tail.'
        }));
      }
    });

    steps.push({
      title: 'Keep the k = ' + CFG.k + ' highest, zero everything else',
      formula: '\\mathcal{V}_k = \\{\\text{the } k \\text{ tokens with largest } p_i\\}, \\qquad \\tilde{p}_i = p_i \\cdot \\mathbf{1}[i \\in \\mathcal{V}_k]',
      note: 'A hard cut at a fixed position. The surviving set is ' + listWords(A, TK_A.keptIdx) + ', holding <strong>' + pct(TK_A.mass) + '</strong> of the mass between them; the ' + (CFG.V - CFG.k) + ' tokens below the line are set to zero and can never be drawn, however reasonable they were. Here that discards ' + pct(TK_A.dropped) + ' — but note that the cut lands wherever rank ' + CFG.k + ' happens to be, with no reference to what the probabilities actually look like.',
      render: function (stage) {
        stage.appendChild(sortedPanel(A, A.sortedProbs, { title: 'p — sorted', dim: true }));
        stage.appendChild(UI.arrow('✂︎', 'keep k = ' + CFG.k));
        stage.appendChild(sortedPanel(A, A.sortedProbs, {
          title: 'p, truncated', fresh: true,
          mask: [A.sortedProbs.map(function (_, r) { return r >= CFG.k; })],
          badge: 'kept mass = ' + f3(TK_A.mass) + ' · dropped = ' + f3(TK_A.dropped),
          meaning: 'Dotted cells are zeroed. The kept cells still sum to ' + f3(TK_A.mass) + ', not 1 — which is the next step\'s problem.'
        }));
      }
    });

    steps.push({
      title: 'Renormalise: divide the survivors by their own mass',
      formula: 'p\'_i = \\frac{\\tilde{p}_i}{\\sum_{j \\in \\mathcal{V}_k} p_j} = \\frac{\\tilde{p}_i}{' + f3(TK_A.mass) + '}',
      note: 'The truncated row sums to ' + f3(TK_A.mass) + ', so every survivor is scaled up by <span>$1/' + f3(TK_A.mass) + ' = ' + f3(TK_A.scale) + '$</span>. That factor is the same for all of them, so the relative odds inside the surviving set are untouched — the ' + pct(TK_A.dropped) + ' taken from the tail is redistributed strictly in proportion to what each survivor already had.',
      render: function (stage) {
        stage.appendChild(sortedPanel(A, A.sortedProbs, {
          title: 'p, truncated', dim: true, mask: [A.sortedProbs.map(function (_, r) { return r >= CFG.k; })]
        }));
        stage.appendChild(UI.arrow('÷', f3(TK_A.mass)));
        stage.appendChild(sortedPanel(A, A.order.map(function (i) { return TK_A.renorm[i]; }), {
          title: 'p′ — renormalised', fresh: true,
          mask: [A.sortedProbs.map(function (_, r) { return r >= CFG.k; })],
          badge: 'Σp′ = ' + TK_A.total.toFixed(12),
          meaning: 'A valid distribution again, now over ' + CFG.k + ' tokens instead of ' + CFG.V + '.'
        }));
        stage.appendChild(UI.checkBadge(Math.abs(TK_A.total - 1) < 1e-12, 'Σp′ = ' + TK_A.total.toFixed(15) + ' — still a distribution'));
      }
    });

    steps.push({
      title: 'What renormalisation did to each survivor',
      formula: 'p\'_i / p_i = \\frac{1}{' + f3(TK_A.mass) + '} = ' + f3(TK_A.scale) + ' \\quad \\text{(identical for every survivor)}',
      note: 'Worth seeing explicitly, because this is the step people expect to be more interesting than it is. Nothing is reweighted, reranked or redistributed cleverly; every surviving token is multiplied by the same constant. The ratio between any two survivors before and after is unchanged — for instance "' + A.sortedWords[0] + '" : "' + A.sortedWords[1] + '" is ' + f2(A.sortedProbs[0] / A.sortedProbs[1]) + ' before and ' + f2(TK_A.renorm[A.order[0]] / TK_A.renorm[A.order[1]]) + ' after.',
      render: function (stage) {
        stage.appendChild(table(
          ['token', 'p (before)', 'p′ (after)', 'p′ / p'],
          TK_A.keptIdx.map(function (i) {
            return [A.words[i], f3(A.probs[i]), f3(TK_A.renorm[i]), f3(TK_A.renorm[i] / A.probs[i])];
          })
        ));
        stage.appendChild(UI.barsPanel({
          title: 'Before and after, per surviving token',
          items: TK_A.keptIdx.map(function (i) { return { label: '"' + A.words[i] + '" before', value: M.round(A.probs[i], 3), colorVar: 'var(--c-efficient)' }; })
            .concat(TK_A.keptIdx.map(function (i) { return { label: '"' + A.words[i] + '" after', value: M.round(TK_A.renorm[i], 3), colorVar: CTX_COLORS.focused }; })),
          meaning: 'Every bar grew by the same factor, ' + f3(TK_A.scale) + '×.'
        }));
      }
    });

    steps.push({
      title: 'Sweeping k from 1 to |V|',
      formula: '\\mathcal{V}_1 \\subset \\mathcal{V}_2 \\subset \\dots \\subset \\mathcal{V}_{|V|} = V',
      note: 'The two ends are the interesting ones. <span>$k=1$</span> is greedy decoding written a different way — the argmax gets probability 1. <span>$k=|V|=' + CFG.V + '$</span> is no filtering at all, and the row that comes back is the original distribution, bit for bit; that is checked below rather than assumed. Everything in between trades coverage for safety, and on this row the trade is nearly free: ' + KS_A.map(function (s) { return 'k=' + s.k + ' covers ' + pct(s.mass); }).join(', ') + '.',
      render: function (stage) {
        stage.appendChild(headsPanel({
          title: 'p′ after top-k, for five values of k',
          heads: KS_A.map(function (s) {
            return {
              title: 'k = ' + s.k, shapeLabel: '1 × ' + CFG.V,
              matrix: [A.order.map(function (i) { return s.renorm[i]; })],
              rowLabels: ['p′'], colLabels: A.sortedWords, colorMode: 'prob',
              mask: [A.sortedProbs.map(function (_, r) { return r >= s.k; })],
              badge: 'kept ' + pct(s.mass) + ' · ×' + f3(s.scale)
            };
          }),
          groupMeaning: 'Columns are in sorted order, so the cut is always a clean vertical line — which is exactly the problem the next tab is about.'
        }));
        stage.appendChild(badgeStack([
          UI.checkBadge(Mo.maxDev(kFull.renorm, A.probs) === 0,
            'k = |V| = ' + CFG.V + ' returns the untouched distribution — max |Δ| = ' + zeroOr(Mo.maxDev(kFull.renorm, A.probs))),
          UI.checkBadge(KS_A[0].renorm[A.argmax] === 1, 'k = 1 is greedy decoding — p′("' + A.words[A.argmax] + '") = ' + KS_A[0].renorm[A.argmax].toFixed(1))
        ]));
      }
    });

    steps.push({
      title: 'k is a constant. The distribution is not.',
      formula: null,
      note: 'Run the identical setting, <span>$k=' + CFG.k + '$</span>, on both contexts. On the focused row it keeps ' + pct(TK_A.mass) + ' of the mass — and to get there it had to include "' + A.words[TK_A.keptIdx[2]] + '" (' + pct(A.probs[TK_A.keptIdx[2]]) + ') and "' + A.words[TK_A.keptIdx[3]] + '" (' + pct(A.probs[TK_A.keptIdx[3]]) + '), tokens the model had all but ruled out. On the open row the same <span>$k$</span> keeps only ' + pct(TK_B.mass) + ', throwing away ' + pct(TK_B.dropped) + ' of the model\'s own opinion — including "' + B.words[B.order[CFG.k]] + '" at ' + pct(B.probs[B.order[CFG.k]]) + ', which is barely distinguishable from the "' + B.words[B.order[CFG.k - 1]] + '" at ' + pct(B.probs[B.order[CFG.k - 1]]) + ' that it kept. <strong>There is no k that is right for both rows</strong>, and a real model produces rows like both of these within the same sentence.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Mass kept by k = ' + CFG.k,
          items: [
            { label: 'focused: "' + A.prompt + ' ___"', value: M.round(TK_A.mass, 3), colorVar: CTX_COLORS.focused },
            { label: 'open: "' + B.prompt + ' ___"', value: M.round(TK_B.mass, 3), colorVar: CTX_COLORS.open }
          ],
          unit: ' of 1.0',
          meaning: 'The same k, ' + f2(TK_A.mass / TK_B.mass) + '× apart in coverage.'
        }));
        stage.appendChild(headsPanel({
          title: 'k = ' + CFG.k + ' on both contexts',
          heads: [
            {
              title: 'focused', shapeLabel: '1 × ' + CFG.V, matrix: [A.sortedProbs], rowLabels: ['p'],
              colLabels: A.sortedWords, colorMode: 'prob',
              mask: [A.sortedProbs.map(function (_, r) { return r >= CFG.k; })],
              badge: 'keeps ' + pct(TK_A.mass) + ' — too wide',
              meaning: 'Ranks 3 and ' + CFG.k + ' were already dead. Keeping them is the cost.'
            },
            {
              title: 'open', shapeLabel: '1 × ' + CFG.V, matrix: [B.sortedProbs], rowLabels: ['p'],
              colLabels: B.sortedWords, colorMode: 'prob',
              mask: [B.sortedProbs.map(function (_, r) { return r >= CFG.k; })],
              badge: 'keeps ' + pct(TK_B.mass) + ' — too narrow',
              meaning: 'The cut falls in the middle of a plateau of near-equal tokens.'
            }
          ]
        }));
      }
    });

    return steps;
  }

  // ============================================================ TOP-P ============================================================
  function buildTopP() {
    var steps = [];

    steps.push({
      title: 'Sort descending, then accumulate',
      formula: 'c_r = \\sum_{s \\le r} p_{\\text{order}[s]}',
      note: 'Top-p needs one more quantity than top-k does: the running total down the sorted row. Read along the cumulative row and you can see how fast the model\'s belief is used up — on this context ' + pct(A.cum[0]) + ' after one token, ' + pct(A.cum[1]) + ' after two, ' + pct(A.cum[3]) + ' after four. The last entry is 1 by construction.',
      render: function (stage) {
        stage.appendChild(sortedPanel(A, A.sortedProbs, { title: 'p — sorted', dim: true }));
        stage.appendChild(UI.arrow('Σ', 'running total'));
        stage.appendChild(sortedPanel(A, A.cum, {
          title: 'cumulative', rowLabel: 'Σ', fresh: true, badge: 'monotone, ends at ' + f2(A.cum[A.cum.length - 1]),
          meaning: 'Entry r is "how much of the model\'s belief the top r+1 tokens account for".'
        }));
      }
    });

    steps.push({
      title: 'Cut at the smallest prefix that reaches p = ' + CFG.p,
      formula: '\\mathcal{V}_p = \\text{the smallest } S \\text{ with } \\sum_{i \\in S} p_i \\ge ' + CFG.p,
      note: 'Walk the cumulative row left to right and stop at the first entry that reaches <span>$' + CFG.p + '$</span>. Here that is rank ' + TP_A.cutRank + ' at ' + f3(A.cum[TP_A.cutRank]) + ' — so the nucleus is <strong>' + TP_A.n + ' token' + (TP_A.n === 1 ? '' : 's') + '</strong>: ' + listWords(A, TP_A.keptIdx) + '. The token that crosses the threshold is kept, which is why the kept mass (' + f3(TP_A.mass) + ') is always ≥ p rather than exactly p. The size of the set was not chosen by anyone — it fell out of the shape of the row.',
      render: function (stage) {
        stage.appendChild(sortedPanel(A, A.cum, {
          title: 'cumulative', rowLabel: 'Σ', dim: true, badge: 'looking for the first entry ≥ ' + CFG.p
        }));
        stage.appendChild(UI.arrow('✂︎', 'cut after rank ' + TP_A.cutRank));
        stage.appendChild(sortedPanel(A, A.cum, {
          title: 'cumulative, cut', rowLabel: 'Σ', fresh: true,
          mask: [A.cum.map(function (_, r) { return r >= TP_A.n; })],
          badge: 'nucleus = ' + TP_A.n + ' of ' + CFG.V + ' tokens · mass ' + f3(TP_A.mass),
          meaning: 'Rank ' + TP_A.cutRank + ' is the first to reach ' + CFG.p + ' (' + f3(A.cum[TP_A.cutRank]) + '), so the cut falls right after it.'
        }));
        stage.appendChild(sortedPanel(A, A.sortedProbs, {
          title: 'p, truncated', mask: [A.sortedProbs.map(function (_, r) { return r >= TP_A.n; })],
          badge: 'compare: top-k kept ' + CFG.k,
          meaning: 'Top-k with k = ' + CFG.k + ' would have kept ' + CFG.k + ' of these. Top-p kept ' + TP_A.n + '.'
        }));
      }
    });

    steps.push({
      title: 'Renormalise the nucleus',
      formula: 'p\'_i = \\frac{p_i \\cdot \\mathbf{1}[i \\in \\mathcal{V}_p]}{' + f3(TP_A.mass) + '}',
      note: 'Identical to the top-k renormalisation — divide the survivors by their own mass, <span>$' + f3(TP_A.mass) + '$</span>, which scales every one of them by ' + f3(TP_A.scale) + '. Truncation methods differ only in <em>which</em> tokens survive; what happens afterwards is always the same division.',
      render: function (stage) {
        stage.appendChild(sortedPanel(A, A.sortedProbs, {
          title: 'p, truncated', dim: true, mask: [A.sortedProbs.map(function (_, r) { return r >= TP_A.n; })]
        }));
        stage.appendChild(UI.arrow('÷', f3(TP_A.mass)));
        stage.appendChild(sortedPanel(A, A.order.map(function (i) { return TP_A.renorm[i]; }), {
          title: 'p′ — nucleus, renormalised', fresh: true,
          mask: [A.sortedProbs.map(function (_, r) { return r >= TP_A.n; })],
          badge: 'Σp′ = ' + TP_A.total.toFixed(12),
          meaning: 'A distribution over ' + TP_A.n + ' token' + (TP_A.n === 1 ? '' : 's') + '.'
        }));
        stage.appendChild(UI.checkBadge(Math.abs(TP_A.total - 1) < 1e-12, 'Σp′ = ' + TP_A.total.toFixed(15)));
      }
    });

    steps.push({
      title: 'The same p = ' + CFG.p + ' on the open context',
      formula: null,
      note: 'Nothing about the setting changes — same <span>$p=' + CFG.p + '$</span>, same code. The cumulative row climbs much more slowly here (' + B.cum.slice(0, 4).map(function (v) { return f2(v); }).join(', ') + ', …), so the threshold is not reached until rank ' + TP_B.cutRank + ', and the nucleus comes out at <strong>' + TP_B.n + ' tokens</strong> instead of ' + TP_A.n + '. That is the property worth naming: <strong>top-p\'s candidate set resizes itself with the model\'s confidence</strong>, from ' + TP_A.n + ' to ' + TP_B.n + ' on this page, without anyone touching the setting.',
      render: function (stage) {
        stage.appendChild(headsPanel({
          title: 'Cumulative rows, both contexts, cut at p = ' + CFG.p,
          heads: [
            {
              title: 'focused → nucleus of ' + TP_A.n, shapeLabel: '1 × ' + CFG.V, matrix: [A.cum], rowLabels: ['Σ'],
              colLabels: A.sortedWords, colorMode: 'prob',
              mask: [A.cum.map(function (_, r) { return r >= TP_A.n; })],
              badge: 'reaches ' + CFG.p + ' at rank ' + TP_A.cutRank
            },
            {
              title: 'open → nucleus of ' + TP_B.n, shapeLabel: '1 × ' + CFG.V, matrix: [B.cum], rowLabels: ['Σ'],
              colLabels: B.sortedWords, colorMode: 'prob',
              mask: [B.cum.map(function (_, r) { return r >= TP_B.n; })],
              badge: 'reaches ' + CFG.p + ' at rank ' + TP_B.cutRank
            }
          ],
          groupMeaning: 'One setting, two candidate-set sizes: ' + TP_A.n + ' and ' + TP_B.n + '.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Candidate set size at p = ' + CFG.p, unit: ' tokens',
          items: [
            { label: 'focused (H = ' + f2(A.entropy) + ' bits)', value: TP_A.n, colorVar: CTX_COLORS.focused },
            { label: 'open (H = ' + f2(B.entropy) + ' bits)', value: TP_B.n, colorVar: CTX_COLORS.open }
          ],
          meaning: 'Compare with top-k, which would answer ' + CFG.k + ' and ' + CFG.k + '.'
        }));
      }
    });

    steps.push({
      title: 'Head to head: the two methods choose different sets',
      formula: null,
      note: 'This is the argument for nucleus sampling in full, and it goes in both directions at once. On the <strong>focused</strong> row, top-k(' + CFG.k + ') admits ' + listWords(A, ONLY_K_A) + ' — ' + pct(Mo.sum(ONLY_K_A.map(function (i) { return A.probs[i]; }))) + ' of mass the model had effectively dismissed — while top-p stopped at ' + TP_A.n + '. On the <strong>open</strong> row it goes the other way: top-p keeps ' + listWords(B, ONLY_P_B) + ', a further ' + pct(Mo.sum(ONLY_P_B.map(function (i) { return B.probs[i]; }))) + ' of mass that top-k(' + CFG.k + ') threw away. One fixed k is simultaneously too generous on the first row and too stingy on the second; one fixed p is neither.',
      render: function (stage) {
        [[A, TK_A, TP_A, ONLY_K_A, ONLY_P_A, 'focused'], [B, TK_B, TP_B, ONLY_K_B, ONLY_P_B, 'open']].forEach(function (c) {
          var ctx = c[0], tk = c[1], tp = c[2], onlyK = c[3], onlyP = c[4];
          var g = UI.el('div', 'lab-heads-group');
          g.appendChild(UI.el('div', 'lab-heads-group-title', c[5] + ' — ' + ctx.prompt + ' ___'));
          var lk = UI.el('div', 'lab-panel-meaning', 'top-k(' + CFG.k + ') keeps ' + tk.keptIdx.length + ' · ' + pct(tk.mass));
          g.appendChild(lk);
          g.appendChild(tokenChips(ctx, ctx.probs, ctx.words.map(function (_, i) { return tk.keep[i]; }), { order: ctx.order }));
          var lp = UI.el('div', 'lab-panel-meaning', 'top-p(' + CFG.p + ') keeps ' + tp.n + ' · ' + pct(tp.mass));
          lp.style.marginTop = '14px';
          g.appendChild(lp);
          g.appendChild(tokenChips(ctx, ctx.probs, ctx.words.map(function (_, i) { return tp.keep[i]; }), { order: ctx.order }));
          var d = UI.el('div', 'lab-panel-meaning', 'only top-k: <strong>' + (onlyK.length ? wordsOf(ctx, onlyK).join(', ') : '—') +
            '</strong> &nbsp;·&nbsp; only top-p: <strong>' + (onlyP.length ? wordsOf(ctx, onlyP).join(', ') : '—') + '</strong>');
          d.style.marginTop = '14px';
          g.appendChild(d);
          stage.appendChild(g);
        });
        var differ = (ONLY_K_A.length + ONLY_P_A.length) > 0 && (ONLY_K_B.length + ONLY_P_B.length) > 0;
        stage.appendChild(UI.checkBadge(differ, 'the two methods disagree on both rows — ' +
          (ONLY_K_A.length + ONLY_P_A.length) + ' token(s) apart on the focused row, ' +
          (ONLY_K_B.length + ONLY_P_B.length) + ' on the open one'));
      }
    });

    steps.push({
      title: 'Why the fixed-size cut is the wrong shape',
      formula: null,
      note: 'Put the four numbers next to each other. Top-k answers "' + CFG.k + '" to both rows because ' + CFG.k + ' is what it was told; top-p answers ' + TP_A.n + ' and ' + TP_B.n + ' because it is reading the row. The underlying observation, which is the one Holtzman et al. made in 2019, is that the number of genuinely plausible next tokens varies by more than an order of magnitude from position to position in ordinary text — so any method whose candidate set has a fixed size is wrong most of the time, in one direction or the other. In practice the two are often stacked, with a generous k as a safety rail and p doing the real work.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Candidate set size', unit: ' tokens',
          items: [
            { label: 'focused · top-k(' + CFG.k + ')', value: TK_A.keptIdx.length, colorVar: 'var(--c-efficient)' },
            { label: 'focused · top-p(' + CFG.p + ')', value: TP_A.n, colorVar: CTX_COLORS.focused },
            { label: 'open · top-k(' + CFG.k + ')', value: TK_B.keptIdx.length, colorVar: 'var(--c-efficient)' },
            { label: 'open · top-p(' + CFG.p + ')', value: TP_B.n, colorVar: CTX_COLORS.open }
          ],
          meaning: 'Top-k is flat by construction. Top-p tracks the distribution.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Mass kept', unit: ' of 1.0',
          items: [
            { label: 'focused · top-k(' + CFG.k + ')', value: M.round(TK_A.mass, 3), colorVar: 'var(--c-efficient)' },
            { label: 'focused · top-p(' + CFG.p + ')', value: M.round(TP_A.mass, 3), colorVar: CTX_COLORS.focused },
            { label: 'open · top-k(' + CFG.k + ')', value: M.round(TK_B.mass, 3), colorVar: 'var(--c-efficient)' },
            { label: 'open · top-p(' + CFG.p + ')', value: M.round(TP_B.mass, 3), colorVar: CTX_COLORS.open }
          ],
          meaning: 'Top-p keeps at least p by definition — ' + f3(TP_A.mass) + ' and ' + f3(TP_B.mass) + ' here. Top-k keeps whatever it happens to keep: ' + f3(TK_A.mass) + ' and ' + f3(TK_B.mass) + '.'
        }));
      }
    });

    steps.push({
      title: 'How a real server composes them',
      formula: 'z \\ \\xrightarrow{\\ \\div T\\ } \\ \\text{softmax} \\ \\xrightarrow{\\ \\text{top-}k\\ } \\ \\text{renorm} \\ \\xrightarrow{\\ \\text{top-}p\\ } \\ \\text{renorm} \\ \\xrightarrow{\\ \\text{draw}\\ } \\ \\text{token}',
      note: 'Order matters, and the usual one is temperature first (it is a logit operation), then top-k, then top-p, each followed by a renormalisation. Run on the open context with <span>$T=' + CFG.stackT + '$</span>, <span>$k=' + CFG.stackK + '$</span>, <span>$p=' + CFG.stackP + '$</span>: temperature lifts the top token from ' + pct(B.top1) + ' to ' + pct(Mo.maxOf(STACK.afterT)) + ', top-k cuts to ' + CFG.stackK + ' tokens holding ' + pct(STACK.afterK.mass) + ', and top-p then cuts further to <strong>' + STACK.afterP.n + '</strong>. Applying top-p <em>before</em> temperature would give a different set, because temperature changes the cumulative curve it reads.',
      render: function (stage) {
        stage.appendChild(probPanel(B, B.probs, { title: '1 · raw p', dim: true, badge: 'H = ' + f2(B.entropy) + ' bits' }));
        stage.appendChild(UI.arrow('÷', 'T = ' + CFG.stackT));
        stage.appendChild(probPanel(B, STACK.afterT, { title: '2 · after temperature', badge: 'top-1 ' + pct(Mo.maxOf(STACK.afterT)) }));
        stage.appendChild(UI.arrow('✂︎', 'top-k ' + CFG.stackK));
        stage.appendChild(probPanel(B, STACK.afterK.renorm, {
          title: '3 · after top-k', mask: [STACK.afterK.keep.map(function (v) { return !v; })],
          badge: 'kept ' + CFG.stackK + ' · mass was ' + f3(STACK.afterK.mass)
        }));
        stage.appendChild(UI.arrow('✂︎', 'top-p ' + CFG.stackP));
        stage.appendChild(probPanel(B, STACK.afterP.renorm, {
          title: '4 · after top-p', fresh: true, mask: [STACK.afterP.keep.map(function (v) { return !v; })],
          badge: 'kept ' + STACK.afterP.n + ' · Σ = ' + STACK.afterP.total.toFixed(6),
          meaning: 'The distribution a token is finally drawn from — the next tab.'
        }));
      }
    });

    return steps;
  }

  // ============================================================ SAMPLING ============================================================
  function buildSampling() {
    var steps = [];
    var gi = B.argmax;
    var empiricalTop = RUN.freqs[gi];
    var offGreedy = RUN.trace.filter(function (t) { return t.idx !== gi; })[0];
    var stageFirst = RUN.stages[0], stageLast = RUN.stages[RUN.stages.length - 1];
    var nRatio = stageLast.n / stageFirst.n;
    var devRatio = stageFirst.maxDev / stageLast.maxDev;

    steps.push({
      title: 'Greedy: take the argmax and stop thinking',
      formula: 'x = \\arg\\max_i p_i',
      note: 'The cheapest possible answer, and a completely deterministic one: run this context a thousand times and you get "' + B.words[gi] + '" a thousand times. What it costs is visible in the row — "' + B.words[gi] + '" holds ' + pct(B.top1) + ' of the model\'s belief, so greedy is discarding <strong>' + pct(1 - B.top1) + '</strong> of it, including "' + B.words[B.order[1]] + '" at ' + pct(B.probs[B.order[1]]) + ', which the model rates as almost exactly as good. Greedy is the right choice when you want reproducibility (evaluation, extraction, code) and the wrong one when a plateau like this means there is no single right answer.',
      render: function (stage) {
        stage.appendChild(probPanel(B, B.probs, { dim: true, badge: 'H = ' + f2(B.entropy) + ' bits' }));
        stage.appendChild(UI.arrow('↓', 'argmax'));
        stage.appendChild(probPanel(B, B.probs, {
          title: 'what greedy keeps', fresh: true,
          mask: [B.probs.map(function (_, i) { return i !== gi; })],
          badge: 'argmax = "' + B.words[gi] + '" at ' + f3(B.top1),
          meaning: 'Every dotted cell is a token that can never be produced, at any position, ever.'
        }));
      }
    });

    steps.push({
      title: 'Sampling: invert the cumulative distribution',
      formula: 'u \\sim \\mathcal{U}(0,1), \\qquad x = \\min\\{\\, i : \\textstyle\\sum_{j \\le i} p_j \\ge u \\,\\}',
      note: 'Drawing from a categorical distribution is one line of arithmetic. Lay the probabilities end to end along <span>$[0,1]$</span> so each token owns an interval as wide as its probability, pick a uniform random <span>$u$</span>, and return whichever interval it lands in. "' + B.words[gi] + '" owns an interval of width ' + f3(B.top1) + '; "' + B.words[B.order[B.order.length - 1]] + '" owns one of width ' + f3(B.probs[B.order[B.order.length - 1]]) + '. Nothing else is involved — the only randomness in the whole pipeline is that one <span>$u$</span>.',
      render: function (stage) {
        stage.appendChild(probPanel(B, B.probs, { dim: true }));
        stage.appendChild(UI.arrow('Σ', 'running total'));
        stage.appendChild(probPanel(B, RUN.cum, {
          title: 'cumulative (alphabetical order)', rowLabel: 'Σ', fresh: true,
          badge: 'ends at ' + f2(RUN.cum[RUN.cum.length - 1]),
          meaning: 'Token i owns the interval from entry i−1 to entry i. The widths are the probabilities.'
        }));
      }
    });

    steps.push({
      title: CFG.showDraws + ' actual draws from a seeded stream',
      formula: null,
      note: 'These are real draws from <code>mulberry32(' + CFG.drawSeed + ')</code>, the same generator the rest of this lab uses, so they are identical on every reload. Each row shows the uniform <span>$u$</span>, the interval it fell into, and the token that comes back.' +
        (offGreedy ? ' Note draw ' + offGreedy.n + ': <span>$u=' + f3(offGreedy.u) + '$</span> lands on "' + B.words[offGreedy.idx] + '", a token greedy would never produce.' : ''),
      render: function (stage) {
        stage.appendChild(table(
          ['draw', 'u', 'interval', 'token', 'p(token)'],
          RUN.trace.map(function (t) {
            return [String(t.n), f4(t.u), '[' + f3(t.lo) + ', ' + f3(t.hi) + ')', B.words[t.idx], f3(B.probs[t.idx])];
          })
        ));
        stage.appendChild(UI.textCard('Of these ' + CFG.showDraws + ' draws, ' + RUN.trace.filter(function (t) { return t.idx === gi; }).length +
          ' returned the greedy token "' + B.words[gi] + '" and ' + RUN.trace.filter(function (t) { return t.idx !== gi; }).length +
          ' did not. The expected rate is ' + pct(B.top1) + ' — with ' + CFG.showDraws + ' draws you cannot tell anything yet, which is the next step.'));
      }
    });

    steps.push({
      title: CFG.draws + ' draws against the true probabilities',
      formula: '\\hat{p}_i = \\frac{\\text{count}_i}{N}, \\qquad N = ' + CFG.draws,
      note: 'Repeat the same procedure ' + CFG.draws + ' times and count. The empirical frequencies should converge on the probabilities themselves — that is the entire claim being made when anyone says a model "samples from its distribution". The largest disagreement across all ' + CFG.V + ' tokens is <strong>' + f3(RUN.maxDev) + '</strong>, against a rough one-standard-deviation scale of <span>$1/\\sqrt{N} = ' + f3(1 / Math.sqrt(CFG.draws)) + '$</span>. No token is systematically over- or under-drawn.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({
          title: 'true p vs empirical frequency', shapeLabel: '3 × |V|=' + CFG.V,
          matrix: [B.probs, RUN.freqs, B.probs.map(function (v, i) { return Math.abs(v - RUN.freqs[i]); })],
          rowLabels: ['p', 'p̂', '|Δ|'], colLabels: B.words, colorMode: 'prob', fresh: true,
          meaning: 'Row 1 is what the model said, row 2 is what ' + CFG.draws + ' draws produced, row 3 is the gap.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Top ' + 6 + ' tokens: probability vs empirical frequency',
          items: B.order.slice(0, 6).reduce(function (acc, i) {
            acc.push({ label: '"' + B.words[i] + '" · p', value: M.round(B.probs[i], 3), colorVar: CTX_COLORS.open });
            acc.push({ label: '"' + B.words[i] + '" · p̂ (' + RUN.counts[i] + '/' + CFG.draws + ')', value: M.round(RUN.freqs[i], 3), colorVar: 'var(--c-practice)' });
            return acc;
          }, []),
          meaning: 'Each pair should be the same height. The residual is sampling noise, not bias.'
        }));
        stage.appendChild(UI.checkBadge(RUN.maxDev < 3 / Math.sqrt(CFG.draws),
          'max |p̂ − p| = ' + f4(RUN.maxDev) + ' over ' + CFG.V + ' tokens — inside 3/√N = ' + f3(3 / Math.sqrt(CFG.draws))));
      }
    });

    steps.push({
      title: 'Convergence: the error shrinks like 1/√N',
      formula: '\\mathbb{E}\\big[|\\hat{p}_i - p_i|\\big] \\sim \\sqrt{\\tfrac{p_i(1-p_i)}{N}}',
      note: 'The same run, measured at ' + RUN.stages.length + ' points along the way. The worst-token error falls ' + RUN.stages.map(function (s) { return f3(s.maxDev); }).join(' → ') + ' as <span>$N$</span> goes ' + RUN.stages.map(function (s) { return s.n; }).join(' → ') + '. That is a ' + f1(devRatio) + '× improvement for a ' + nRatio + '× increase in draws, against the ' + f1(Math.sqrt(nRatio)) + '× a <span>$1/\\sqrt{N}$</span> law predicts — the right order, with the slack you would expect from a single run. This is also why you cannot read a model\'s distribution off a handful of generations: at <span>$N=' + stageFirst.n + '$</span> the measured frequencies are off by up to ' + pct(stageFirst.maxDev) + ' in absolute terms.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Worst-token error vs number of draws',
          items: RUN.stages.map(function (s) {
            return { label: 'N = ' + s.n, value: M.round(s.maxDev, 4), colorVar: CTX_COLORS.open };
          }).concat([{ label: 'reference: 1/√' + CFG.draws, value: M.round(1 / Math.sqrt(CFG.draws), 4), colorVar: 'var(--c-efficient)' }]),
          meaning: 'Decreasing, but slowly — quadrupling the draws only halves the error.'
        }));
        stage.appendChild(table(
          ['N'].concat(B.order.slice(0, 5).map(function (i) { return B.words[i]; })).concat(['max |Δ|']),
          RUN.stages.map(function (s) {
            return [String(s.n)].concat(B.order.slice(0, 5).map(function (i) { return f3(s.freqs[i]); })).concat([f4(s.maxDev)]);
          }).concat([['true p'].concat(B.order.slice(0, 5).map(function (i) { return f3(B.probs[i]); })).concat(['—'])]),
          RUN.stages.length
        ));
      }
    });

    steps.push({
      title: 'So which one do you want?',
      formula: 'P[\\text{sampled} = \\text{greedy}] = p_{\\max} = ' + f3(B.top1),
      note: 'Sampling agrees with greedy exactly as often as the top token is likely — predicted ' + pct(B.top1) + ', measured ' + pct(empiricalTop) + ' over ' + CFG.draws + ' draws. The other ' + pct(1 - empiricalTop) + ' of the time it produces something greedy structurally cannot. That is the whole trade: greedy is reproducible and, on flat rows like this one, prone to locking onto whichever token won by a hair and repeating the pattern that got it there; sampling covers the model\'s actual belief but gives up determinism and can draw from the tail. Every knob on the previous three tabs exists to move a row between those two failure modes — temperature reshapes it, top-k and top-p amputate the tail before the draw ever happens.',
      render: function (stage) {
        stage.appendChild(UI.checkBadge(Math.abs(empiricalTop - B.top1) < 3 / Math.sqrt(CFG.draws),
          'agreement rate ' + f3(empiricalTop) + ' vs predicted ' + f3(B.top1) + ' — |Δ| = ' + f4(Math.abs(empiricalTop - B.top1))));
        stage.appendChild(UI.barsPanel({
          title: 'What ' + CFG.draws + ' greedy decodes and ' + CFG.draws + ' samples produce', unit: ' distinct tokens',
          items: [
            { label: 'greedy — always "' + B.words[gi] + '"', value: 1, colorVar: 'var(--c-efficient)' },
            { label: 'sampling — tokens actually drawn at least once', value: RUN.counts.filter(function (c) { return c > 0; }).length, colorVar: CTX_COLORS.open }
          ],
          meaning: 'From the same row, with the same model, on the same prompt.'
        }));
        stage.appendChild(UI.textCard('Worth carrying away: <strong>the model never picks a token.</strong> It produces one row of numbers. Everything that decides which token you actually see — greedy or not, how sharp, how many candidates — happens after the model is done, in code you control, and none of it changes what the model believes.'));
      }
    });

    return steps;
  }

  var TABS = [
    { id: 'softmax', label: 'Logits → probabilities', short: 'Softmax', color: 'var(--c-attention)', build: buildSoftmax },
    { id: 'temperature', label: 'Temperature', short: 'Temperature', color: 'var(--c-frontier)', build: buildTemperature },
    { id: 'topk', label: 'Top-k truncation', short: 'Top-k', color: 'var(--c-gpu)', build: buildTopK },
    { id: 'topp', label: 'Top-p / nucleus', short: 'Top-p', color: 'var(--accent-2)', build: buildTopP },
    { id: 'sample', label: 'Greedy vs sampled', short: 'Sampling', color: 'var(--c-practice)', build: buildSampling }
  ];

  window.KMLSamplingSteps = { A: A, B: B, CHECKS: CHECKS, RUN: RUN, TABS: TABS };

  /* The contract the shared controller (lab-app.js) reads. */
  window.KML_LAB = {
    tabs: TABS,
    dims: [
      { sym: '|V|', val: String(CFG.V), def: 'Vocabulary — how many candidate next tokens the distribution is over. ' + CFG.V + ' here so a whole row fits on screen; a real model has 32,000 to 256,000, and every operation on this page runs over all of them.' },
      { sym: 'd_model', val: String(CFG.dModel), def: 'Width of the final hidden state that gets unembedded into logits. Only used on the first tab — after the logits exist, nothing downstream knows or cares how wide the model was.' },
      { sym: 'T', val: '1.0', def: 'Temperature — the number the logits are divided by before the softmax. Below 1 sharpens toward the argmax, above 1 flattens toward uniform, exactly 1 is the identity.' },
      { sym: 'k', val: String(CFG.k), def: 'Top-k — keep this many highest-probability tokens and zero the rest. A fixed count, chosen without reference to the distribution.' },
      { sym: 'p', val: String(CFG.p), def: 'Top-p (nucleus) — keep the smallest set of tokens whose probabilities add up to at least this. A fixed mass, so the count adapts to the row.' }
    ],
    dimsFor: {
      sample: [{ sym: 'N', val: String(CFG.draws), def: 'Draws — how many times a token is sampled from the same fixed distribution, to compare empirical frequencies against the probabilities.' }]
    },
    /* T, k and p are what each tab is actually varying, so they are rewritten live as you step. */
    dimFix: function (tabId, stepIndex, list) {
      var get = function (sym) { return list.filter(function (d) { return d.sym === sym; })[0]; };
      var T = get('T'), k = get('k'), p = get('p');
      if (tabId === 'temperature') {
        var seq = [CFG.temps[1]].concat(CFG.temps);            // step 0 demos T = temps[1]
        T.val = stepIndex < seq.length ? String(seq[stepIndex]) : (stepIndex === seq.length + 2 ? CFG.tempLimits.join(' / ') : 'swept');
        k.val = '—'; p.val = '—';
      } else if (tabId === 'topk') {
        T.val = '1.0'; p.val = '—';
        k.val = stepIndex === 4 ? CFG.kSweep.join(' / ') : String(CFG.k);
      } else if (tabId === 'topp') {
        T.val = stepIndex === 6 ? String(CFG.stackT) : '1.0';
        k.val = stepIndex >= 4 ? (stepIndex === 6 ? String(CFG.stackK) : String(CFG.k)) : '—';
        p.val = String(stepIndex === 6 ? CFG.stackP : CFG.p);
      } else if (tabId === 'sample') {
        T.val = '1.0'; k.val = '—'; p.val = '—';
      } else {
        T.val = '1.0'; k.val = '—'; p.val = '—';
      }
    }
  };
})();
