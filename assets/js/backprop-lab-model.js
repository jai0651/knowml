/* KnowML — Backprop Lab: the worked example itself.

   One tiny MLP — 3 inputs → 4 tanh hidden units → 2 linear outputs — and one
   training example. Every number this lab shows (forward activations, analytic
   gradients, numerical gradients, the descent step) is computed here in real
   arithmetic from a seeded RNG. Nothing is a hand-typed "for illustration"
   figure, which is the only way the gradient-check tab can mean anything: it
   really does re-derive all 29 partial derivatives two independent ways and
   compare them.

   Conventions, fixed once and used everywhere below:
     - Row-vector layout. One example is a 1×n_in row; a batch of N is N×n_in.
       So a layer is  Z = A·W + b  with W of shape (fan_in, fan_out).
     - Loss is half the sum of squares, averaged over the batch:
           L = (1/N) Σ_n ½ Σ_k (ŷ_nk − y_nk)²
       The ½ is not a fudge — it is what makes ∂L/∂ŷ come out as exactly the
       residual (ŷ − y), with no stray factor of 2 to explain away.
     - The output layer is linear (no activation), so ŷ = z2 and ∂ŷ/∂z2 = 1.
*/
(function () {
  'use strict';
  var M = window.KMLLabMath;

  var CFG = {
    nIn: 3,            // input features
    nHid: 4,           // hidden units (tanh)
    nOut: 2,           // outputs (linear)
    N: 2,              // examples in the batch tab; the other tabs use example 0 alone
    seed: 290427,      // chosen so no displayed cell rounds to 0.00 at two decimals
    h: 1e-5,           // finite-difference step for the gradient check
    eta: 0.25          // learning rate for the one-step-of-descent tab
  };

  // ---------- small elementwise helpers (the shared engine covers matmul/add/transpose) ----------
  function mapMat(m, f) { return m.map(function (row, i) { return row.map(function (v, j) { return f(v, i, j); }); }); }
  function hadamard(a, b) { return mapMat(a, function (v, i, j) { return v * b[i][j]; }); }
  function tileRows(rowVec, n) { var o = []; for (var i = 0; i < n; i++) o.push(rowVec[0].slice()); return o; }
  function colSums(m) { return [m[0].map(function (_, j) { return m.reduce(function (s, row) { return s + row[j]; }, 0); })]; }
  function cloneMat(m) { return m.map(function (r) { return r.slice(); }); }
  function flat(m) { return m.reduce(function (a, r) { return a.concat(r); }, []); }

  // ---------- the seeded example: two training rows, then the four parameter tensors ----------
  var rng = M.mulberry32(CFG.seed);
  var X = M.seededMatrix(rng, CFG.N, CFG.nIn, -1, 1, 1);       // (2,3) inputs
  var Y = M.seededMatrix(rng, CFG.N, CFG.nOut, -1, 1, 1);      // (2,2) targets
  var W1 = M.seededMatrix(rng, CFG.nIn, CFG.nHid, -1, 1, 1);   // (3,4)
  var b1 = M.seededMatrix(rng, 1, CFG.nHid, -0.5, 0.5, 1);     // (1,4)
  var W2 = M.seededMatrix(rng, CFG.nHid, CFG.nOut, -1, 1, 1);  // (4,2)
  var b2 = M.seededMatrix(rng, 1, CFG.nOut, -0.5, 0.5, 1);     // (1,2)

  var PARAMS = { W1: W1, b1: b1, W2: W2, b2: b2 };
  var x = [X[0].slice()];   // the single example every tab but the batch tab uses
  var y = [Y[0].slice()];

  var nParams = CFG.nIn * CFG.nHid + CFG.nHid + CFG.nHid * CFG.nOut + CFG.nOut;

  // ---------- forward ----------
  // Split into the same primitive operations the Forward tab steps through, so
  // the page never shows a number that was produced by a step it skipped.
  function forward(inX, inY, P) {
    var n = inX.length;
    var z1raw = M.matmul(inX, P.W1);                 // (n, nHid)  — the matmul alone
    var B1 = tileRows(P.b1, n);                      // broadcast: the same bias row, n times
    var z1 = M.addMat(z1raw, B1);                    // (n, nHid)  — the bias add alone
    var a1 = mapMat(z1, Math.tanh);                  // (n, nHid)
    var z2raw = M.matmul(a1, P.W2);                  // (n, nOut)
    var B2 = tileRows(P.b2, n);
    var z2 = M.addMat(z2raw, B2);                    // (n, nOut)
    var yhat = z2;                                   // linear output layer
    var resid = mapMat(yhat, function (v, i, j) { return v - inY[i][j]; });
    var sq = mapMat(resid, function (v) { return v * v; });
    var perExample = resid.map(function (row) {
      return 0.5 * row.reduce(function (s, v) { return s + v * v; }, 0);
    });
    var loss = perExample.reduce(function (s, v) { return s + v; }, 0) / n;
    return { n: n, z1raw: z1raw, B1: B1, z1: z1, a1: a1, z2raw: z2raw, B2: B2, z2: z2,
             yhat: yhat, resid: resid, sq: sq, perExample: perExample, loss: loss };
  }

  function lossOnly(inX, inY, P) { return forward(inX, inY, P).loss; }

  // ---------- backward ----------
  // Every quantity the Backward tab needs is returned separately, including the
  // *local* derivative of each step, so the page can show local × incoming = out
  // rather than just asserting the product.
  function backward(inX, inY, P, f) {
    var n = f.n;
    var dyhat = M.scaleMat(f.resid, 1 / n);          // ∂L/∂ŷ = (ŷ − y)/N
    var dz2 = dyhat;                                 // output is linear: ∂ŷ/∂z2 = 1
    var gb2 = colSums(dz2);                          // b2 was broadcast → its gradient sums over rows
    var gW2 = M.matmul(M.transpose(f.a1), dz2);      // (nHid, nOut)
    var da1 = M.matmul(dz2, M.transpose(P.W2));      // (n, nHid)
    var tanhPrime = mapMat(f.a1, function (v) { return 1 - v * v; });  // 1 − tanh²(z1)
    var dz1 = hadamard(da1, tanhPrime);              // (n, nHid)
    var gb1 = colSums(dz1);
    var gW1 = M.matmul(M.transpose(inX), dz1);       // (nIn, nHid)
    var gx = M.matmul(dz1, M.transpose(P.W1));       // (n, nIn) — what a previous layer would receive
    return { dyhat: dyhat, dz2: dz2, gb2: gb2, gW2: gW2, da1: da1,
             tanhPrime: tanhPrime, dz1: dz1, gb1: gb1, gW1: gW1, gx: gx };
  }

  var FWD = forward(x, y, PARAMS);
  var BWD = backward(x, y, PARAMS, FWD);

  // ---------- numerical gradients by central differences ----------
  // f(w+h) and f(w−h) each require a complete, independent forward pass. That
  // cost is the whole argument for backprop, and the check tab counts it.
  var fwdPassCount = 0;
  function perturbedLoss(P, key, i, j, delta) {
    var P2 = { W1: P.W1, b1: P.b1, W2: P.W2, b2: P.b2 };
    var m = cloneMat(P[key]);
    m[i][j] += delta;
    P2[key] = m;
    fwdPassCount++;
    return lossOnly(x, y, P2);
  }
  function perturbedLossX(xi, delta) {
    var x2 = cloneMat(x);
    x2[0][xi] += delta;
    fwdPassCount++;
    return lossOnly(x2, y, PARAMS);
  }
  function numericGradFor(P, key, h) {
    var m = P[key];
    return m.map(function (row, i) {
      return row.map(function (_, j) {
        return (perturbedLoss(P, key, i, j, h) - perturbedLoss(P, key, i, j, -h)) / (2 * h);
      });
    });
  }
  function numericGradX(h) {
    return [x[0].map(function (_, j) { return (perturbedLossX(j, h) - perturbedLossX(j, -h)) / (2 * h); })];
  }
  function numericAll(h) {
    return { W1: numericGradFor(PARAMS, 'W1', h), b1: numericGradFor(PARAMS, 'b1', h),
             W2: numericGradFor(PARAMS, 'W2', h), b2: numericGradFor(PARAMS, 'b2', h),
             x: numericGradX(h) };
  }

  function relErr(a, b) {
    var d = Math.abs(a - b), s = Math.abs(a) + Math.abs(b);
    return s === 0 ? 0 : d / s;
  }
  function compare(name, analytic, numeric) {
    var maxAbs = 0, maxRel = 0;
    for (var i = 0; i < analytic.length; i++) {
      for (var j = 0; j < analytic[0].length; j++) {
        maxAbs = Math.max(maxAbs, Math.abs(analytic[i][j] - numeric[i][j]));
        maxRel = Math.max(maxRel, relErr(analytic[i][j], numeric[i][j]));
      }
    }
    return { name: name, analytic: analytic, numeric: numeric, count: analytic.length * analytic[0].length,
             maxAbs: maxAbs, maxRel: maxRel };
  }

  function gradientCheck(h) {
    var num = numericAll(h);
    var parts = [
      compare('∂L/∂W₁', BWD.gW1, num.W1),
      compare('∂L/∂b₁', BWD.gb1, num.b1),
      compare('∂L/∂W₂', BWD.gW2, num.W2),
      compare('∂L/∂b₂', BWD.gb2, num.b2),
      compare('∂L/∂x', BWD.gx, num.x)
    ];
    var maxAbsDiff = Math.max.apply(null, parts.map(function (p) { return p.maxAbs; }));
    var maxRelErr = Math.max.apply(null, parts.map(function (p) { return p.maxRel; }));
    var total = parts.reduce(function (s, p) { return s + p.count; }, 0);
    return { h: h, parts: parts, numeric: num, maxAbsDiff: maxAbsDiff, maxRelErr: maxRelErr,
             total: total, ok: maxAbsDiff < 1e-7 };
  }

  fwdPassCount = 0;
  var CHECK = gradientCheck(CFG.h);
  var CHECK_PASSES = fwdPassCount;   // forward passes the check itself consumed

  // one parameter traced end to end, so the reader sees the quotient assembled
  var ONE = (function () {
    var key = 'W1', i = 0, j = 0, h = CFG.h;
    var w = PARAMS[key][i][j];
    var lPlus = perturbedLoss(PARAMS, key, i, j, h);
    var lMinus = perturbedLoss(PARAMS, key, i, j, -h);
    var l0 = FWD.loss;
    var central = (lPlus - lMinus) / (2 * h);
    var forwardDiff = (lPlus - l0) / h;
    var analytic = BWD.gW1[i][j];
    return { key: key, i: i, j: j, label: 'W₁[0,0]', w: w, h: h,
             l0: l0, lPlus: lPlus, lMinus: lMinus,
             central: central, forwardDiff: forwardDiff, analytic: analytic,
             errCentral: Math.abs(central - analytic), errForward: Math.abs(forwardDiff - analytic) };
  })();

  // the classic U-curve: truncation error falls as h², round-off rises as 1/h
  var H_SWEEP = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-10, 1e-12].map(function (h) {
    var c = gradientCheck(h);
    return { h: h, maxAbsDiff: c.maxAbsDiff, maxRelErr: c.maxRelErr };
  });
  var H_BEST = H_SWEEP.reduce(function (a, b) { return b.maxAbsDiff < a.maxAbsDiff ? b : a; });

  // ---------- one step of gradient descent ----------
  function descend(P, g, eta) {
    return {
      W1: mapMat(P.W1, function (v, i, j) { return v - eta * g.gW1[i][j]; }),
      b1: mapMat(P.b1, function (v, i, j) { return v - eta * g.gb1[i][j]; }),
      W2: mapMat(P.W2, function (v, i, j) { return v - eta * g.gW2[i][j]; }),
      b2: mapMat(P.b2, function (v, i, j) { return v - eta * g.gb2[i][j]; })
    };
  }
  var gradNormSq = flat(BWD.gW1).concat(flat(BWD.gb1), flat(BWD.gW2), flat(BWD.gb2))
    .reduce(function (s, v) { return s + v * v; }, 0);

  var STEP = (function () {
    var eta = CFG.eta;
    var P2 = descend(PARAMS, BWD, eta);
    var f2 = forward(x, y, P2);
    return { eta: eta, P2: P2, fwd2: f2, lossBefore: FWD.loss, lossAfter: f2.loss,
             drop: FWD.loss - f2.loss,
             gradNormSq: gradNormSq, gradNorm: Math.sqrt(gradNormSq),
             predictedDrop: eta * gradNormSq,
             predictedLoss: FWD.loss - eta * gradNormSq };
  })();

  // the same first-order prediction at shrinking η — the agreement improves like η²
  var LINEARITY = [0.25, 0.1, 0.05, 0.02, 0.01, 0.005].map(function (eta) {
    var f2 = forward(x, y, descend(PARAMS, BWD, eta));
    var actualDrop = FWD.loss - f2.loss;
    var predDrop = eta * gradNormSq;
    return { eta: eta, actualDrop: actualDrop, predDrop: predDrop,
             gap: Math.abs(actualDrop - predDrop), ratio: actualDrop / predDrop };
  });

  // loss as a function of the learning rate: down, then back up once η overshoots
  var ETA_SWEEP = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0].map(function (eta) {
    return { eta: eta, loss: forward(x, y, descend(PARAMS, BWD, eta)).loss };
  });
  var ETA_BEST = ETA_SWEEP.reduce(function (a, b) { return b.loss < a.loss ? b : a; });

  // ---------- the batch of N, and the check that it equals the per-example average ----------
  var BATCH = (function () {
    var f = forward(X, Y, PARAMS);
    var g = backward(X, Y, PARAMS, f);
    var per = [];
    for (var n = 0; n < CFG.N; n++) {
      var xn = [X[n].slice()], yn = [Y[n].slice()];
      var fn = forward(xn, yn, PARAMS);
      per.push({ n: n, x: xn, y: yn, fwd: fn, bwd: backward(xn, yn, PARAMS, fn) });
    }
    function avgOf(pick) {
      var acc = M.zeros(pick(per[0].bwd).length, pick(per[0].bwd)[0].length);
      per.forEach(function (p) { acc = M.addMat(acc, pick(p.bwd)); });
      return M.scaleMat(acc, 1 / CFG.N);
    }
    var avg = { gW1: avgOf(function (b) { return b.gW1; }), gb1: avgOf(function (b) { return b.gb1; }),
                gW2: avgOf(function (b) { return b.gW2; }), gb2: avgOf(function (b) { return b.gb2; }) };
    var diffs = [
      { name: '∂L/∂W₁', d: M.maxAbsDiff(g.gW1, avg.gW1) },
      { name: '∂L/∂b₁', d: M.maxAbsDiff(g.gb1, avg.gb1) },
      { name: '∂L/∂W₂', d: M.maxAbsDiff(g.gW2, avg.gW2) },
      { name: '∂L/∂b₂', d: M.maxAbsDiff(g.gb2, avg.gb2) }
    ];
    var maxAbsDiff = Math.max.apply(null, diffs.map(function (o) { return o.d; }));
    return { fwd: f, bwd: g, perExample: per, avg: avg, diffs: diffs,
             maxAbsDiff: maxAbsDiff, ok: maxAbsDiff < 1e-12 };
  })();

  window.BackpropLabModel = {
    CFG: CFG, nParams: nParams,
    X: X, Y: Y, W1: W1, b1: b1, W2: W2, b2: b2, PARAMS: PARAMS, x: x, y: y,
    mapMat: mapMat, hadamard: hadamard, tileRows: tileRows, colSums: colSums, flat: flat,
    forward: forward, backward: backward, descend: descend, gradientCheck: gradientCheck,
    FWD: FWD, BWD: BWD, CHECK: CHECK, CHECK_PASSES: CHECK_PASSES, ONE: ONE,
    H_SWEEP: H_SWEEP, H_BEST: H_BEST,
    STEP: STEP, LINEARITY: LINEARITY, ETA_SWEEP: ETA_SWEEP, ETA_BEST: ETA_BEST,
    BATCH: BATCH
  };
})();
