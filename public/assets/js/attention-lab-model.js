/* KnowML — Attention Lab: the worked example itself.
   Fixed, tiny hyperparameters so every matrix fits on screen and every number
   can be checked by hand. Everything downstream is computed here in real
   arithmetic (see engine.js) — nothing below is a hand-typed "for illustration"
   number. */
(function () {
  'use strict';
  var M = window.KMLLabMath;

  var CFG = {
    dModel: 8,          // width of every token vector — the thing attention moves information through
    H: 4,               // query heads
    dH: 2,              // per-head dimension = dModel / H
    gqaGroups: 2,       // GQA: this many distinct KV heads, shared across query heads
    mqaHeads: 1,        // MQA: exactly one KV head, shared by every query head
    dC: 4,              // MLA: compressed latent dimension (cached instead of full K/V)
    blockSize: 2,       // PagedAttention / FlashAttention tile size
    vocab: ['The', 'cat', 'sat', 'down', '.'],
    prefillLen: 4,      // tokens present before the decode step
    seed: 20260906
  };

  var rng = M.mulberry32(CFG.seed);
  var lo = -1, hi = 1, dp = 1; // range and decimal places for every random weight/embedding

  // ---- shared parameters, drawn once from the seeded stream, in a fixed order ----
  var E = M.seededMatrix(rng, CFG.vocab.length, CFG.dModel, lo, hi, dp);           // embedding table (5, 8)
  var Wq = M.seededMatrix(rng, CFG.dModel, CFG.dModel, lo, hi, dp);                // (8,8) — H*dH = 8
  var Wk = M.seededMatrix(rng, CFG.dModel, CFG.dModel, lo, hi, dp);                // MHA: full-size K proj
  var Wv = M.seededMatrix(rng, CFG.dModel, CFG.dModel, lo, hi, dp);                // MHA: full-size V proj
  var Wo = M.seededMatrix(rng, CFG.dModel, CFG.dModel, lo, hi, dp);                // output projection

  var Wk_gqa = M.seededMatrix(rng, CFG.dModel, CFG.gqaGroups * CFG.dH, lo, hi, dp); // (8,4) -> 2 kv heads
  var Wv_gqa = M.seededMatrix(rng, CFG.dModel, CFG.gqaGroups * CFG.dH, lo, hi, dp);

  var Wk_mqa = M.seededMatrix(rng, CFG.dModel, CFG.mqaHeads * CFG.dH, lo, hi, dp);  // (8,2) -> 1 kv head
  var Wv_mqa = M.seededMatrix(rng, CFG.dModel, CFG.mqaHeads * CFG.dH, lo, hi, dp);

  var Wdkv = M.seededMatrix(rng, CFG.dModel, CFG.dC, lo, hi, dp);   // MLA down-projection (8,4)
  var Wuk  = M.seededMatrix(rng, CFG.dC, CFG.dModel, lo, hi, dp);   // MLA up-projection for K (4,8)
  var Wuv  = M.seededMatrix(rng, CFG.dC, CFG.dModel, lo, hi, dp);   // MLA up-projection for V (4,8)

  function tokenIds(words) { return words.map(function (w) { return CFG.vocab.indexOf(w); }); }
  function embed(ids) { return ids.map(function (id) { return E[id].slice(); }); }

  function splitHeads(mat, nHeads, dHead) {
    // (T, nHeads*dHead) -> array of nHeads matrices, each (T, dHead)
    var out = [];
    for (var h = 0; h < nHeads; h++) out.push(M.sliceCols(mat, h * dHead, (h + 1) * dHead));
    return out;
  }

  function attentionCore(Qh, Kh, Vh, rowOffset, colOffset, dHead) {
    // Qh:(Tq,dHead) Kh:(Tk,dHead) Vh:(Tk,dHead) -> {scores, masked, weights, out}
    var scores = M.scaleMat(M.matmul(Qh, M.transpose(Kh)), 1 / Math.sqrt(dHead));
    var mask = M.causalMask(Qh.length, Kh.length, rowOffset, colOffset);
    var weights = M.softmaxRows(scores, mask);
    var out = M.matmul(weights, Vh);
    return { scores: scores, mask: mask, weights: weights, out: out };
  }

  // ---------- build the full prefill pass (tokens 0..3) for a given "core" ----------
  function prefill() {
    var ids = tokenIds(CFG.vocab.slice(0, CFG.prefillLen));
    var X = embed(ids); // (4,8)
    var Q = M.matmul(X, Wq), K = M.matmul(X, Wk), V = M.matmul(X, Wv);
    var Qh = splitHeads(Q, CFG.H, CFG.dH), Kh = splitHeads(K, CFG.H, CFG.dH), Vh = splitHeads(V, CFG.H, CFG.dH);
    var heads = [];
    for (var h = 0; h < CFG.H; h++) heads.push(attentionCore(Qh[h], Kh[h], Vh[h], 0, 0, CFG.dH));
    var concat = M.concatCols.apply(null, heads.map(function (hh) { return hh.out; }));
    var Y = M.matmul(concat, Wo);
    return { ids: ids, X: X, Q: Q, K: K, V: V, Qh: Qh, Kh: Kh, Vh: Vh, heads: heads, concat: concat, Y: Y };
  }

  // ---------- decode step: token 4 ("."), reusing the prefill K/V cache ----------
  function decodeStep(pre) {
    var id5 = tokenIds(['.'])[0];
    var x5 = embed([id5]); // (1,8)
    var q5 = M.matmul(x5, Wq), k5 = M.matmul(x5, Wk), v5 = M.matmul(x5, Wv);
    var q5h = splitHeads(q5, CFG.H, CFG.dH), k5h = splitHeads(k5, CFG.H, CFG.dH), v5h = splitHeads(v5, CFG.H, CFG.dH);
    var heads = [];
    for (var h = 0; h < CFG.H; h++) {
      var Kcache = M.concatRows(pre.Kh[h], k5h[h]); // (5, dH)
      var Vcache = M.concatRows(pre.Vh[h], v5h[h]);
      heads.push({ Kcache: Kcache, Vcache: Vcache, core: attentionCore(q5h[h], Kcache, Vcache, CFG.prefillLen, 0, CFG.dH) });
    }
    var concat = M.concatCols.apply(null, heads.map(function (hh) { return hh.core.out; }));
    var Y = M.matmul(concat, Wo);
    return { id5: id5, x5: x5, q5: q5, k5: k5, v5: v5, q5h: q5h, k5h: k5h, v5h: v5h, heads: heads, concat: concat, Y: Y };
  }

  // ---------- MQA: all H query heads share ONE kv head ----------
  function mqaPass() {
    var ids = tokenIds(CFG.vocab.slice(0, CFG.prefillLen));
    var X = embed(ids);
    var Q = M.matmul(X, Wq);
    var Kshared = M.matmul(X, Wk_mqa), Vshared = M.matmul(X, Wv_mqa); // (4,2)
    var Qh = splitHeads(Q, CFG.H, CFG.dH);
    var heads = [];
    for (var h = 0; h < CFG.H; h++) heads.push(attentionCore(Qh[h], Kshared, Vshared, 0, 0, CFG.dH));
    var concat = M.concatCols.apply(null, heads.map(function (hh) { return hh.out; }));
    var Y = M.matmul(concat, Wo);
    return { ids: ids, X: X, Q: Q, Qh: Qh, Kshared: Kshared, Vshared: Vshared, heads: heads, concat: concat, Y: Y };
  }

  // ---------- GQA: H query heads grouped into gqaGroups kv heads ----------
  function gqaPass() {
    var ids = tokenIds(CFG.vocab.slice(0, CFG.prefillLen));
    var X = embed(ids);
    var Q = M.matmul(X, Wq);
    var Kg = M.matmul(X, Wk_gqa), Vg = M.matmul(X, Wv_gqa); // (4,4) -> 2 kv heads of (4,2)
    var Qh = splitHeads(Q, CFG.H, CFG.dH);
    var Kgh = splitHeads(Kg, CFG.gqaGroups, CFG.dH), Vgh = splitHeads(Vg, CFG.gqaGroups, CFG.dH);
    var groupSize = CFG.H / CFG.gqaGroups;
    var groupOf = function (h) { return Math.floor(h / groupSize); };
    var heads = [];
    for (var h = 0; h < CFG.H; h++) {
      var g = groupOf(h);
      heads.push(attentionCore(Qh[h], Kgh[g], Vgh[g], 0, 0, CFG.dH));
    }
    var concat = M.concatCols.apply(null, heads.map(function (hh) { return hh.out; }));
    var Y = M.matmul(concat, Wo);
    return { ids: ids, X: X, Q: Q, Qh: Qh, Kg: Kg, Vg: Vg, Kgh: Kgh, Vgh: Vgh, groupOf: groupOf, heads: heads, concat: concat, Y: Y };
  }

  // ---------- MLA: compress to latent c, cache only c, up-project on the fly ----------
  function mlaPass() {
    var ids = tokenIds(CFG.vocab.slice(0, CFG.prefillLen));
    var X = embed(ids);
    var Q = M.matmul(X, Wq);
    var C = M.matmul(X, Wdkv);              // (4,4) — THIS is what gets cached, not K or V
    var Kc = M.matmul(C, Wuk);               // (4,8) reconstructed full-width K, up-projected on demand
    var Vc = M.matmul(C, Wuv);               // (4,8)
    var Qh = splitHeads(Q, CFG.H, CFG.dH), Kh = splitHeads(Kc, CFG.H, CFG.dH), Vh = splitHeads(Vc, CFG.H, CFG.dH);
    var heads = [];
    for (var h = 0; h < CFG.H; h++) heads.push(attentionCore(Qh[h], Kh[h], Vh[h], 0, 0, CFG.dH));
    var concat = M.concatCols.apply(null, heads.map(function (hh) { return hh.out; }));
    var Y = M.matmul(concat, Wo);
    return { ids: ids, X: X, Q: Q, Qh: Qh, C: C, Kc: Kc, Vc: Vc, Kh: Kh, Vh: Vh, heads: heads, concat: concat, Y: Y };
  }

  // ---------- FlashAttention: tiled online-softmax, must equal head 0 of the MHA prefill ----------
  function flashPass(pre) {
    var h = 0, dHead = CFG.dH, T = CFG.prefillLen, B = CFG.blockSize;
    var Qh = pre.Qh[h], Kh = pre.Kh[h], Vh = pre.Vh[h];
    var nTiles = Math.ceil(T / B);
    var tiles = []; // one entry per query tile i, each with its inner j-loop trace
    var Ofull = M.zeros(T, dHead);
    for (var i = 0; i < nTiles; i++) {
      var qi0 = i * B, qi1 = Math.min(T, qi0 + B);
      var Qi = M.sliceRows(Qh, qi0, qi1);
      var rows = qi1 - qi0;
      var m = new Array(rows).fill(-Infinity);
      var l = new Array(rows).fill(0);
      var O = M.zeros(rows, dHead);
      var jTrace = [];
      for (var j = 0; j <= i; j++) { // causal: never even loads j > i
        var kj0 = j * B, kj1 = Math.min(T, kj0 + B);
        var Kj = M.sliceRows(Kh, kj0, kj1), Vj = M.sliceRows(Vh, kj0, kj1);
        var Sij = M.scaleMat(M.matmul(Qi, M.transpose(Kj)), 1 / Math.sqrt(dHead));
        var maskij = M.causalMask(rows, kj1 - kj0, qi0, kj0);
        var maskedS = Sij.map(function (row, ri) { return row.map(function (v, ci) { return maskij[ri][ci] ? -Infinity : v; }); });
        var tileMax = maskedS.map(function (row) { return Math.max.apply(null, row.filter(function (v) { return v !== -Infinity; })); });
        var mNew = m.map(function (v, ri) { return Math.max(v, tileMax[ri]); });
        var Pij = maskedS.map(function (row, ri) { return row.map(function (v) { return v === -Infinity ? 0 : Math.exp(v - mNew[ri]); }); });
        var rowSumP = Pij.map(function (row) { return row.reduce(function (a, b) { return a + b; }, 0); });
        var alpha = m.map(function (v, ri) { return Math.exp(v - mNew[ri]); }); // rescale factor for the OLD accumulator (0 the very first time since m=-Inf)
        var lNew = l.map(function (v, ri) { return alpha[ri] * v + rowSumP[ri]; });
        var PV = M.matmul(Pij, Vj);
        var Onew = O.map(function (row, ri) { return row.map(function (v, ci) { return alpha[ri] * v + PV[ri][ci]; }); });
        jTrace.push({ j: j, kj0: kj0, kj1: kj1, Sij: Sij, maskij: maskij, tileMax: tileMax, mOld: m.slice(), mNew: mNew.slice(),
                      Pij: Pij, alpha: alpha, lOld: l.slice(), lNew: lNew.slice(), Oold: O, Onew: Onew });
        m = mNew; l = lNew; O = Onew;
      }
      var Ofinal = O.map(function (row, ri) { return row.map(function (v) { return v / l[ri]; }); });
      for (var r = 0; r < rows; r++) Ofull[qi0 + r] = Ofinal[r];
      tiles.push({ i: i, qi0: qi0, qi1: qi1, jTrace: jTrace, m: m, l: l, Ofinal: Ofinal });
    }
    var diff = M.maxAbsDiff(Ofull, pre.heads[h].out);
    return { h: h, B: B, nTiles: nTiles, tiles: tiles, Ofull: Ofull, reference: pre.heads[h].out, maxAbsDiff: diff };
  }

  // ---------- PagedAttention: same 5-token cache as decodeStep, stored in fixed blocks ----------
  function pagedLayout(dec) {
    var B = CFG.blockSize, T = CFG.prefillLen + 1; // 5 tokens now cached
    var nLogicalBlocks = Math.ceil(T / B);
    var maxLen = 8; // a made-up per-request reservation ceiling, for the "naive contiguous" contrast
    var naiveBlocksReserved = Math.ceil(maxLen / B);
    var physicalPoolSize = 8;
    var physicalIds = [6, 1, 4]; // deliberately out of order: makes the "non-contiguous" point visible
    var blockTable = [];
    for (var b = 0; b < nLogicalBlocks; b++) {
      var startTok = b * B, endTok = Math.min(T, startTok + B);
      blockTable.push({ logical: b, physical: physicalIds[b], tokensHeld: endTok - startTok, startTok: startTok, endTok: endTok });
    }
    return { T: T, blockSize: B, nLogicalBlocks: nLogicalBlocks, naiveBlocksReserved: naiveBlocksReserved,
             wastedNaive: naiveBlocksReserved - nLogicalBlocks, physicalPoolSize: physicalPoolSize, blockTable: blockTable };
  }

  window.KMLLabModel = {
    CFG: CFG, E: E, Wq: Wq, Wk: Wk, Wv: Wv, Wo: Wo,
    Wk_gqa: Wk_gqa, Wv_gqa: Wv_gqa, Wk_mqa: Wk_mqa, Wv_mqa: Wv_mqa,
    Wdkv: Wdkv, Wuk: Wuk, Wuv: Wuv,
    tokenIds: tokenIds, embed: embed, splitHeads: splitHeads, attentionCore: attentionCore,
    prefill: prefill, decodeStep: decodeStep, mqaPass: mqaPass, gqaPass: gqaPass, mlaPass: mlaPass,
    flashPass: flashPass, pagedLayout: pagedLayout
  };
})();
