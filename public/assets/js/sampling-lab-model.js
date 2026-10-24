/* KnowML — Sampling Lab: the worked example itself.
   One question: a transformer has just produced a final hidden state. How does
   that become an actual next token? Everything below is real arithmetic on a
   seeded example (see lab-engine.js) — no number on the page is hand-typed.

   Two contexts are built, because the whole top-k vs top-p argument only shows
   up when you apply one fixed setting to two differently-shaped distributions:
     · "focused" — the model is nearly sure which token comes next
     · "open"    — a dozen continuations are all roughly as good as each other
   Both come out of the same seeded stream; see pickHidden() for exactly how. */
(function () {
  'use strict';
  var M = window.KMLLabMath;

  var CFG = {
    dModel: 6,           // width of the final hidden state (a real model: thousands)
    V: 12,               // candidate vocabulary (a real model: 32k–256k)
    seed: 20260912,
    poolSize: 48,        // how many candidate hidden states each context chooses from
    lo: -1.5, hi: 1.5, dp: 1,   // range + decimals for every seeded weight
    focusedTop1: 0.85,   // the target peakedness of the "focused" context
    temps: [0.2, 0.7, 1.0, 2.0],
    tempLimits: [0.01, 100],    // stand-ins for T→0 and T→∞
    k: 4,
    p: 0.9,
    kSweep: [1, 2, 4, 8, 12],
    stackT: 0.7,         // the "real server" composition on the top-p tab
    stackK: 8,
    stackP: 0.9,
    draws: 2000,
    drawStages: [20, 200, 2000],
    drawSeed: 4242,
    showDraws: 8,
    overflowShift: 800   // added to every logit to break the naive softmax
  };

  /* The words are labels, not numbers: `ranked` is the plausibility order a real
     model would produce for the prompt, `words` is the order they are displayed
     in (alphabetical, so no row on the page arrives pre-sorted). The computed
     logits are attached highest-to-most-plausible — see buildContext(). */
  var SPECS = [
    {
      id: 'focused',
      prompt: 'The cat sat on the',
      label: 'focused context',
      words: ['bed', 'chair', 'couch', 'fence', 'floor', 'grass', 'mat', 'roof', 'rug', 'sofa', 'step', 'table'],
      ranked: ['mat', 'floor', 'rug', 'couch', 'bed', 'sofa', 'table', 'chair', 'step', 'roof', 'fence', 'grass'],
      pick: 'confident'
    },
    {
      id: 'open',
      prompt: 'On Saturday I went down to the',
      label: 'open context',
      words: ['bank', 'beach', 'docks', 'field', 'gate', 'gym', 'hotel', 'mall', 'park', 'plaza', 'river', 'store'],
      ranked: ['store', 'park', 'beach', 'gym', 'bank', 'mall', 'hotel', 'plaza', 'field', 'river', 'docks', 'gate'],
      pick: 'flattest'
    }
  ];

  // ---------- small row helpers (a "row" here is a plain array; a panel wants [row]) ----------
  function rowMat(r) { return [r.slice()]; }
  function sum(r) { var s = 0; for (var i = 0; i < r.length; i++) s += r[i]; return s; }
  function maxOf(r) { var m = -Infinity; for (var i = 0; i < r.length; i++) if (r[i] > m) m = r[i]; return m; }
  function argmax(r) { var b = 0; for (var i = 1; i < r.length; i++) if (r[i] > r[b]) b = i; return b; }
  function orderDesc(r) {
    var idx = r.map(function (_, i) { return i; });
    idx.sort(function (a, b) { return r[b] - r[a]; });
    return idx;
  }
  function maxDev(a, b) { var m = 0; for (var i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }
  function entropyBits(p) {
    var h = 0;
    for (var i = 0; i < p.length; i++) if (p[i] > 0) h -= p[i] * Math.log2(p[i]);
    return h;
  }

  // ---------- the softmax, one primitive at a time so every stage can be shown ----------
  function softmaxTrace(logits) {
    var mx = maxOf(logits);
    var shifted = logits.map(function (v) { return v - mx; });
    var exps = shifted.map(function (v) { return Math.exp(v); });
    var Z = sum(exps);
    var probs = exps.map(function (v) { return v / Z; });
    var total = sum(probs);
    return {
      logits: logits.slice(), max: mx, shifted: shifted, exps: exps, Z: Z,
      probs: probs, total: total, sumErr: Math.abs(total - 1)
    };
  }
  // the same thing written the way you would write it first, and the way that breaks
  function naiveSoftmax(logits) {
    var exps = logits.map(function (v) { return Math.exp(v); });
    var Z = sum(exps);
    return { exps: exps, Z: Z, probs: exps.map(function (v) { return v / Z; }) };
  }
  function anyNonFinite(r) { return r.some(function (v) { return !isFinite(v); }); }

  // smallest integer whose exp() is no longer representable — found, not quoted
  function expOverflowPoint() { var x = 0; while (isFinite(Math.exp(x))) x++; return x; }

  function temper(logits, T) { return logits.map(function (v) { return v / T; }); }

  // ---------- truncation ----------
  function topK(probs, k) {
    var order = orderDesc(probs);
    var keptIdx = order.slice(0, k);
    var keep = probs.map(function (_, i) { return keptIdx.indexOf(i) !== -1; });
    var kept = probs.map(function (v, i) { return keep[i] ? v : 0; });
    var mass = sum(kept);
    var renorm = kept.map(function (v) { return v / mass; });
    return {
      k: k, order: order, keptIdx: keptIdx, keep: keep, kept: kept,
      mass: mass, dropped: 1 - mass, scale: 1 / mass, renorm: renorm, total: sum(renorm)
    };
  }
  function topP(probs, p) {
    var order = orderDesc(probs);
    var sorted = order.map(function (i) { return probs[i]; });
    var cum = [], c = 0;
    for (var i = 0; i < sorted.length; i++) { c += sorted[i]; cum.push(c); }
    var n = 1;
    while (n < cum.length && cum[n - 1] < p) n++;   // smallest prefix reaching p
    var keptIdx = order.slice(0, n);
    var keep = probs.map(function (_, i) { return keptIdx.indexOf(i) !== -1; });
    var kept = probs.map(function (v, i) { return keep[i] ? v : 0; });
    var mass = sum(kept);
    var renorm = kept.map(function (v) { return v / mass; });
    return {
      p: p, order: order, sorted: sorted, cum: cum, n: n, cutRank: n - 1,
      keptIdx: keptIdx, keep: keep, kept: kept, mass: mass, dropped: 1 - mass,
      scale: 1 / mass, renorm: renorm, total: sum(renorm)
    };
  }
  function setDiff(a, b) { return a.filter(function (x) { return b.indexOf(x) === -1; }); }

  // ---------- actually drawing a token: inverse-CDF on a seeded stream ----------
  function sampleRun(probs, n, seed, stages, traceN) {
    var rng = M.mulberry32(seed);
    var V = probs.length, cum = [], c = 0, i;
    for (i = 0; i < V; i++) { c += probs[i]; cum.push(c); }
    var counts = new Array(V).fill(0), trace = [], stageRows = [];
    stages = stages || [];
    for (var t = 1; t <= n; t++) {
      var u = rng(), idx = 0;
      while (idx < V - 1 && u > cum[idx]) idx++;
      counts[idx]++;
      if (trace.length < (traceN || 0)) trace.push({ n: t, u: u, idx: idx, lo: idx === 0 ? 0 : cum[idx - 1], hi: cum[idx] });
      if (stages.indexOf(t) !== -1) {
        var f = counts.map(function (x) { return x / t; });
        stageRows.push({ n: t, counts: counts.slice(), freqs: f, maxDev: maxDev(f, probs) });
      }
    }
    var freqs = counts.map(function (x) { return x / n; });
    return { n: n, cum: cum, counts: counts, freqs: freqs, maxDev: maxDev(freqs, probs), trace: trace, stages: stageRows };
  }

  // ---------- build one context ----------
  var rng = M.mulberry32(CFG.seed);

  function buildContext(spec) {
    // 1. this context's slice of the unembedding matrix: one column per candidate token
    var WU0 = M.seededMatrix(rng, CFG.dModel, CFG.V, CFG.lo, CFG.hi, CFG.dp);
    // 2. a pool of candidate final hidden states, all from the same seeded stream
    var pool = [];
    for (var i = 0; i < CFG.poolSize; i++) {
      var h = M.seededMatrix(rng, 1, CFG.dModel, CFG.lo, CFG.hi, CFG.dp);
      var lg = M.matmul(h, WU0)[0];
      pool.push({ h: h, logits: lg, top1: maxOf(softmaxTrace(lg).probs) });
    }
    // 3. pick one: the closest to CFG.focusedTop1, or the flattest of the pool
    var chosen = pool.reduce(function (a, b) {
      if (spec.pick === 'flattest') return b.top1 < a.top1 ? b : a;
      return Math.abs(b.top1 - CFG.focusedTop1) < Math.abs(a.top1 - CFG.focusedTop1) ? b : a;
    });
    // 4. permute W_U's columns so column j really is the candidate word shown in
    //    position j — the displayed matmul is then literally the displayed row,
    //    with the largest logit landing on the most plausible word.
    var rankOrder = orderDesc(chosen.logits);
    var perm = spec.words.map(function (w) { return rankOrder[spec.ranked.indexOf(w)]; });
    var WU = WU0.map(function (r) { return perm.map(function (c) { return r[c]; }); });
    var h = chosen.h;
    var logits = M.matmul(h, WU)[0];

    var sm = softmaxTrace(logits);
    var probs = sm.probs;
    var order = orderDesc(probs);
    var cum = [], c = 0;
    for (var q = 0; q < order.length; q++) { c += probs[order[q]]; cum.push(c); }

    return {
      id: spec.id, prompt: spec.prompt, label: spec.label, words: spec.words,
      h: h, WU: WU, logits: logits, softmax: sm, probs: probs,
      order: order, sortedWords: order.map(function (i) { return spec.words[i]; }),
      sortedProbs: order.map(function (i) { return probs[i]; }), cum: cum,
      argmax: argmax(probs), top1: maxOf(probs), entropy: entropyBits(probs),
      poolSize: CFG.poolSize
    };
  }

  var CTX = {};
  SPECS.forEach(function (s) { CTX[s.id] = buildContext(s); });

  // ---------- everything the step files need, computed once ----------
  var FOCUSED = CTX.focused, OPEN = CTX.open;

  // the "why not just divide by the sum" strawman
  function naiveNormalise(logits) {
    var s = sum(logits);
    return { sum: s, row: logits.map(function (v) { return v / s; }), total: 1 };
  }

  // the three self-checks the softmax tab has to survive
  function stabilityChecks(ctx) {
    var stable = ctx.softmax;
    var naive = naiveSoftmax(ctx.logits);
    var frameworkProbs = M.softmaxRows([ctx.logits])[0];
    var big = ctx.logits.map(function (v) { return v + CFG.overflowShift; });
    var naiveBig = naiveSoftmax(big);
    var stableBig = softmaxTrace(big);
    return {
      sumErr: stable.sumErr,
      naiveProbs: naive.probs,
      naiveDiff: maxDev(naive.probs, stable.probs),
      frameworkDiff: maxDev(frameworkProbs, stable.probs),
      shift: CFG.overflowShift,
      big: big,
      naiveBigExps: naiveBig.exps,
      naiveBigZ: naiveBig.Z,
      naiveBigProbs: naiveBig.probs,
      naiveBroke: anyNonFinite(naiveBig.probs),
      stableBigProbs: stableBig.probs,
      shiftInvariantDiff: maxDev(stableBig.probs, stable.probs),
      overflowAt: expOverflowPoint(),
      fp32Limit: Math.log(3.4028234663852886e38),   // largest finite float32
      fp16Limit: Math.log(65504)                    // largest finite float16
    };
  }

  function temperatureSweep(ctx, temps) {
    return temps.map(function (T) {
      var scaled = temper(ctx.logits, T);
      var sm = softmaxTrace(scaled);
      return {
        T: T, scaled: scaled, probs: sm.probs, top1: maxOf(sm.probs),
        argmax: argmax(sm.probs), order: orderDesc(sm.probs), entropy: entropyBits(sm.probs),
        sumErr: sm.sumErr
      };
    });
  }

  function kSweep(ctx, ks) { return ks.map(function (k) { return topK(ctx.probs, k); }); }

  // temperature → top-k → top-p, the order a serving stack applies them in
  function samplerStack(ctx, T, k, p) {
    var scaled = temper(ctx.logits, T);
    var afterT = softmaxTrace(scaled).probs;
    var afterK = topK(afterT, k);
    var afterP = topP(afterK.renorm, p);
    return { T: T, k: k, p: p, scaled: scaled, afterT: afterT, afterK: afterK, afterP: afterP };
  }

  window.SamplingLabModel = {
    CFG: CFG, SPECS: SPECS, CTX: CTX, FOCUSED: FOCUSED, OPEN: OPEN,
    rowMat: rowMat, sum: sum, maxOf: maxOf, argmax: argmax, orderDesc: orderDesc,
    maxDev: maxDev, entropyBits: entropyBits,
    softmaxTrace: softmaxTrace, naiveSoftmax: naiveSoftmax, naiveNormalise: naiveNormalise,
    temper: temper, topK: topK, topP: topP, setDiff: setDiff, sampleRun: sampleRun,
    stabilityChecks: stabilityChecks, temperatureSweep: temperatureSweep,
    kSweep: kSweep, samplerStack: samplerStack, expOverflowPoint: expOverflowPoint
  };
})();
