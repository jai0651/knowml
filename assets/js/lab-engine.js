/* KnowML — shared lab engine: linear algebra + a seeded RNG.
   Every number the page shows is computed here, live, from a seeded RNG — nothing
   is hand-typed and hand-verified. That is the only way to promise the numbers
   are actually correct at every step. */
(function () {
  'use strict';

  // ---------- seeded RNG (mulberry32) so the "worked example" is stable across reloads ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function round(x, d) { var m = Math.pow(10, d); return Math.round((x + 1e-9) * m) / m; }
  function seededMatrix(rng, rows, cols, lo, hi, decimals) {
    var m = [];
    for (var i = 0; i < rows; i++) {
      var row = [];
      for (var j = 0; j < cols; j++) row.push(round(lo + rng() * (hi - lo), decimals == null ? 1 : decimals));
      m.push(row);
    }
    return m;
  }

  // ---------- linear algebra on plain arrays of arrays ----------
  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(new Array(c).fill(0)); return m; }
  function shape(m) { return [m.length, m.length ? m[0].length : 0]; }
  function transpose(m) {
    var r = m.length, c = m[0].length, out = zeros(c, r);
    for (var i = 0; i < r; i++) for (var j = 0; j < c; j++) out[j][i] = m[i][j];
    return out;
  }
  function matmul(a, b) {
    var r = a.length, k = a[0].length, k2 = b.length, c = b[0].length;
    if (k !== k2) throw new Error('matmul shape mismatch: (' + r + 'x' + k + ') @ (' + k2 + 'x' + c + ')');
    var out = zeros(r, c);
    for (var i = 0; i < r; i++) {
      for (var j = 0; j < c; j++) {
        var s = 0;
        for (var p = 0; p < k; p++) s += a[i][p] * b[p][j];
        out[i][j] = s;
      }
    }
    return out;
  }
  function scaleMat(m, s) { return m.map(function (row) { return row.map(function (v) { return v * s; }); }); }
  function addMat(a, b) { return a.map(function (row, i) { return row.map(function (v, j) { return v + b[i][j]; }); }); }
  function roundMat(m, d) { return m.map(function (row) { return row.map(function (v) { return round(v, d); }); }); }
  function sliceRows(m, i0, i1) { return m.slice(i0, i1).map(function (r) { return r.slice(); }); }
  function sliceCols(m, j0, j1) { return m.map(function (row) { return row.slice(j0, j1); }); }
  function concatCols() {
    var mats = Array.prototype.slice.call(arguments);
    var rows = mats[0].length, out = [];
    for (var i = 0; i < rows; i++) {
      var row = [];
      for (var k = 0; k < mats.length; k++) row = row.concat(mats[k][i]);
      out.push(row);
    }
    return out;
  }
  function concatRows() {
    var mats = Array.prototype.slice.call(arguments);
    var out = [];
    for (var k = 0; k < mats.length; k++) for (var i = 0; i < mats[k].length; i++) out.push(mats[k][i].slice());
    return out;
  }
  // softmax over each row, with optional mask (same shape, true = masked out i.e. -Infinity)
  function softmaxRows(m, mask) {
    return m.map(function (row, i) {
      var masked = row.map(function (v, j) { return (mask && mask[i][j]) ? -Infinity : v; });
      var mx = Math.max.apply(null, masked.filter(function (v) { return v !== -Infinity; }));
      var exps = masked.map(function (v) { return v === -Infinity ? 0 : Math.exp(v - mx); });
      var sum = exps.reduce(function (a, b) { return a + b; }, 0);
      return exps.map(function (v) { return v / sum; });
    });
  }
  function causalMask(rows, cols, rowOffset, colOffset) {
    // mask[i][j] = true  <=>  the token at (global) row position may NOT see the token at (global) col position
    var m = [];
    for (var i = 0; i < rows; i++) {
      var r = [];
      for (var j = 0; j < cols; j++) r.push((colOffset + j) > (rowOffset + i));
      m.push(r);
    }
    return m;
  }
  function maxAbsDiff(a, b) {
    var m = 0;
    for (var i = 0; i < a.length; i++) for (var j = 0; j < a[0].length; j++) m = Math.max(m, Math.abs(a[i][j] - b[i][j]));
    return m;
  }

  window.KMLLabMath = {
    mulberry32: mulberry32, round: round, seededMatrix: seededMatrix,
    zeros: zeros, shape: shape, transpose: transpose, matmul: matmul,
    scaleMat: scaleMat, addMat: addMat, roundMat: roundMat,
    sliceRows: sliceRows, sliceCols: sliceCols, concatCols: concatCols, concatRows: concatRows,
    softmaxRows: softmaxRows, causalMask: causalMask, maxAbsDiff: maxAbsDiff
  };
})();
