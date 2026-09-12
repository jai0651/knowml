/* KnowML — Quantization Lab: the worked example itself.
   One small float weight block, quantized four different ways. Every number the
   page shows comes out of this file, computed in real arithmetic from a seeded
   RNG (see lab-engine.js) — nothing downstream is a hand-typed "for illustration"
   figure, including every error, every code count and every byte total. */
(function () {
  'use strict';
  var M = window.KMLLabMath;

  var CFG = {
    rows: 4,              // output channels — the axis per-channel quantization gives its own scale to
    cols: 8,              // input dimensions
    seed: 20260912,
    wLo: -1, wHi: 1, wDp: 2,   // weights are drawn in [-1, 1] and kept to 2 decimals so they are readable
    bits8: 8,
    bits4: 4,
    outlierRow: 1,        // which channel gets the planted outlier
    outlierCol: 5,
    outlierVal: 6.4,      // the one large weight — the whole of tab 2 is about this number
    bigLayer: 4096,       // a realistic layer width, used only for the "what this saves at scale" arithmetic
    fp32Bytes: 4
  };

  var rng = M.mulberry32(CFG.seed);

  // ---- the one tensor everything on the page is about ----
  var W = M.seededMatrix(rng, CFG.rows, CFG.cols, CFG.wLo, CFG.wHi, CFG.wDp);   // (4, 8)

  var rowLabels = [], colLabels = [];
  for (var i = 0; i < CFG.rows; i++) rowLabels.push('out' + i);
  for (var j = 0; j < CFG.cols; j++) colLabels.push('in' + j);

  // ---------- small helpers on plain arrays-of-arrays ----------
  function clone(m) { return m.map(function (r) { return r.slice(); }); }
  function mapMat(m, f) { return m.map(function (r, i) { return r.map(function (v, j) { return f(v, i, j); }); }); }
  function absMat(m) { return mapMat(m, function (v) { return Math.abs(v); }); }
  function flat(m) { var a = []; m.forEach(function (r) { a = a.concat(r); }); return a; }
  function times(m, k) { return M.scaleMat(m, k); }
  function subMat(a, b) { return M.addMat(a, M.scaleMat(b, -1)); }

  function maxAbsCell(m, rowFilter) {
    var best = { v: -Infinity, i: -1, j: -1 };
    for (var i = 0; i < m.length; i++) {
      if (rowFilter && rowFilter.indexOf(i) === -1) continue;
      for (var j = 0; j < m[i].length; j++) {
        var a = Math.abs(m[i][j]);
        if (a > best.v) best = { v: a, i: i, j: j };
      }
    }
    return best;
  }

  // ---------- the integer grid a b-bit symmetric scheme actually offers ----------
  // Symmetric quantization throws away the most negative pattern (−128 at 8 bits) so
  // that the grid is centred on an exact zero. 8 bits therefore gives 255 usable codes,
  // not 256, and 4 bits gives 15, not 16.
  function qMax(bits) { return Math.pow(2, bits - 1) - 1; }
  function nCodes(bits) { return 2 * qMax(bits) + 1; }
  function clampCode(v, bits) { var q = qMax(bits); return Math.max(-q, Math.min(q, v)); }

  // ---------- per-tensor: ONE scale for every weight in the block ----------
  function quantPerTensor(Wm, bits) {
    var q = qMax(bits);
    var peak = maxAbsCell(Wm);
    var scale = peak.v / q;
    var div = mapMat(Wm, function (v) { return v / scale; });          // real-valued, spans ±q
    var rounded = mapMat(div, function (v) { return Math.round(v); }); // nearest integer
    var codes = mapMat(rounded, function (v) { return clampCode(v, bits); });
    var clampedMask = mapMat(rounded, function (v, i, j) { return v !== codes[i][j]; });
    var nClamped = flat(clampedMask).filter(Boolean).length;
    var deq = mapMat(codes, function (v) { return v * scale; });
    var err = subMat(Wm, deq);
    return {
      mode: 'per-tensor', bits: bits, qMax: q, nCodes: nCodes(bits),
      peak: peak, scale: scale, scales: [scale],
      div: div, rounded: rounded, codes: codes,
      clampedMask: clampedMask, nClamped: nClamped,
      deq: deq, err: err, stats: errStats(err), bound: scale / 2
    };
  }

  // ---------- per-channel: one scale per ROW, derived from that row alone ----------
  function quantPerChannel(Wm, bits) {
    var q = qMax(bits);
    var rowPeak = Wm.map(function (r) { return Math.max.apply(null, r.map(Math.abs)); });
    var scales = rowPeak.map(function (v) { return v / q; });
    var div = mapMat(Wm, function (v, i) { return v / scales[i]; });
    var rounded = mapMat(div, function (v) { return Math.round(v); });
    var codes = mapMat(rounded, function (v) { return clampCode(v, bits); });
    var deq = mapMat(codes, function (v, i) { return v * scales[i]; });
    var err = subMat(Wm, deq);
    return {
      mode: 'per-channel', bits: bits, qMax: q, nCodes: nCodes(bits),
      rowPeak: rowPeak, scales: scales, scale: null,
      div: div, rounded: rounded, codes: codes, nClamped: 0,
      deq: deq, err: err, stats: errStats(err),
      bounds: scales.map(function (s) { return s / 2; })
    };
  }

  // ---------- error accounting ----------
  function errStats(err, rowFilter) {
    var vals = [];
    err.forEach(function (r, i) {
      if (rowFilter && rowFilter.indexOf(i) === -1) return;
      r.forEach(function (v) { vals.push(Math.abs(v)); });
    });
    var mx = Math.max.apply(null, vals);
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return { maxAbs: mx, meanAbs: mean, n: vals.length };
  }

  // ---------- how much of the integer range the codes actually occupy ----------
  function codeStats(codes, bits, rowFilter) {
    var vals = [];
    codes.forEach(function (r, i) {
      if (rowFilter && rowFilter.indexOf(i) === -1) return;
      vals = vals.concat(r);
    });
    var seen = {}, distinct = 0;
    vals.forEach(function (v) { if (!seen[v]) { seen[v] = 1; distinct++; } });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = hi - lo + 1;                       // integer codes between the extremes, inclusive
    var total = nCodes(bits);
    return {
      values: vals, distinct: distinct, min: lo, max: hi, span: span,
      total: total, pct: span / total * 100,
      effBits: Math.log(span) / Math.log(2),      // bits actually exercised by this group of weights
      lostBits: bits - Math.log(span) / Math.log(2)
    };
  }

  // ---------- weights that became the same number: information destroyed outright ----------
  // Grouping is by the DEQUANTIZED value, not by the integer code. Under per-channel
  // scaling the same code in two different rows is two different floats, so grouping
  // by code would invent collisions that do not exist. Two weights are genuinely
  // indistinguishable after the round trip exactly when q·s comes out equal.
  function collisions(Wm, deq, codes, rowFilter) {
    var byVal = {}, order = [];
    Wm.forEach(function (r, i) {
      if (rowFilter && rowFilter.indexOf(i) === -1) return;
      r.forEach(function (v, j) {
        var key = String(deq[i][j]);
        if (!byVal[key]) { byVal[key] = { value: deq[i][j], codes: [], values: [], cells: [] }; order.push(key); }
        var g = byVal[key];
        if (g.values.indexOf(v) === -1) g.values.push(v);
        if (g.codes.indexOf(codes[i][j]) === -1) g.codes.push(codes[i][j]);
        g.cells.push({ i: i, j: j, w: v });
      });
    });
    var groups = [];
    order.forEach(function (k) { if (byVal[k].values.length > 1) groups.push(byVal[k]); });
    groups.sort(function (a, b) { return b.values.length - a.values.length || a.value - b.value; });
    var collided = groups.reduce(function (a, g) { return a + g.values.length; }, 0);
    var biggest = groups.length ? Math.max.apply(null, groups.map(function (g) { return g.values.length; })) : 0;
    return { groups: groups, nGroups: groups.length, nCollidedValues: collided, merged: collided - groups.length, biggest: biggest };
  }

  function distinctWeights(Wm, rowFilter) {
    var seen = {}, n = 0;
    Wm.forEach(function (r, i) {
      if (rowFilter && rowFilter.indexOf(i) === -1) return;
      r.forEach(function (v) { if (!seen[v]) { seen[v] = 1; n++; } });
    });
    return n;
  }

  // ---------- memory ----------
  function memory(rows, cols, bits, mode) {
    var weightBytes = rows * cols * bits / 8;
    // float weights carry no scale at all; per-tensor carries exactly one fp32;
    // per-channel carries one fp32 per row — that overhead is real and is counted here.
    var nScales = mode === 'none' ? 0 : (mode === 'per-channel' ? rows : 1);
    var scaleBytes = nScales * CFG.fp32Bytes;
    return { weightBytes: weightBytes, scaleBytes: scaleBytes, nScales: nScales, total: weightBytes + scaleBytes };
  }
  function bigLayerMB(bits, mode) {
    var n = CFG.bigLayer;
    var b = memory(n, n, bits, mode);
    return b.total / (1024 * 1024);
  }

  // ---------- the self-check: is a dequantized weight literally code × scale? ----------
  function selfCheck(Wm, bits) {
    var t = quantPerTensor(Wm, bits);

    // (a) recompute the single worst-error cell by hand, from its printed code and the printed scale
    var worst = maxAbsCell(t.err);
    var i = worst.i, j = worst.j;
    var byHand = t.codes[i][j] * t.scale;
    var handDiff = Math.abs(byHand - t.deq[i][j]);

    // (b) idempotence: quantize the dequantized matrix again, with the scale re-derived from it
    var peak2 = maxAbsCell(t.deq);
    var scale2 = peak2.v / t.qMax;
    var scaleDiff = Math.abs(scale2 - t.scale);
    var codes2 = mapMat(t.deq, function (v) { return clampCode(Math.round(v / scale2), bits); });
    var codeDiff = M.maxAbsDiff(codes2, t.codes);
    var deq2 = mapMat(codes2, function (v) { return v * scale2; });
    var deqDiff = M.maxAbsDiff(deq2, t.deq);

    // (c) the rounding bound: no error may exceed half a step
    var bound = t.scale / 2;
    var boundOk = t.stats.maxAbs <= bound + 1e-12;

    return {
      t: t, i: i, j: j, code: t.codes[i][j], scale: t.scale,
      byHand: byHand, stored: t.deq[i][j], handDiff: handDiff,
      scale2: scale2, scaleDiff: scaleDiff, codes2: codes2, codeDiff: codeDiff, deqDiff: deqDiff,
      bound: bound, boundOk: boundOk, worstErr: t.err[i][j],
      ok: handDiff === 0 && codeDiff === 0 && deqDiff === 0 && scaleDiff === 0 && boundOk
    };
  }

  // ---------- a sampled view of the representable grid ----------
  function ladder(scale, bits, nSamples) {
    var q = qMax(bits), out = [], codes = [];
    var k = (nSamples - 1) / 2;
    for (var s = -k; s <= k; s++) {
      var c = Math.round(q * s / k);
      codes.push(c);
      out.push(c * scale);
    }
    return { codes: codes, values: out, step: scale };
  }

  // ================= the four matrices / passes this page walks through =================
  var Wout = clone(W);
  Wout[CFG.outlierRow][CFG.outlierCol] = CFG.outlierVal;

  var ORDINARY_ROWS = [];   // every row except the one holding the outlier
  for (var r = 0; r < CFG.rows; r++) if (r !== CFG.outlierRow) ORDINARY_ROWS.push(r);

  window.QuantizationLabModel = {
    CFG: CFG, W: W, Wout: Wout, rowLabels: rowLabels, colLabels: colLabels,
    ORDINARY_ROWS: ORDINARY_ROWS,
    clone: clone, mapMat: mapMat, absMat: absMat, flat: flat, times: times, subMat: subMat,
    maxAbsCell: maxAbsCell, qMax: qMax, nCodes: nCodes, clampCode: clampCode,
    quantPerTensor: quantPerTensor, quantPerChannel: quantPerChannel,
    errStats: errStats, codeStats: codeStats, collisions: collisions, distinctWeights: distinctWeights,
    memory: memory, bigLayerMB: bigLayerMB, selfCheck: selfCheck, ladder: ladder
  };
})();
