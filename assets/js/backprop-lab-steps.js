/* KnowML — Backprop Lab: forward pass, chain rule backward, numerical gradient
   check, one descent step, and the jump from one example to a batch.

   Every step is one primitive operation — one matmul, one bias add, one
   elementwise function, one product of a local derivative with an incoming
   gradient. The backward steps always show all three pieces (local derivative,
   incoming gradient, their product) so the chain rule is visible rather than
   asserted, and the gradient-check tab recomputes all 29 partial derivatives
   from scratch with central differences and prints the worst disagreement. */
(function () {
  'use strict';
  var M = window.KMLLabMath, Mo = window.BackpropLabModel, UI = window.KMLLabUI, CFG = Mo.CFG;

  var F = Mo.FWD, G = Mo.BWD, C = Mo.CHECK, ONE = Mo.ONE, S = Mo.STEP, BT = Mo.BATCH;

  var R2 = function (m) { return M.roundMat(m, 2); };
  var IN_LBL = ['x₀', 'x₁', 'x₂'];
  var HID_LBL = ['h₀', 'h₁', 'h₂', 'h₃'];
  var OUT_LBL = ['o₀', 'o₁'];
  var EX_LBL = ['ex 0'];
  var BATCH_ROWS = ['ex 0', 'ex 1'];

  // signed fixed-point, matching the grids' own formatting
  function sgn(v, d) {
    d = d == null ? 2 : d;
    var a = Math.abs(v);
    if (Number(a.toFixed(d)) === 0) return '0.' + new Array(d + 1).join('0');
    return (v < 0 ? '−' : '+') + a.toFixed(d);
  }
  function sci(v, d) {
    var s = v.toExponential(d == null ? 2 : d);
    return s.replace('-', '−').replace('e−', 'e-').replace('e+', 'e+');
  }
  function exp(v, d) { return v === 0 ? '0' : v.toExponential(d == null ? 2 : d).replace('-', '−'); }
  // how many decimal places two numbers this far apart still agree on
  function agreeingPlaces(err) { return err === 0 ? 16 : Math.max(0, Math.floor(-Math.log10(Math.abs(err)))); }

  // derived facts the prose quotes, all computed rather than typed
  var PARAM_COUNTS = { W1: CFG.nIn * CFG.nHid, b1: CFG.nHid, W2: CFG.nHid * CFG.nOut, b2: CFG.nOut };
  var LAYER1_PARAMS = PARAM_COUNTS.W1 + PARAM_COUNTS.b1;
  var LAYER2_PARAMS = PARAM_COUNTS.W2 + PARAM_COUNTS.b2;
  var GRAD_MAX = Math.max.apply(null, [].concat(
    Mo.flat(Mo.BWD.gW1), Mo.flat(Mo.BWD.gb1), Mo.flat(Mo.BWD.gW2), Mo.flat(Mo.BWD.gb2), Mo.flat(Mo.BWD.gx)
  ).map(Math.abs));
  var SW_FIRST = Mo.H_SWEEP[0], SW_LAST = Mo.H_SWEEP[Mo.H_SWEEP.length - 1];
  var SW_ORDERS = Math.round(Math.log10(SW_FIRST.maxAbsDiff / Mo.H_BEST.maxAbsDiff));
  var SW_COARSEST_BEATING = Mo.H_SWEEP.filter(function (s) { return s.maxAbsDiff < SW_LAST.maxAbsDiff; })
    .reduce(function (a, b) { return b.h > a.h ? b : a; });

  // ---------- small renderers built only from the shared UI primitives ----------
  function ledgerNote(name, shapeLabel, meaning) {
    UI.getLedger().push({ name: name, shapeLabel: shapeLabel || '', meaning: meaning || '' });
  }
  function chainRows(rows) {
    // rows: [[left, middle, right], ...] — reuses the shared mono "a → b" row style
    var wrap = UI.el('div', 'lab-groupmap');
    rows.forEach(function (r) {
      var row = UI.el('div', 'lab-groupmap-row');
      row.innerHTML = '<span class="lab-groupmap-q">' + r[0] + '</span>' +
        '<span class="lab-groupmap-arrow">' + (r[1] || '=') + '</span>' +
        '<span class="lab-groupmap-kv">' + r[2] + '</span>';
      wrap.appendChild(row);
    });
    return wrap;
  }
  function tablePanel(opts) {
    // opts: {title, shapeLabel, headers:[], rows:[[]], meaning, highlight: fn(rowIndex)->bool}
    var wrap = UI.el('div', 'lab-panel');
    wrap.appendChild(UI.el('div', 'lab-panel-head',
      '<span class="lab-panel-title">' + opts.title + '</span>' +
      (opts.shapeLabel ? '<span class="lab-panel-shape">' + opts.shapeLabel + '</span>' : '')));
    var t = UI.el('table', 'lab-table');
    t.innerHTML = '<thead><tr>' + opts.headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>';
    var tb = UI.el('tbody');
    opts.rows.forEach(function (r, i) {
      var tr = UI.el('tr', (opts.highlight && opts.highlight(i)) ? 'lab-row--highlight' : '');
      tr.innerHTML = r.map(function (c) { return '<td>' + c + '</td>'; }).join('');
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    if (opts.meaning) wrap.appendChild(UI.el('div', 'lab-panel-meaning', opts.meaning));
    ledgerNote(opts.title, opts.shapeLabel || (opts.rows.length + ' rows'), opts.meaning || '');
    return wrap;
  }
  function unitsPanel(opts) {
    // opts: {title, labels:[], shapeLabel, meaning}
    var wrap = UI.el('div', 'lab-panel');
    wrap.appendChild(UI.el('div', 'lab-panel-head',
      '<span class="lab-panel-title">' + opts.title + '</span>' +
      (opts.shapeLabel ? '<span class="lab-panel-shape">' + opts.shapeLabel + '</span>' : '')));
    var row = UI.el('div', 'lab-pool');
    opts.labels.forEach(function (l) { row.appendChild(UI.el('div', 'lab-pool-block lab-pool-block--used', l)); });
    wrap.appendChild(row);
    if (opts.meaning) wrap.appendChild(UI.el('div', 'lab-panel-meaning', opts.meaning));
    return wrap;
  }
  function scalarPanel(opts) {
    // one number, rendered as a 1×1 grid so it is formatted like everything else
    return UI.matrixPanel({
      title: opts.title, shapeLabel: opts.shapeLabel || 'scalar', matrix: [[opts.value]],
      colorMode: opts.colorMode, maxAbs: opts.maxAbs, meaning: opts.meaning,
      fresh: opts.fresh, dim: opts.dim
    });
  }

  // panels for the six fixed tensors, reused across tabs
  function xPanel(o) { o = o || {}; return UI.matrixPanel({ title: o.title || 'x — input', shapeLabel: '1 × n_in=' + CFG.nIn, matrix: R2(Mo.x), rowLabels: EX_LBL, colLabels: IN_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning }); }
  function yPanel(o) { o = o || {}; return UI.matrixPanel({ title: o.title || 'y — target', shapeLabel: '1 × n_out=' + CFG.nOut, matrix: R2(Mo.y), rowLabels: EX_LBL, colLabels: OUT_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning }); }
  function W1Panel(o) { o = o || {}; return UI.matrixPanel({ title: o.title || 'W₁', shapeLabel: 'n_in=' + CFG.nIn + ' × n_hidden=' + CFG.nHid, matrix: R2(Mo.W1), rowLabels: IN_LBL, colLabels: HID_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning }); }
  function b1Panel(o) { o = o || {}; return UI.matrixPanel({ title: o.title || 'b₁', shapeLabel: '1 × n_hidden=' + CFG.nHid, matrix: R2(Mo.b1), rowLabels: ['bias'], colLabels: HID_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning }); }
  function W2Panel(o) { o = o || {}; return UI.matrixPanel({ title: o.title || 'W₂', shapeLabel: 'n_hidden=' + CFG.nHid + ' × n_out=' + CFG.nOut, matrix: R2(Mo.W2), rowLabels: HID_LBL, colLabels: OUT_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning }); }
  function b2Panel(o) { o = o || {}; return UI.matrixPanel({ title: o.title || 'b₂', shapeLabel: '1 × n_out=' + CFG.nOut, matrix: R2(Mo.b2), rowLabels: ['bias'], colLabels: OUT_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning }); }

  function hidPanel(title, mat, o) {
    o = o || {};
    return UI.matrixPanel({ title: title, shapeLabel: '1 × n_hidden=' + CFG.nHid, matrix: R2(mat),
      rowLabels: EX_LBL, colLabels: HID_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning,
      colorMode: o.colorMode, maxAbs: o.maxAbs });
  }
  function outPanel(title, mat, o) {
    o = o || {};
    return UI.matrixPanel({ title: title, shapeLabel: '1 × n_out=' + CFG.nOut, matrix: R2(mat),
      rowLabels: EX_LBL, colLabels: OUT_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning,
      colorMode: o.colorMode, maxAbs: o.maxAbs });
  }

  // ============================================================ FORWARD ============================================================
  function buildForward() {
    var steps = [];

    steps.push({
      title: 'The network we are going to differentiate',
      formula: null,
      note: '' + CFG.nIn + ' inputs, ' + CFG.nHid + ' hidden units with a <code>tanh</code> nonlinearity, ' + CFG.nOut + ' linear outputs. That is <strong>' + Mo.nParams + ' learnable numbers</strong> — small enough that this page can print every single partial derivative, twice, and compare them. Nothing about the chain rule changes at a billion parameters; only the size of the grids does.',
      render: function (stage) {
        stage.appendChild(unitsPanel({ title: 'input', labels: IN_LBL, shapeLabel: 'n_in = ' + CFG.nIn }));
        stage.appendChild(UI.arrow('→', 'W₁ (3×4), b₁'));
        stage.appendChild(unitsPanel({ title: 'hidden · tanh', labels: HID_LBL, shapeLabel: 'n_hidden = ' + CFG.nHid }));
        stage.appendChild(UI.arrow('→', 'W₂ (4×2), b₂'));
        stage.appendChild(unitsPanel({ title: 'output · linear', labels: OUT_LBL, shapeLabel: 'n_out = ' + CFG.nOut }));
        stage.appendChild(UI.arrow('→', 'loss'));
        stage.appendChild(UI.textCard('Parameter count: <code>W₁</code> ' + CFG.nIn + '×' + CFG.nHid + ' = ' + PARAM_COUNTS.W1 + ', <code>b₁</code> = ' + PARAM_COUNTS.b1 + ', <code>W₂</code> ' + CFG.nHid + '×' + CFG.nOut + ' = ' + PARAM_COUNTS.W2 + ', <code>b₂</code> = ' + PARAM_COUNTS.b2 + '. Total <strong>' + Mo.nParams + '</strong>. Backprop will produce all ' + Mo.nParams + ' partial derivatives from a single backward sweep, plus ' + CFG.nIn + ' more for the input itself.', 'note'));
        ledgerNote('network', CFG.nIn + '→' + CFG.nHid + '→' + CFG.nOut, Mo.nParams + ' learnable parameters.');
      }
    });

    steps.push({
      title: 'One training example: an input and a target',
      formula: 'x \\in \\mathbb{R}^{1\\times n_{in}}, \\qquad y \\in \\mathbb{R}^{1\\times n_{out}}',
      note: 'Every tensor on this page uses the <strong>row-vector convention</strong>: one example is one row, so a layer is <span>$z = aW + b$</span> and <span>$W$</span> has shape <span>$(\\text{fan in}, \\text{fan out})$</span>. Both of these numbers are fixed data — the gradient of the loss with respect to <code>y</code> is never needed, and <code>x</code>\'s gradient is only needed if there is an earlier layer to hand it to.',
      render: function (stage) {
        stage.appendChild(xPanel({ fresh: true, meaning: 'The ' + CFG.nIn + ' input features. Fixed: the optimiser never changes these.' }));
        stage.appendChild(yPanel({ fresh: true, meaning: 'What we want the ' + CFG.nOut + ' outputs to be. Also fixed — this is the supervision signal.' }));
      }
    });

    steps.push({
      title: 'Layer 1\'s parameters: W₁ and b₁',
      formula: 'W_1 \\in \\mathbb{R}^{n_{in}\\times n_{hidden}}, \\qquad b_1 \\in \\mathbb{R}^{1\\times n_{hidden}}',
      note: 'Column <span>$j$</span> of <code>W₁</code> holds the ' + CFG.nIn + ' weights feeding hidden unit <span>$j$</span>; <code>b₁[j]</code> is that unit\'s bias. These ' + LAYER1_PARAMS + ' numbers are the first ' + LAYER1_PARAMS + ' of the ' + Mo.nParams + ' gradients we are after.',
      render: function (stage) {
        stage.appendChild(W1Panel({ fresh: true, meaning: 'Row i, column j = the weight from input i to hidden unit j.' }));
        stage.appendChild(b1Panel({ fresh: true, meaning: 'One bias per hidden unit, added to every example identically.' }));
      }
    });

    steps.push({
      title: 'Step 1 of the forward pass: the matmul, x·W₁',
      formula: 'z_1^{\\text{raw}} = x W_1 \\in \\mathbb{R}^{1\\times n_{hidden}}',
      note: 'The bias is deliberately <em>not</em> added yet. Splitting the matmul from the bias add matters later: <code>W₁</code> and <code>b₁</code> get their gradients from different operations, and folding the two together is exactly where people lose track of which sum belongs to which.',
      render: function (stage) {
        stage.appendChild(xPanel({ dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W₁ (3×4)'));
        stage.appendChild(hidPanel('z₁ raw — before bias', F.z1raw, { fresh: true, meaning: 'Column j is the dot product of x with column j of W₁.' }));
        stage.appendChild(chainRows([[
          'z₁raw[' + HID_LBL[0] + ']',
          '=',
          IN_LBL.map(function (l, k) { return sgn(Mo.x[0][k]) + '×' + sgn(Mo.W1[k][0]); }).join(' + ') +
          ' = ' + sgn(F.z1raw[0][0], 3)
        ]]));
      }
    });

    steps.push({
      title: 'Step 2: add the bias, z₁ = z₁ʳᵃʷ + b₁',
      formula: 'z_1 = z_1^{\\text{raw}} + b_1',
      note: 'One addition per hidden unit. This is the operation whose local derivative is exactly <span>$1$</span> — which is why <span>$\\partial L/\\partial b_1$</span> will turn out to be the incoming gradient, unchanged, with nothing multiplied into it.',
      render: function (stage) {
        stage.appendChild(hidPanel('z₁ raw', F.z1raw, { dim: true }));
        stage.appendChild(UI.arrow('+', 'b₁ (1×4)'));
        stage.appendChild(b1Panel({ dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(hidPanel('z₁ — pre-activation', F.z1, { fresh: true, meaning: 'The ' + CFG.nHid + ' hidden pre-activations. Backprop will need these again, via a₁.' }));
      }
    });

    steps.push({
      title: 'Step 3: the nonlinearity, a₁ = tanh(z₁)',
      formula: 'a_1 = \\tanh(z_1) \\qquad \\text{elementwise}',
      note: 'Elementwise, so unit <span>$j$</span>\'s activation depends on unit <span>$j$</span>\'s pre-activation and nothing else. That independence is what makes the backward step through <code>tanh</code> a multiplication rather than a matrix product. Note <span>$\\tanh$</span> squashes into <span>$(-1, 1)$</span> — every value below is inside that range, and none is close enough to <span>$\\pm 1$</span> for the gradient to have died.',
      render: function (stage) {
        stage.appendChild(hidPanel('z₁', F.z1, { dim: true }));
        stage.appendChild(UI.arrow('⌇', 'tanh, elementwise'));
        stage.appendChild(hidPanel('a₁ — hidden activations', F.a1, { fresh: true, meaning: 'The hidden layer\'s output. This is the tensor the backward pass needs cached — both for W₂\'s gradient and for tanh\'s own derivative.' }));
        stage.appendChild(chainRows(HID_LBL.map(function (l, j) {
          return ['a₁[' + l + ']', '=', 'tanh(' + sgn(F.z1[0][j]) + ') = ' + sgn(F.a1[0][j], 3)];
        })));
      }
    });

    steps.push({
      title: 'Layer 2\'s parameters: W₂ and b₂',
      formula: 'W_2 \\in \\mathbb{R}^{n_{hidden}\\times n_{out}}, \\qquad b_2 \\in \\mathbb{R}^{1\\times n_{out}}',
      note: 'Same structure one level up: row <span>$j$</span> of <code>W₂</code> is how much hidden unit <span>$j$</span> contributes to each of the ' + CFG.nOut + ' outputs. ' + LAYER2_PARAMS + ' more parameters, taking the total to ' + Mo.nParams + '.',
      render: function (stage) {
        stage.appendChild(W2Panel({ fresh: true, meaning: 'Row j, column k = the weight from hidden unit j to output k.' }));
        stage.appendChild(b2Panel({ fresh: true }));
      }
    });

    steps.push({
      title: 'Step 4: the second matmul, a₁·W₂',
      formula: 'z_2^{\\text{raw}} = a_1 W_2 \\in \\mathbb{R}^{1\\times n_{out}}',
      note: 'Identical operation to step 1, one layer up — which is the entire point of a deep network: the same primitive, stacked. ' + CFG.nHid + ' terms per output this time, one per hidden unit.',
      render: function (stage) {
        stage.appendChild(hidPanel('a₁', F.a1, { dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W₂ (4×2)'));
        stage.appendChild(outPanel('z₂ raw — before bias', F.z2raw, { fresh: true }));
        stage.appendChild(chainRows([[
          'z₂raw[' + OUT_LBL[0] + ']',
          '=',
          HID_LBL.map(function (l, j) { return sgn(F.a1[0][j]) + '×' + sgn(Mo.W2[j][0]); }).join(' + ') +
          ' = ' + sgn(F.z2raw[0][0], 3)
        ]]));
      }
    });

    steps.push({
      title: 'Step 5: add b₂ — and that is the prediction',
      formula: 'z_2 = z_2^{\\text{raw}} + b_2, \\qquad \\hat{y} = z_2',
      note: 'The output layer is <strong>linear</strong>: no activation function on top. So the prediction is the pre-activation itself, <span>$\\hat{y} = z_2$</span>, and the local derivative <span>$\\partial \\hat{y}/\\partial z_2$</span> is <span>$1$</span>. That is one less thing to chain through, which keeps the backward pass on the next tab focused on the parts that actually do something.',
      render: function (stage) {
        stage.appendChild(outPanel('z₂ raw', F.z2raw, { dim: true }));
        stage.appendChild(UI.arrow('+', 'b₂ (1×2)'));
        stage.appendChild(b2Panel({ dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(outPanel('ŷ = z₂ — prediction', F.z2, { fresh: true, meaning: 'What the network currently says. Compare with the target y on the next step.' }));
      }
    });

    steps.push({
      title: 'Step 6: the residual, r = ŷ − y',
      formula: 'r = \\hat{y} - y \\in \\mathbb{R}^{1\\times n_{out}}',
      note: 'How wrong each output is, signed. Hold on to this tensor: it is about to reappear on the backward tab as <span>$\\partial L/\\partial \\hat{y}$</span> — not something resembling it, literally the same numbers.',
      render: function (stage) {
        stage.appendChild(outPanel('ŷ', F.z2, { dim: true }));
        stage.appendChild(UI.arrow('−', 'y'));
        stage.appendChild(yPanel({ dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(outPanel('r — residual', F.resid, { fresh: true, meaning: 'Positive means the network predicted too high for that output.' }));
      }
    });

    steps.push({
      title: 'Step 7: the loss, L = ½·Σ r²',
      formula: 'L = \\tfrac{1}{2}\\sum_{k} (\\hat{y}_k - y_k)^2',
      note: 'Squared error, halved. The <span>$\\tfrac{1}{2}$</span> is not a fudge factor for aesthetics — differentiating <span>$\\tfrac{1}{2}r^2$</span> gives exactly <span>$r$</span>, so the very first gradient of the backward pass comes out as the residual with no stray factor of 2 to keep track of. <strong>This single number is the only thing the whole backward pass differentiates.</strong>',
      render: function (stage) {
        stage.appendChild(outPanel('r', F.resid, { dim: true }));
        stage.appendChild(UI.arrow('²', 'square each'));
        stage.appendChild(outPanel('r²', F.sq, { fresh: true, colorMode: 'prob', maxAbs: 2 }));
        stage.appendChild(UI.arrow('Σ/2', 'sum, halve'));
        stage.appendChild(scalarPanel({ title: 'L — loss', value: F.loss, fresh: true, maxAbs: 2,
          meaning: 'L = ½(' + sgn(F.resid[0][0], 3) + ')² + ½(' + sgn(F.resid[0][1], 3) + ')² = ' + F.loss.toFixed(4) + '.' }));
        stage.appendChild(chainRows([['L', '=', '½ × (' + F.sq[0].map(function (v) { return v.toFixed(4); }).join(' + ') + ') = ' + F.loss.toFixed(6)]]));
      }
    });

    steps.push({
      title: 'What the forward pass left behind for backprop',
      formula: 'x \\;\\rightarrow\\; z_1 \\;\\rightarrow\\; a_1 \\;\\rightarrow\\; z_2 \\;\\rightarrow\\; \\hat{y} \\;\\rightarrow\\; L',
      note: 'Backprop is not a second, separate algorithm — it is a walk back along exactly this chain, and it needs the intermediate values the forward walk produced. This is the real reason training uses so much more memory than inference: <strong>inference can throw each activation away as soon as the next layer has consumed it; training cannot.</strong>',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'Saved activations (the "tape")', shapeLabel: 'needed by the backward pass',
          headers: ['value', 'shape', 'which backward step needs it'],
          rows: [
            ['x', '1×' + CFG.nIn, '∂L/∂W₁ = xᵀ δ₁'],
            ['a₁', '1×' + CFG.nHid, '∂L/∂W₂ = a₁ᵀ δ₂, and tanh′ = 1 − a₁²'],
            ['r = ŷ − y', '1×' + CFG.nOut, '∂L/∂ŷ, the very first gradient'],
            ['W₂', CFG.nHid + '×' + CFG.nOut, '∂L/∂a₁ = δ₂ W₂ᵀ'],
            ['W₁', CFG.nIn + '×' + CFG.nHid, '∂L/∂x = δ₁ W₁ᵀ']
          ],
          meaning: 'z₁ itself is not on the list: tanh′ can be written as 1 − a₁², so the activation is enough and the pre-activation can be discarded.'
        }));
        stage.appendChild(UI.textCard('Notice what is <em>not</em> saved: the loss value itself plays no part in the backward pass. Gradients depend on the residual, not on how big <code>L</code> came out.', 'note'));
      }
    });

    return steps;
  }

  // ============================================================ BACKWARD ============================================================
  function buildBackward() {
    var steps = [];

    steps.push({
      title: 'What we want, and the one rule that gets it',
      formula: '\\frac{\\partial L}{\\partial \\theta} = \\frac{\\partial L}{\\partial u}\\cdot\\frac{\\partial u}{\\partial \\theta} \\qquad \\text{(local derivative × incoming gradient)}',
      note: 'We want ' + Mo.nParams + ' numbers: how much <span>$L = ' + F.loss.toFixed(4) + '$</span> would change per unit change in each parameter. Every step below has the same shape — take the gradient that arrived from above, multiply by the <em>local</em> derivative of this one operation, pass the result down. Nothing else happens. Two names, used throughout: <span>$\\delta_2 = \\partial L/\\partial z_2$</span> and <span>$\\delta_1 = \\partial L/\\partial z_1$</span>.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'The backward itinerary', shapeLabel: Mo.nParams + ' parameter gradients + ' + CFG.nIn + ' for x',
          headers: ['#', 'gradient', 'local derivative used', 'shape'],
          rows: [
            ['1', '∂L/∂ŷ', 'd(½r²)/dr = r', '1×' + CFG.nOut],
            ['2', '∂L/∂z₂ = δ₂', '∂ŷ/∂z₂ = 1 (linear output)', '1×' + CFG.nOut],
            ['3', '∂L/∂b₂', '∂z₂/∂b₂ = 1', '1×' + CFG.nOut],
            ['4', '∂L/∂W₂', '∂z₂/∂W₂ = a₁', CFG.nHid + '×' + CFG.nOut],
            ['5', '∂L/∂a₁', '∂z₂/∂a₁ = W₂', '1×' + CFG.nHid],
            ['6', '∂L/∂z₁ = δ₁', 'tanh′ = 1 − a₁²', '1×' + CFG.nHid],
            ['7', '∂L/∂b₁', '∂z₁/∂b₁ = 1', '1×' + CFG.nHid],
            ['8', '∂L/∂W₁', '∂z₁/∂W₁ = x', CFG.nIn + '×' + CFG.nHid],
            ['9', '∂L/∂x', '∂z₁/∂x = W₁', '1×' + CFG.nIn]
          ],
          meaning: 'Nine steps, in reverse order of the forward pass. Each reuses the one before it — that reuse is the whole efficiency argument.'
        }));
      }
    });

    steps.push({
      title: '1 · ∂L/∂ŷ — differentiate the loss itself',
      formula: 'L = \\tfrac{1}{2}\\sum_k r_k^2 \\;\\Rightarrow\\; \\frac{\\partial L}{\\partial \\hat{y}_k} = r_k = \\hat{y}_k - y_k',
      note: 'The chain starts here, and it starts easy. <span>$L$</span> is a sum of independent terms, one per output, so <span>$\\partial L/\\partial \\hat{y}_k$</span> only involves output <span>$k$</span>\'s own term: <span>$\\tfrac{d}{dr}\\tfrac{1}{2}r^2 = r$</span>. The gradient of the loss with respect to the prediction is <strong>the residual, unchanged</strong> — the same two numbers the forward tab produced.',
      render: function (stage) {
        stage.appendChild(outPanel('r (from the forward pass)', F.resid, { dim: true }));
        stage.appendChild(UI.arrow('↓', 'd(½r²)/dr = r'));
        stage.appendChild(outPanel('∂L/∂ŷ', G.dyhat, { fresh: true, meaning: 'Identical to r. Positive means: this output is too high, nudging it down would reduce L.' }));
        stage.appendChild(UI.checkBadge(M.maxAbsDiff(G.dyhat, F.resid) === 0, 'same numbers as the residual (max |Δ| = ' + exp(M.maxAbsDiff(G.dyhat, F.resid), 1) + ')'));
      }
    });

    steps.push({
      title: '2 · ∂L/∂z₂ — through the (linear) output',
      formula: '\\delta_2 = \\frac{\\partial L}{\\partial z_2} = \\frac{\\partial L}{\\partial \\hat{y}} \\odot \\frac{\\partial \\hat{y}}{\\partial z_2} = \\frac{\\partial L}{\\partial \\hat{y}} \\odot 1',
      note: 'Because the output layer has no activation function, <span>$\\hat{y} = z_2$</span> and the local derivative is <span>$1$</span>. The gradient passes through untouched. Worth seeing once in this trivial form, because the next two steps do the same thing with local derivatives that are not 1 — and if the shape of the operation is not clear here, it will not be clear there.',
      render: function (stage) {
        stage.appendChild(outPanel('incoming: ∂L/∂ŷ', G.dyhat, { dim: true }));
        stage.appendChild(UI.arrow('⊙', 'local ∂ŷ/∂z₂ = 1'));
        stage.appendChild(outPanel('local derivative', [[1, 1]], { dim: true, colorMode: 'prob' }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(outPanel('δ₂ = ∂L/∂z₂', G.dz2, { fresh: true, meaning: 'The single most reused tensor in the backward pass — steps 3, 4 and 5 all start from it.' }));
        stage.appendChild(UI.textCard('If the output had a sigmoid or a softmax on it, this is the step that would stop being free. With softmax + cross-entropy it collapses to <span>$\\hat{p} - y$</span>, which is why that pairing is so popular — the same "gradient equals residual" shortcut, one layer later.', 'note'));
      }
    });

    steps.push({
      title: '3 · ∂L/∂b₂ — the easiest gradient in the network',
      formula: '\\frac{\\partial z_2}{\\partial b_2} = 1 \\;\\Rightarrow\\; \\frac{\\partial L}{\\partial b_2} = \\delta_2',
      note: 'The bias enters through a plain addition, <span>$z_2 = z_2^{\\text{raw}} + b_2$</span>. Move <code>b₂[k]</code> by <span>$\\epsilon$</span> and <code>z₂[k]</code> moves by exactly <span>$\\epsilon$</span> — local derivative 1. So the bias gradient <em>is</em> <span>$\\delta_2$</span>. This is why splitting the matmul and the bias add into separate forward steps paid off.',
      render: function (stage) {
        stage.appendChild(outPanel('incoming: δ₂', G.dz2, { dim: true }));
        stage.appendChild(UI.arrow('×', 'local = 1'));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₂', shapeLabel: '1 × n_out=' + CFG.nOut, matrix: R2(G.gb2),
          rowLabels: ['grad'], colLabels: OUT_LBL, fresh: true, meaning: 'Same shape as b₂ (1×' + CFG.nOut + '), as every gradient must be.' }));
        stage.appendChild(b2Panel({ title: 'b₂ (for shape comparison)', dim: true }));
      }
    });

    steps.push({
      title: '4 · ∂L/∂W₂ — local derivative is a₁',
      formula: '\\frac{\\partial z_{2,k}}{\\partial W_{2}[j,k]} = a_{1,j} \\;\\Rightarrow\\; \\frac{\\partial L}{\\partial W_2} = a_1^{\\top}\\delta_2',
      note: '<code>W₂[j,k]</code> touches the network in exactly one place: it multiplies <code>a₁[j]</code> on its way into output <span>$k$</span>. So the local derivative is <code>a₁[j]</code>, and the gradient is that local factor times the incoming <code>δ₂[k]</code>. Doing that for all <span>$j,k$</span> at once is an outer product — written as a matmul of a column by a row.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'a₁ᵀ (local derivative)', shapeLabel: CFG.nHid + ' × 1',
          matrix: R2(M.transpose(F.a1)), rowLabels: HID_LBL, colLabels: ['ex 0'], dim: true }));
        stage.appendChild(UI.arrow('⊗', 'outer product'));
        stage.appendChild(outPanel('δ₂ (incoming)', G.dz2, { dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₂', shapeLabel: CFG.nHid + ' × ' + CFG.nOut, matrix: R2(G.gW2),
          rowLabels: HID_LBL, colLabels: OUT_LBL, fresh: true, meaning: 'Same shape as W₂. Row j is scaled by how active hidden unit j was; column k by how wrong output k was.' }));
        stage.appendChild(chainRows([
          ['∂L/∂W₂[h₀, o₀]', '=', 'a₁[h₀] × δ₂[o₀] = ' + sgn(F.a1[0][0], 3) + ' × ' + sgn(G.dz2[0][0], 3) + ' = ' + sgn(G.gW2[0][0], 3)],
          ['∂L/∂W₂[h₁, o₁]', '=', 'a₁[h₁] × δ₂[o₁] = ' + sgn(F.a1[0][1], 3) + ' × ' + sgn(G.dz2[0][1], 3) + ' = ' + sgn(G.gW2[1][1], 3)],
          ['∂L/∂W₂[h₂, o₀]', '=', 'a₁[h₂] × δ₂[o₀] = ' + sgn(F.a1[0][2], 3) + ' × ' + sgn(G.dz2[0][0], 3) + ' = ' + sgn(G.gW2[2][0], 3)]
        ]));
        stage.appendChild(UI.textCard('Read the rule off those three lines: <strong>a weight\'s gradient is the activation feeding it, times the error signal leaving it.</strong> A weight from a dead unit (<span>$a_1 \\approx 0$</span>) gets no gradient no matter how wrong the output was — and a weight into a correct output gets none no matter how active the unit was.', 'note'));
      }
    });

    steps.push({
      title: '5 · ∂L/∂a₁ — the first genuinely backward move',
      formula: '\\frac{\\partial L}{\\partial a_{1,j}} = \\sum_k W_2[j,k]\\,\\delta_{2,k} \\;\\Rightarrow\\; \\frac{\\partial L}{\\partial a_1} = \\delta_2 W_2^{\\top}',
      note: 'Hidden unit <span>$j$</span> feeds <em>both</em> outputs, so its gradient is a <strong>sum over every path it influences</strong> — that summation is the multivariable chain rule, and it is the only part of backprop that is not a single product. As a matrix operation it is a matmul with <span>$W_2$</span> transposed: the same weights as the forward pass, used in the opposite direction.',
      render: function (stage) {
        stage.appendChild(outPanel('δ₂ (incoming)', G.dz2, { dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W₂ᵀ (2×4)'));
        stage.appendChild(UI.matrixPanel({ title: 'W₂ᵀ (local derivative)', shapeLabel: CFG.nOut + ' × ' + CFG.nHid,
          matrix: R2(M.transpose(Mo.W2)), rowLabels: OUT_LBL, colLabels: HID_LBL, dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(hidPanel('∂L/∂a₁', G.da1, { fresh: true, meaning: 'How much the loss would change per unit change in each hidden activation.' }));
        stage.appendChild(chainRows(HID_LBL.map(function (l, j) {
          return ['∂L/∂a₁[' + l + ']', '=',
            OUT_LBL.map(function (o, k) { return sgn(Mo.W2[j][k]) + '×' + sgn(G.dz2[0][k], 3); }).join(' + ') +
            ' = ' + sgn(G.da1[0][j], 3)];
        })));
      }
    });

    steps.push({
      title: '6a · the local derivative of tanh, on its own',
      formula: '\\frac{d}{dz}\\tanh(z) = 1 - \\tanh^2(z) = 1 - a_1^2',
      note: 'Shown by itself because it is the factor people most often get wrong, and because it is where vanishing gradients come from. It is computed from <code>a₁</code>, not from <code>z₁</code> — the activation already contains everything needed, which is why the forward tape does not have to keep the pre-activation. Its value is at most <span>$1$</span> (at <span>$z=0$</span>) and heads to <span>$0$</span> as <span>$|z|$</span> grows.',
      render: function (stage) {
        stage.appendChild(hidPanel('a₁', F.a1, { dim: true }));
        stage.appendChild(UI.arrow('↓', '1 − a₁²'));
        stage.appendChild(hidPanel('tanh′(z₁) = 1 − a₁²', G.tanhPrime, { fresh: true, colorMode: 'prob',
          meaning: 'Always in (0, 1]. Every layer a gradient passes through multiplies it by one of these — stack enough and the product underflows. That is the vanishing-gradient problem, in one tensor.' }));
        stage.appendChild(chainRows(HID_LBL.map(function (l, j) {
          return ['tanh′ at ' + l, '=', '1 − (' + sgn(F.a1[0][j], 3) + ')² = ' + G.tanhPrime[0][j].toFixed(3)];
        })));
      }
    });

    steps.push({
      title: '6b · ∂L/∂z₁ = ∂L/∂a₁ ⊙ tanh′(z₁)',
      formula: '\\delta_1 = \\frac{\\partial L}{\\partial z_1} = \\frac{\\partial L}{\\partial a_1} \\odot \\left(1 - a_1^2\\right)',
      note: 'Elementwise multiply, not a matmul — because <code>tanh</code> is elementwise, unit <span>$j$</span>\'s pre-activation only affects unit <span>$j$</span>\'s activation. Compare the two grids cell by cell: wherever <code>tanh′</code> is small, the gradient arriving from above has been shrunk before it continues backward.',
      render: function (stage) {
        stage.appendChild(hidPanel('∂L/∂a₁ (incoming)', G.da1, { dim: true }));
        stage.appendChild(UI.arrow('⊙', 'elementwise'));
        stage.appendChild(hidPanel('tanh′ (local)', G.tanhPrime, { dim: true, colorMode: 'prob' }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(hidPanel('δ₁ = ∂L/∂z₁', G.dz1, { fresh: true, meaning: 'The error signal at the hidden layer. Everything left in this tab is built from it.' }));
        stage.appendChild(chainRows(HID_LBL.map(function (l, j) {
          return ['δ₁[' + l + ']', '=', sgn(G.da1[0][j], 3) + ' × ' + G.tanhPrime[0][j].toFixed(3) + ' = ' + sgn(G.dz1[0][j], 3)];
        })));
      }
    });

    steps.push({
      title: '7 · ∂L/∂b₁ = δ₁',
      formula: '\\frac{\\partial z_1}{\\partial b_1} = 1 \\;\\Rightarrow\\; \\frac{\\partial L}{\\partial b_1} = \\delta_1',
      note: 'Exactly the same argument as <code>b₂</code>, one layer down: an addition has local derivative 1, so the incoming gradient is the answer. ' + CFG.nHid + ' more of the ' + Mo.nParams + ' done.',
      render: function (stage) {
        stage.appendChild(hidPanel('incoming: δ₁', G.dz1, { dim: true }));
        stage.appendChild(UI.arrow('×', 'local = 1'));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₁', shapeLabel: '1 × n_hidden=' + CFG.nHid, matrix: R2(G.gb1),
          rowLabels: ['grad'], colLabels: HID_LBL, fresh: true, meaning: 'Same shape as b₁.' }));
      }
    });

    steps.push({
      title: '8 · ∂L/∂W₁ = xᵀ δ₁',
      formula: '\\frac{\\partial z_{1,j}}{\\partial W_1[i,j]} = x_i \\;\\Rightarrow\\; \\frac{\\partial L}{\\partial W_1} = x^{\\top}\\delta_1',
      note: 'Structurally identical to step 4 — the local derivative of a weight is whatever activation it multiplies, which down here is the raw input <code>x</code>. Notice the pattern that has now repeated twice: <strong>gradient of a weight matrix = (input to that layer)ᵀ × (error signal out of that layer)</strong>. That one line is all of backprop for dense layers.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'xᵀ (local derivative)', shapeLabel: CFG.nIn + ' × 1',
          matrix: R2(M.transpose(Mo.x)), rowLabels: IN_LBL, colLabels: ['ex 0'], dim: true }));
        stage.appendChild(UI.arrow('⊗', 'outer product'));
        stage.appendChild(hidPanel('δ₁ (incoming)', G.dz1, { dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₁', shapeLabel: CFG.nIn + ' × ' + CFG.nHid, matrix: R2(G.gW1),
          rowLabels: IN_LBL, colLabels: HID_LBL, fresh: true, meaning: 'Same shape as W₁. Row i is x[i] times the whole δ₁ row.' }));
        stage.appendChild(chainRows([
          ['∂L/∂W₁[x₀, h₀]', '=', 'x[0] × δ₁[h₀] = ' + sgn(Mo.x[0][0]) + ' × ' + sgn(G.dz1[0][0], 3) + ' = ' + sgn(G.gW1[0][0], 3)],
          ['∂L/∂W₁[x₂, h₂]', '=', 'x[2] × δ₁[h₂] = ' + sgn(Mo.x[0][2]) + ' × ' + sgn(G.dz1[0][2], 3) + ' = ' + sgn(G.gW1[2][2], 3)]
        ]));
      }
    });

    steps.push({
      title: '9 · ∂L/∂x — what gets handed to the previous layer',
      formula: '\\frac{\\partial L}{\\partial x} = \\delta_1 W_1^{\\top} \\in \\mathbb{R}^{1\\times n_{in}}',
      note: 'Same operation as step 5, one layer down. In this network <code>x</code> is the data, so this gradient has nowhere to go — but in a deeper network <code>x</code> is the previous layer\'s activation, and <strong>this tensor is the incoming gradient for that layer\'s step 5</strong>. That is the recursion: each layer needs only the gradient of its own output, and it produces the gradient of its own input for whoever is behind it. Nothing anywhere needs a global view.',
      render: function (stage) {
        stage.appendChild(hidPanel('δ₁ (incoming)', G.dz1, { dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W₁ᵀ (4×3)'));
        stage.appendChild(UI.matrixPanel({ title: 'W₁ᵀ (local derivative)', shapeLabel: CFG.nHid + ' × ' + CFG.nIn,
          matrix: R2(M.transpose(Mo.W1)), rowLabels: HID_LBL, colLabels: IN_LBL, dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂x', shapeLabel: '1 × ' + CFG.nIn, matrix: R2(G.gx),
          rowLabels: EX_LBL, colLabels: IN_LBL, fresh: true, meaning: 'Not used for a weight update here — this is the hand-off tensor a deeper network would pass down.' }));
      }
    });

    steps.push({
      title: 'All ' + (Mo.nParams + CFG.nIn) + ' gradients, and the shape rule',
      formula: '\\text{shape}\\left(\\frac{\\partial L}{\\partial \\theta}\\right) = \\text{shape}(\\theta) \\quad \\text{always}',
      note: 'One backward sweep produced every one of them. The shape rule below is the cheapest bug-catcher in deep learning: <span>$L$</span> is a scalar, so its gradient with respect to any tensor has that tensor\'s exact shape. If a transpose is missing or a sum went along the wrong axis, the shapes stop matching before the numbers get a chance to be silently wrong.',
      render: function (stage) {
        var pairs = [
          { g: G.gW1, p: Mo.W1, n: 'W₁' }, { g: G.gb1, p: Mo.b1, n: 'b₁' },
          { g: G.gW2, p: Mo.W2, n: 'W₂' }, { g: G.gb2, p: Mo.b2, n: 'b₂' },
          { g: G.gx, p: Mo.x, n: 'x' }
        ];
        var allMatch = pairs.every(function (o) {
          var a = M.shape(o.g), b = M.shape(o.p);
          return a[0] === b[0] && a[1] === b[1];
        });
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₁', shapeLabel: CFG.nIn + ' × ' + CFG.nHid, matrix: R2(G.gW1), rowLabels: IN_LBL, colLabels: HID_LBL }));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₁', shapeLabel: '1 × ' + CFG.nHid, matrix: R2(G.gb1), rowLabels: ['grad'], colLabels: HID_LBL }));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₂', shapeLabel: CFG.nHid + ' × ' + CFG.nOut, matrix: R2(G.gW2), rowLabels: HID_LBL, colLabels: OUT_LBL }));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₂', shapeLabel: '1 × ' + CFG.nOut, matrix: R2(G.gb2), rowLabels: ['grad'], colLabels: OUT_LBL }));
        stage.appendChild(tablePanel({
          title: 'Shape audit', shapeLabel: pairs.length + ' tensors',
          headers: ['tensor', 'parameter shape', 'gradient shape', 'match'],
          rows: pairs.map(function (o) {
            var a = M.shape(o.g), b = M.shape(o.p);
            return [o.n, b.join('×'), a.join('×'), (a[0] === b[0] && a[1] === b[1]) ? '✓' : '✕'];
          })
        }));
        stage.appendChild(UI.checkBadge(allMatch, 'every gradient matches its parameter\'s shape'));
        stage.appendChild(UI.textCard('The shapes are right. That is <em>not</em> the same as the numbers being right — a transposed multiply can be shape-correct and still wrong. The next tab settles the numbers, by computing all ' + (Mo.nParams + CFG.nIn) + ' of them a second, completely independent way.', 'note'));
      }
    });

    return steps;
  }

  // ============================================================ GRADIENT CHECK ============================================================
  function buildCheck() {
    var steps = [];

    steps.push({
      title: 'The derivation is an argument. This is a measurement.',
      formula: '\\frac{\\partial L}{\\partial w} \\;\\approx\\; \\frac{L(w + h) - L(w - h)}{2h}',
      note: 'A derivative is a limit of difference quotients, so a derivative can be <em>measured</em>: nudge one parameter by a tiny <span>$h$</span>, run the whole forward pass again, see how much <span>$L$</span> moved. That estimate knows nothing about the chain rule — it only calls the forward function. If it agrees with the analytic gradient to ten decimal places, the derivation on the previous tab is right, and no amount of "trust me" is required.',
      render: function (stage) {
        stage.appendChild(UI.textCard('The plan: do this for all <strong>' + C.total + '</strong> partial derivatives (' + Mo.nParams + ' parameters plus the ' + CFG.nIn + ' input gradients), with <span>$h = ' + exp(CFG.h, 0) + '$</span>, and report the largest disagreement anywhere. Every number on this tab is computed in your browser when the page loads — including the verdict.', 'note'));
        stage.appendChild(tablePanel({
          title: 'Two ways to get the same number', shapeLabel: 'per parameter',
          headers: ['', 'analytic (backprop)', 'numerical (central differences)'],
          rows: [
            ['what it uses', 'the chain rule, one backward sweep', 'the forward function only, as a black box'],
            ['cost for all ' + C.total, '1 forward + 1 backward', C.total + ' × 2 = ' + Mo.CHECK_PASSES + ' forward passes'],
            ['accuracy', 'exact (up to float rounding)', 'approximate, error ≈ O(h²)'],
            ['used in practice', 'always', 'only to test the first one']
          ]
        }));
      }
    });

    steps.push({
      title: 'One parameter, measured end to end',
      formula: '\\frac{\\partial L}{\\partial W_1[0,0]} \\;\\approx\\; \\frac{L(w{+}h) - L(w{-}h)}{2h}',
      note: 'Take a single weight, <code>' + ONE.label + ' = ' + sgn(ONE.w, 1) + '</code>. Add <span>$h$</span> to it, leave all ' + (Mo.nParams - 1) + ' others alone, and run the complete forward pass: matmul, bias, tanh, matmul, bias, residual, loss. Then subtract <span>$h$</span> instead and run it again. The two losses agree to ' + agreeingPlaces(ONE.lPlus - ONE.lMinus) + ' decimal places and part company in the ' + (agreeingPlaces(ONE.lPlus - ONE.lMinus) + 1) + 'th — and that tiny difference, divided by <span>$2h$</span>, is the slope.',
      render: function (stage) {
        stage.appendChild(chainRows([
          ['w = ' + ONE.label, '=', sgn(ONE.w, 1)],
          ['h', '=', exp(ONE.h, 0)],
          ['L(w + h)', '=', ONE.lPlus.toFixed(12)],
          ['L(w − h)', '=', ONE.lMinus.toFixed(12)],
          ['difference', '=', sci(ONE.lPlus - ONE.lMinus, 6)],
          ['÷ 2h', '=', ONE.central.toFixed(12)]
        ]));
        stage.appendChild(UI.arrow('vs', 'the analytic value'));
        stage.appendChild(chainRows([
          ['numerical', '=', ONE.central.toFixed(12)],
          ['analytic (xᵀδ₁)', '=', ONE.analytic.toFixed(12)],
          ['|difference|', '=', exp(ONE.errCentral, 3)]
        ]));
        stage.appendChild(UI.checkBadge(ONE.errCentral < 1e-9, 'agree to ' + (Math.floor(-Math.log10(ONE.errCentral))) + ' decimal places'));
        ledgerNote('L(w±h)', '2 scalars', 'Two complete forward passes, for one of ' + C.total + ' derivatives.');
      }
    });

    steps.push({
      title: 'Why central differences and not the obvious one',
      formula: '\\underbrace{\\frac{L(w{+}h)-L(w)}{h}}_{\\text{error } O(h)} \\qquad vs \\qquad \\underbrace{\\frac{L(w{+}h)-L(w{-}h)}{2h}}_{\\text{error } O(h^2)}',
      note: 'The textbook definition of a derivative uses <span>$L(w+h) - L(w)$</span>. Taylor-expanding shows its error is proportional to <span>$h$</span>, because the second-order term does not cancel. The symmetric version straddles the point, the second-order terms cancel between the two sides, and the error drops to <span>$O(h^2)$</span>. At <span>$h = ' + exp(CFG.h, 0) + '$</span> that is the difference between <strong>' + agreeingPlaces(ONE.errForward) + ' correct decimal places and ' + agreeingPlaces(ONE.errCentral) + '</strong> — measured below on the same weight, not asserted.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'Same weight, same h, two estimators', shapeLabel: ONE.label,
          headers: ['estimator', 'value', 'error vs analytic', 'correct places'],
          rows: [
            ['forward  (L(w+h) − L(w)) / h', ONE.forwardDiff.toFixed(10), exp(ONE.errForward, 2), String(agreeingPlaces(ONE.errForward))],
            ['central  (L(w+h) − L(w−h)) / 2h', ONE.central.toFixed(10), exp(ONE.errCentral, 2), String(agreeingPlaces(ONE.errCentral))],
            ['analytic (backprop)', ONE.analytic.toFixed(10), '—', '—']
          ],
          highlight: function (i) { return i === 1; },
          meaning: 'The symmetric estimator is ' + Math.round(ONE.errForward / ONE.errCentral).toLocaleString() + '× more accurate here, for exactly one extra forward pass.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Error, same h', unit: '',
          items: [
            { label: 'forward difference', value: Number(ONE.errForward.toPrecision(3)), colorVar: 'var(--know-cold)' },
            { label: 'central difference', value: Number(ONE.errCentral.toPrecision(3)), colorVar: 'var(--c-practice)' }
          ],
          meaning: 'The green bar has no visible length, which is the point: its error is ' + Math.round(ONE.errForward / ONE.errCentral).toLocaleString() + ' times smaller than the red one\'s, so at this scale it rounds to nothing.'
        }));
      }
    });

    steps.push({
      title: 'All ' + C.parts[0].count + ' entries of ∂L/∂W₁, both ways',
      formula: '\\max_{i,j}\\left|\\;\\frac{\\partial L}{\\partial W_1}\\Big|_{\\text{backprop}} - \\frac{\\partial L}{\\partial W_1}\\Big|_{\\text{numeric}}\\;\\right| = ' + exp(C.parts[0].maxAbs, 2).replace('−', '-'),
      note: 'Another ' + (2 * C.parts[0].count) + ' forward passes, two per weight. The two grids below were produced by completely different code paths — the left one from <span>$x^{\\top}\\delta_1$</span>, the right one by nudging weights and re-running the network — and they are identical to every digit shown.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₁ — analytic', shapeLabel: CFG.nIn + ' × ' + CFG.nHid,
          matrix: R2(G.gW1), rowLabels: IN_LBL, colLabels: HID_LBL }));
        stage.appendChild(UI.arrow('≟', 'cell by cell'));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₁ — numerical', shapeLabel: CFG.nIn + ' × ' + CFG.nHid,
          matrix: R2(C.parts[0].numeric), rowLabels: IN_LBL, colLabels: HID_LBL, fresh: true }));
        stage.appendChild(UI.checkBadge(C.parts[0].maxAbs < 1e-7, 'max |Δ| = ' + exp(C.parts[0].maxAbs, 2) + ' over ' + C.parts[0].count + ' weights'));
        stage.appendChild(UI.textCard('The grids round to two decimals for display, so "they look the same" is not the evidence — the badge is. It reports the largest absolute difference across all ' + C.parts[0].count + ' cells at full double precision.', 'note'));
      }
    });

    steps.push({
      title: '∂L/∂b₁, both ways',
      formula: '\\max_j\\left|\\Delta\\right| = ' + exp(C.parts[1].maxAbs, 2).replace('−', '-'),
      note: 'The bias gradients are the ones the derivation got for free — local derivative 1, so <span>$\\partial L/\\partial b_1 = \\delta_1$</span> with no multiplication at all. "For free" is exactly the kind of claim worth measuring, and it holds.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₁ — analytic', shapeLabel: '1 × ' + CFG.nHid,
          matrix: R2(G.gb1), rowLabels: ['grad'], colLabels: HID_LBL }));
        stage.appendChild(UI.arrow('≟', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₁ — numerical', shapeLabel: '1 × ' + CFG.nHid,
          matrix: R2(C.parts[1].numeric), rowLabels: ['grad'], colLabels: HID_LBL, fresh: true }));
        stage.appendChild(UI.checkBadge(C.parts[1].maxAbs < 1e-7, 'max |Δ| = ' + exp(C.parts[1].maxAbs, 2) + ' over ' + C.parts[1].count + ' biases'));
      }
    });

    steps.push({
      title: '∂L/∂W₂ and ∂L/∂b₂, both ways',
      formula: '\\max\\left|\\Delta\\right| = ' + exp(Math.max(C.parts[2].maxAbs, C.parts[3].maxAbs), 2).replace('−', '-'),
      note: 'The output layer\'s ten parameters. These are the ones nearest the loss, so their gradients pass through the fewest steps — if anything in the derivation were wrong, it would most likely <em>not</em> be here. The interesting failures live deeper, which is why the <code>W₁</code> check two steps back was the important one.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₂ — analytic', shapeLabel: CFG.nHid + ' × ' + CFG.nOut,
          matrix: R2(G.gW2), rowLabels: HID_LBL, colLabels: OUT_LBL }));
        stage.appendChild(UI.arrow('≟', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₂ — numerical', shapeLabel: CFG.nHid + ' × ' + CFG.nOut,
          matrix: R2(C.parts[2].numeric), rowLabels: HID_LBL, colLabels: OUT_LBL, fresh: true }));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₂ — analytic', shapeLabel: '1 × ' + CFG.nOut,
          matrix: R2(G.gb2), rowLabels: ['grad'], colLabels: OUT_LBL }));
        stage.appendChild(UI.arrow('≟', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₂ — numerical', shapeLabel: '1 × ' + CFG.nOut,
          matrix: R2(C.parts[3].numeric), rowLabels: ['grad'], colLabels: OUT_LBL, fresh: true }));
        stage.appendChild(UI.checkBadge(Math.max(C.parts[2].maxAbs, C.parts[3].maxAbs) < 1e-7,
          'max |Δ| = ' + exp(Math.max(C.parts[2].maxAbs, C.parts[3].maxAbs), 2) + ' over ' + (C.parts[2].count + C.parts[3].count) + ' parameters'));
      }
    });

    steps.push({
      title: '∂L/∂x — checking the hand-off tensor too',
      formula: '\\max_i\\left|\\Delta\\right| = ' + exp(C.parts[4].maxAbs, 2).replace('−', '-'),
      note: 'This is the gradient a deeper network would pass to the layer below, so an error here would corrupt every earlier layer while leaving <code>W₁</code> and <code>b₁</code> looking perfectly correct. It is checked the same way: nudge an input feature, re-run the forward pass, compare.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂x — analytic', shapeLabel: '1 × ' + CFG.nIn,
          matrix: R2(G.gx), rowLabels: EX_LBL, colLabels: IN_LBL }));
        stage.appendChild(UI.arrow('≟', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂x — numerical', shapeLabel: '1 × ' + CFG.nIn,
          matrix: R2(C.parts[4].numeric), rowLabels: EX_LBL, colLabels: IN_LBL, fresh: true }));
        stage.appendChild(UI.checkBadge(C.parts[4].maxAbs < 1e-7, 'max |Δ| = ' + exp(C.parts[4].maxAbs, 2) + ' over ' + C.parts[4].count + ' inputs'));
      }
    });

    steps.push({
      title: 'The verdict: all ' + C.total + ' derivatives at once',
      formula: '\\max_{\\text{all } ' + C.total + '}\\left|\\;\\nabla_{\\text{backprop}} - \\nabla_{\\text{numeric}}\\;\\right| = ' + exp(C.maxAbsDiff, 3).replace('−', '-'),
      note: 'Every partial derivative on the backward tab, recomputed from nothing but the forward function and ' + Mo.CHECK_PASSES + ' extra forward passes. The worst disagreement anywhere is <strong>' + exp(C.maxAbsDiff, 3) + '</strong>, on gradients whose magnitudes run up to ' + GRAD_MAX.toFixed(2) + ' — about ' + exp(C.maxAbsDiff / GRAD_MAX, 0) + ' of the signal. That is floating-point noise, not a discrepancy. <strong>The derivation is correct, and you watched it be checked rather than being asked to believe it.</strong>',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'Gradient check, every tensor', shapeLabel: C.total + ' partial derivatives',
          headers: ['gradient', 'count', 'max |analytic − numeric|', 'max relative error'],
          rows: C.parts.map(function (p) {
            return [p.name, String(p.count), exp(p.maxAbs, 2), exp(p.maxRel, 2)];
          }).concat([['<strong>all</strong>', '<strong>' + C.total + '</strong>',
            '<strong>' + exp(C.maxAbsDiff, 2) + '</strong>', '<strong>' + exp(C.maxRelErr, 2) + '</strong>']]),
          meaning: 'Relative error is |a−n| / (|a|+|n|). The usual rule of thumb: below 1e-7 the gradients are right, above 1e-4 something is wrong.'
        }));
        stage.appendChild(UI.checkBadge(C.ok, 'gradient check passed — max |Δ| = ' + exp(C.maxAbsDiff, 3) + ' across ' + C.total + ' derivatives'));
      }
    });

    steps.push({
      title: 'Choosing h: smaller is not better',
      formula: '\\text{total error} \\;\\approx\\; \\underbrace{c_1 h^2}_{\\text{truncation}} \\;+\\; \\underbrace{c_2 \\varepsilon / h}_{\\text{round-off}}',
      note: 'Two errors fight each other. Truncation error — the Taylor terms the quotient throws away — shrinks as <span>$h^2$</span>. Round-off error grows as <span>$1/h$</span>, because subtracting two nearly-equal doubles destroys significant digits. The sum has a minimum, and the table below finds it by re-running the entire ' + C.total + '-derivative check at ' + Mo.H_SWEEP.length + ' different values of <span>$h$</span>.',
      render: function (stage) {
        var best = Mo.H_BEST;
        stage.appendChild(tablePanel({
          title: 'The whole check, re-run at each h', shapeLabel: Mo.H_SWEEP.length + ' values of h',
          headers: ['step size h', 'max |Δ| over all ' + C.total, 'dominated by'],
          rows: Mo.H_SWEEP.map(function (s) {
            return [exp(s.h, 0), exp(s.maxAbsDiff, 2),
              s.h > best.h ? 'truncation (falls as h²)' : s.h === best.h ? '— the sweet spot —' : 'round-off (grows as 1/h)'];
          }),
          highlight: function (i) { return Mo.H_SWEEP[i].h === best.h; },
          meaning: 'Going from h=' + exp(SW_FIRST.h, 0) + ' to h=' + exp(best.h, 0) + ' buys ' + SW_ORDERS + ' orders of magnitude. Going further gives them back: at h=' + exp(SW_LAST.h, 0) + ' the estimate is worse than at h=' + exp(SW_COARSEST_BEATING.h, 0) + ', a step ' + Math.round(Math.log10(SW_COARSEST_BEATING.h / SW_LAST.h)) + ' orders of magnitude coarser.'
        }));
        stage.appendChild(UI.checkBadge(true, 'best h here = ' + exp(best.h, 0) + ', giving ' + exp(best.maxAbsDiff, 2)));
        stage.appendChild(UI.textCard('This is why gradient checks are run in <code>float64</code> and never in <code>float32</code>: with <span>$\\varepsilon \\approx 10^{-7}$</span> instead of <span>$10^{-16}$</span>, the round-off wall arrives long before the truncation error has fallen far enough, and there is no <span>$h$</span> that gives a clean answer.', 'note'));
      }
    });

    steps.push({
      title: 'Why this is a test and not the algorithm',
      formula: '\\text{cost}_{\\text{numeric}} = 2P \\times \\text{forward} \\qquad \\text{cost}_{\\text{backprop}} \\approx 2 \\times \\text{forward}',
      note: 'Numerical differentiation needs two forward passes <em>per parameter</em>; backprop needs one backward sweep for <strong>all</strong> of them, costing roughly what one more forward pass costs. On this ' + Mo.nParams + '-parameter network that is ' + Mo.CHECK_PASSES + ' passes against about 2. The ratio is <span>$P$</span> — so at a billion parameters, the numerical route is a billion times more expensive, which is the entire reason backprop had to be invented and the reason the check on this tab is something you run once on a small example and then never again.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Forward passes needed for all ' + C.total + ' derivatives', unit: ' passes',
          items: [
            { label: 'central differences (2 per parameter)', value: Mo.CHECK_PASSES, colorVar: 'var(--know-cold)' },
            { label: 'backprop (1 forward + 1 backward)', value: 2, colorVar: 'var(--c-practice)' }
          ],
          meaning: 'Same ' + C.total + ' numbers out. The right-hand method is ' + (Mo.CHECK_PASSES / 2) + '× cheaper here and P/2× cheaper in general.'
        }));
        stage.appendChild(UI.textCard('Backprop gets this for one structural reason: <strong>it reuses shared subexpressions.</strong> <span>$\\delta_2$</span> is computed once and used by three later steps; <span>$\\delta_1$</span> once and used by three more. Finite differences recompute the entire network from scratch for every single weight, sharing nothing.', 'note'));
      }
    });

    return steps;
  }

  // ============================================================ ONE STEP OF DESCENT ============================================================
  function buildDescent() {
    var steps = [];
    var eta = S.eta;

    steps.push({
      title: 'The gradients are correct. Now use them.',
      formula: '\\theta \\leftarrow \\theta - \\eta\\,\\frac{\\partial L}{\\partial \\theta}',
      note: 'The gradient points in the direction of steepest <em>increase</em>, so subtracting it decreases the loss. One number controls how far to go: the learning rate <span>$\\eta = ' + eta + '$</span>. Every parameter moves at once, each by its own gradient — which is what "one training step" means, minus the momentum and adaptive scaling that a real optimiser layers on top.',
      render: function (stage) {
        stage.appendChild(scalarPanel({ title: 'L before', value: S.lossBefore, maxAbs: 2,
          meaning: 'The loss the forward tab computed.' }));
        stage.appendChild(chainRows([
          ['learning rate η', '=', String(eta)],
          ['‖∇L‖ (all ' + Mo.nParams + ' params)', '=', S.gradNorm.toFixed(4)],
          ['‖∇L‖²', '=', S.gradNormSq.toFixed(4)],
          ['largest single gradient', '=', sgn(Mo.flat(G.gW2).concat(Mo.flat(G.gb2), Mo.flat(G.gW1), Mo.flat(G.gb1)).reduce(function (a, b) { return Math.abs(b) > Math.abs(a) ? b : a; }), 4)]
        ]));
        stage.appendChild(UI.textCard('Nothing below re-derives anything. The four gradient tensors from the backward tab are used exactly as they came out, and they have already been verified against numerical differentiation on the previous tab.', 'note'));
        ledgerNote('η', 'scalar', 'Learning rate, ' + eta + '.');
      }
    });

    steps.push({
      title: 'Update layer 2: W₂ and b₂',
      formula: 'W_2 \\leftarrow W_2 - \\eta\\,\\frac{\\partial L}{\\partial W_2}, \\qquad b_2 \\leftarrow b_2 - \\eta\\,\\frac{\\partial L}{\\partial b_2}',
      note: 'Elementwise: each weight moves against its own partial derivative, scaled by <span>$\\eta$</span>. A weight with a large gradient moves far; one with a gradient near zero barely moves at all — the step size is not uniform across parameters, it is proportional to how much each one matters right now.',
      render: function (stage) {
        stage.appendChild(W2Panel({ title: 'W₂ (old)', dim: true }));
        stage.appendChild(UI.arrow('−η·', '∂L/∂W₂'));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₂', shapeLabel: CFG.nHid + ' × ' + CFG.nOut, matrix: R2(G.gW2),
          rowLabels: HID_LBL, colLabels: OUT_LBL, dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(UI.matrixPanel({ title: 'W₂ (new)', shapeLabel: CFG.nHid + ' × ' + CFG.nOut, matrix: R2(S.P2.W2),
          rowLabels: HID_LBL, colLabels: OUT_LBL, fresh: true }));
        stage.appendChild(UI.matrixPanel({ title: 'b₂ (new)', shapeLabel: '1 × ' + CFG.nOut, matrix: R2(S.P2.b2),
          rowLabels: ['bias'], colLabels: OUT_LBL, fresh: true,
          meaning: 'Was ' + Mo.b2[0].map(function (v) { return sgn(v, 1); }).join(', ') + '.' }));
        stage.appendChild(chainRows([
          ['W₂[h₀, o₀]', '=', sgn(Mo.W2[0][0], 2) + ' − ' + eta + '×' + sgn(G.gW2[0][0], 3) + ' = ' + sgn(S.P2.W2[0][0], 3)],
          ['b₂[o₁]', '=', sgn(Mo.b2[0][1], 2) + ' − ' + eta + '×' + sgn(G.gb2[0][1], 3) + ' = ' + sgn(S.P2.b2[0][1], 3)]
        ]));
      }
    });

    steps.push({
      title: 'Update layer 1: W₁ and b₁',
      formula: 'W_1 \\leftarrow W_1 - \\eta\\,\\frac{\\partial L}{\\partial W_1}, \\qquad b_1 \\leftarrow b_1 - \\eta\\,\\frac{\\partial L}{\\partial b_1}',
      note: 'The same rule, using gradients that arrived through two more chain-rule steps. Note that layer 1 is updated with the <em>old</em> <code>W₂</code>\'s gradient information — every gradient in the step was computed at the same starting point, before anything moved. Updating sequentially, layer by layer, using partly-updated parameters would be a different (and wrong) algorithm.',
      render: function (stage) {
        stage.appendChild(W1Panel({ title: 'W₁ (old)', dim: true }));
        stage.appendChild(UI.arrow('−η·', '∂L/∂W₁'));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₁', shapeLabel: CFG.nIn + ' × ' + CFG.nHid, matrix: R2(G.gW1),
          rowLabels: IN_LBL, colLabels: HID_LBL, dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(UI.matrixPanel({ title: 'W₁ (new)', shapeLabel: CFG.nIn + ' × ' + CFG.nHid, matrix: R2(S.P2.W1),
          rowLabels: IN_LBL, colLabels: HID_LBL, fresh: true }));
        stage.appendChild(UI.matrixPanel({ title: 'b₁ (new)', shapeLabel: '1 × ' + CFG.nHid, matrix: R2(S.P2.b1),
          rowLabels: ['bias'], colLabels: HID_LBL, fresh: true,
          meaning: 'Was ' + Mo.b1[0].map(function (v) { return sgn(v, 1); }).join(', ') + '.' }));
      }
    });

    steps.push({
      title: 'Re-run the forward pass with the new parameters',
      formula: 'z_1\' = xW_1\' + b_1\', \\quad a_1\' = \\tanh(z_1\'), \\quad \\hat{y}\' = a_1\'W_2\' + b_2\'',
      note: 'Same input, same target, same six operations — only the parameters changed. Compare the new prediction against the target: both outputs have moved toward <span>$y = (' + Mo.y[0].map(function (v) { return sgn(v, 1); }).join(', ') + ')$</span>.',
      render: function (stage) {
        stage.appendChild(hidPanel('z₁ (new)', S.fwd2.z1, { fresh: true, meaning: 'Was ' + F.z1[0].map(function (v) { return sgn(v); }).join(', ') + '.' }));
        stage.appendChild(hidPanel('a₁ (new)', S.fwd2.a1, { fresh: true }));
        stage.appendChild(outPanel('ŷ (new)', S.fwd2.z2, { fresh: true, meaning: 'Was ' + F.z2[0].map(function (v) { return sgn(v); }).join(', ') + '.' }));
        stage.appendChild(yPanel({ title: 'y — target (unchanged)', dim: true }));
        stage.appendChild(outPanel('r (new residual)', S.fwd2.resid, { fresh: true,
          meaning: 'Was ' + F.resid[0].map(function (v) { return sgn(v); }).join(', ') + ' — both are closer to zero now.' }));
      }
    });

    steps.push({
      title: 'The loss went down',
      formula: 'L: ' + S.lossBefore.toFixed(4) + ' \\;\\longrightarrow\\; ' + S.lossAfter.toFixed(4),
      note: 'One step, one example, and the loss fell by <strong>' + S.drop.toFixed(4) + '</strong> — a ' + (100 * S.drop / S.lossBefore).toFixed(1) + '% reduction. That is the payoff for the whole page: the gradients were derived by the chain rule, verified against numerical differentiation, and applied — and the thing they were supposed to reduce got smaller. Repeat a few million times over many examples and the word for it is training.',
      render: function (stage) {
        stage.appendChild(scalarPanel({ title: 'L before', value: S.lossBefore, maxAbs: 2, dim: true }));
        stage.appendChild(UI.arrow('→', 'one step, η=' + eta));
        stage.appendChild(scalarPanel({ title: 'L after', value: S.lossAfter, maxAbs: 2, fresh: true }));
        stage.appendChild(UI.barsPanel({
          title: 'Loss', unit: '',
          items: [
            { label: 'before the step', value: Number(S.lossBefore.toFixed(4)), colorVar: 'var(--know-cold)' },
            { label: 'after the step', value: Number(S.lossAfter.toFixed(4)), colorVar: 'var(--c-practice)' }
          ]
        }));
        stage.appendChild(UI.checkBadge(S.lossAfter < S.lossBefore,
          'loss decreased by ' + S.drop.toFixed(4) + ' (' + (100 * S.drop / S.lossBefore).toFixed(1) + '%)'));
      }
    });

    steps.push({
      title: 'How close was the linear prediction?',
      formula: '\\Delta L \\;\\approx\\; \\eta\\,\\|\\nabla L\\|^2 \\quad \\text{as } \\eta \\to 0',
      note: 'The gradient promises a specific drop: move by <span>$-\\eta\\nabla L$</span> and, <em>to first order</em>, the loss falls by <span>$\\eta\\|\\nabla L\\|^2$</span>. At <span>$\\eta = ' + eta + '$</span> the prediction is ' + S.predictedDrop.toFixed(4) + ' and the actual drop is ' + S.drop.toFixed(4) + ' — the promise overshoots, because a gradient describes the surface only at the point where it was taken and this step is not small. Shrink <span>$\\eta$</span> and the ratio climbs toward 1, which is the definition of a derivative doing its job.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'Predicted drop vs actual drop', shapeLabel: Mo.LINEARITY.length + ' learning rates',
          headers: ['learning rate', 'predicted drop η‖∇L‖²', 'actual drop L − L′', 'actual / predicted'],
          rows: Mo.LINEARITY.map(function (l) {
            return [String(l.eta), l.predDrop.toFixed(5), l.actualDrop.toFixed(5), l.ratio.toFixed(4)];
          }),
          highlight: function (i) { return Mo.LINEARITY[i].eta === eta; },
          meaning: 'The ratio approaches 1 as η shrinks. That convergence is the first-order Taylor expansion being confirmed numerically, on the same gradients the check tab verified.'
        }));
        stage.appendChild(UI.checkBadge(Mo.LINEARITY[Mo.LINEARITY.length - 1].ratio > 0.98,
          'at η = ' + Mo.LINEARITY[Mo.LINEARITY.length - 1].eta + ', prediction and reality agree to ' +
          (100 * Mo.LINEARITY[Mo.LINEARITY.length - 1].ratio).toFixed(1) + '%'));
      }
    });

    steps.push({
      title: 'And if the learning rate is wrong',
      formula: 'L\\left(\\theta - \\eta\\nabla L\\right) \\quad \\text{as a function of } \\eta',
      note: 'The same gradients, the same single step, at ' + Mo.ETA_SWEEP.length + ' different learning rates. Small <span>$\\eta$</span> barely moves; the loss bottoms out near <span>$\\eta = ' + Mo.ETA_BEST.eta + '$</span>; and past that the step jumps over the valley and the loss climbs again — at <span>$\\eta = ' + Mo.ETA_SWEEP[Mo.ETA_SWEEP.length - 1].eta + '$</span> it ends up <strong>' + (Mo.ETA_SWEEP[Mo.ETA_SWEEP.length - 1].loss / S.lossBefore).toFixed(1) + '× worse than where it started</strong>. A correct gradient tells you which way is downhill. It does not tell you how far to walk.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Loss after one step, by learning rate', unit: '',
          items: Mo.ETA_SWEEP.map(function (e) {
            return { label: 'η = ' + e.eta + (e.eta === 0 ? '  (no step)' : ''), value: Number(e.loss.toFixed(4)),
              colorVar: e.loss < S.lossBefore ? 'var(--c-practice)' : 'var(--know-cold)' };
          }),
          meaning: 'Green = this step improved things, red = it made them worse. Computed by actually taking each step and re-running the forward pass.'
        }));
        stage.appendChild(UI.checkBadge(Mo.ETA_BEST.loss < S.lossBefore,
          'best swept η = ' + Mo.ETA_BEST.eta + ' → L = ' + Mo.ETA_BEST.loss.toFixed(4)));
      }
    });

    return steps;
  }

  // ============================================================ BATCH ============================================================
  function buildBatch() {
    var steps = [];
    var BF = BT.fwd, BG = BT.bwd, N = CFG.N;

    function batchHid(title, mat, o) {
      o = o || {};
      return UI.matrixPanel({ title: title, shapeLabel: 'N=' + N + ' × n_hidden=' + CFG.nHid, matrix: R2(mat),
        rowLabels: BATCH_ROWS, colLabels: HID_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning, colorMode: o.colorMode });
    }
    function batchOut(title, mat, o) {
      o = o || {};
      return UI.matrixPanel({ title: title, shapeLabel: 'N=' + N + ' × n_out=' + CFG.nOut, matrix: R2(mat),
        rowLabels: BATCH_ROWS, colLabels: OUT_LBL, dim: o.dim, fresh: o.fresh, meaning: o.meaning, colorMode: o.colorMode });
    }

    steps.push({
      title: 'Everything so far, with one more row',
      formula: 'X \\in \\mathbb{R}^{N\\times n_{in}}, \\qquad Y \\in \\mathbb{R}^{N\\times n_{out}}',
      note: 'Real training does not use one example at a time. Stacking <span>$N$</span> examples as rows changes nothing about the seven forward operations or the nine backward ones — the matrices simply grow a row axis. Row 0 is the exact example the first four tabs used, so every number for it should look familiar.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'X — inputs', shapeLabel: 'N=' + N + ' × n_in=' + CFG.nIn,
          matrix: R2(Mo.X), rowLabels: BATCH_ROWS, colLabels: IN_LBL, fresh: true,
          meaning: 'Row 0 is the x from the Forward tab. Row 1 is a second example.' }));
        stage.appendChild(UI.matrixPanel({ title: 'Y — targets', shapeLabel: 'N=' + N + ' × n_out=' + CFG.nOut,
          matrix: R2(Mo.Y), rowLabels: BATCH_ROWS, colLabels: OUT_LBL, fresh: true }));
        stage.appendChild(UI.textCard('The parameters are unchanged and there are still only ' + Mo.nParams + ' of them. That asymmetry — data grows with <span>$N$</span>, parameters do not — is exactly why the batch axis has to be summed away somewhere in the backward pass. Finding where is the point of this tab.', 'note'));
      }
    });

    steps.push({
      title: 'Z₁ = X·W₁ + b₁, and the broadcast',
      formula: 'Z_1 = XW_1 + \\mathbf{1}_N b_1 \\in \\mathbb{R}^{N\\times n_{hidden}}',
      note: 'The matmul handles the extra row automatically: <span>$(N{\\times}3)(3{\\times}4)$</span> gives <span>$(N{\\times}4)$</span>. The bias does not — <code>b₁</code> is one row and <code>Z₁</code> is <span>$N$</span> rows, so it is <strong>broadcast</strong>, meaning the same bias row is added to every example. That copying is what will force a sum in the backward direction.',
      render: function (stage) {
        stage.appendChild(batchHid('Z₁ raw = X·W₁', BF.z1raw, { dim: true }));
        stage.appendChild(UI.arrow('+', 'b₁ broadcast'));
        stage.appendChild(UI.matrixPanel({ title: 'b₁ tiled to N rows', shapeLabel: 'N=' + N + ' × ' + CFG.nHid,
          matrix: R2(BF.B1), rowLabels: BATCH_ROWS, colLabels: HID_LBL, dim: true,
          meaning: 'Not really stored — the same ' + CFG.nHid + ' numbers, reused per row.' }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(batchHid('Z₁', BF.z1, { fresh: true,
          meaning: 'Row 0 matches the Forward tab exactly: ' + F.z1[0].map(function (v) { return sgn(v); }).join(', ') + '.' }));
      }
    });

    steps.push({
      title: 'A₁ = tanh(Z₁), then Z₂ = A₁·W₂ + b₂',
      formula: 'A_1 = \\tanh(Z_1), \\qquad \\hat{Y} = Z_2 = A_1W_2 + \\mathbf{1}_N b_2',
      note: 'Elementwise functions do not care about the batch axis at all, and the second layer is the same pair of operations as the first. Two examples have now gone through the network without interacting — no row of <code>Z₂</code> depends on any other row, which is why a batch is parallel rather than sequential.',
      render: function (stage) {
        stage.appendChild(batchHid('A₁ = tanh(Z₁)', BF.a1, { fresh: true }));
        stage.appendChild(UI.arrow('⊗', '× W₂, + b₂'));
        stage.appendChild(batchOut('Ŷ = Z₂', BF.z2, { fresh: true,
          meaning: 'Row 0 matches the Forward tab: ' + F.z2[0].map(function (v) { return sgn(v); }).join(', ') + '.' }));
        stage.appendChild(batchOut('R = Ŷ − Y', BF.resid, { fresh: true, meaning: 'One residual row per example.' }));
      }
    });

    steps.push({
      title: 'The loss averages over the batch',
      formula: 'L = \\frac{1}{N}\\sum_{n=1}^{N} \\tfrac{1}{2}\\sum_k (\\hat{y}_{nk} - y_{nk})^2',
      note: 'Each example contributes its own squared error; the batch loss is their <strong>mean</strong>. Averaging rather than summing is a choice, and it is the one that matters in practice: it keeps the gradient magnitude — and therefore the useful range of learning rates — independent of how big the batch happens to be.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'Per-example losses', shapeLabel: 'N = ' + N,
          headers: ['example', '½Σ(ŷ−y)²', 'share of the batch loss'],
          rows: BF.perExample.map(function (v, n) {
            return ['ex ' + n, v.toFixed(5), (100 * v / (BF.perExample[0] + BF.perExample[1])).toFixed(1) + '%'];
          }).concat([['<strong>mean</strong>', '<strong>' + BF.loss.toFixed(5) + '</strong>', '<strong>L</strong>']]),
          meaning: 'Example ' + (BF.perExample[0] > BF.perExample[1] ? '0' : '1') + ' is currently fit much worse, so it will dominate the gradient.'
        }));
        stage.appendChild(scalarPanel({ title: 'L (batch)', value: BF.loss, maxAbs: 2, fresh: true,
          meaning: '(' + BF.perExample[0].toFixed(4) + ' + ' + BF.perExample[1].toFixed(4) + ') / ' + N + ' = ' + BF.loss.toFixed(5) }));
      }
    });

    steps.push({
      title: '∂L/∂Z₂ — the 1/N shows up immediately',
      formula: '\\frac{\\partial L}{\\partial Z_2} = \\frac{1}{N}\\left(\\hat{Y} - Y\\right)',
      note: 'The <span>$1/N$</span> from the loss definition lands on the very first gradient and is then carried, unchanged, through every step behind it — it never needs to be applied a second time. Row <span>$n$</span> is example <span>$n$</span>\'s own error signal, scaled down by the batch size.',
      render: function (stage) {
        stage.appendChild(batchOut('R = Ŷ − Y', BF.resid, { dim: true }));
        stage.appendChild(UI.arrow('×', '1/N = 1/' + N));
        stage.appendChild(batchOut('∂L/∂Z₂', BG.dz2, { fresh: true,
          meaning: 'Row 0 is the Forward tab\'s δ₂ halved, because it now carries only 1/' + N + ' of the responsibility.' }));
      }
    });

    steps.push({
      title: '∂L/∂W₂ = A₁ᵀ·∂L/∂Z₂ — where the batch sum hides',
      formula: '\\frac{\\partial L}{\\partial W_2} = A_1^{\\top}\\frac{\\partial L}{\\partial Z_2} \\in \\mathbb{R}^{n_{hidden}\\times n_{out}}',
      note: 'This is the step worth slowing down for. <code>W₂</code> has no batch axis, but the gradient arriving does — so the batch axis has to disappear, and the matmul is what removes it. <span>$(4{\\times}N)(N{\\times}2)$</span> contracts over <span>$N$</span>: every entry of the result is a <strong>sum over the examples</strong>. The outer product from the single-example tab is the same formula with <span>$N = 1$</span>.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'A₁ᵀ', shapeLabel: CFG.nHid + ' × N=' + N,
          matrix: R2(M.transpose(BF.a1)), rowLabels: HID_LBL, colLabels: BATCH_ROWS, dim: true }));
        stage.appendChild(UI.arrow('⊗', 'contract over N'));
        stage.appendChild(batchOut('∂L/∂Z₂', BG.dz2, { dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₂ (batch)', shapeLabel: CFG.nHid + ' × ' + CFG.nOut,
          matrix: R2(BG.gW2), rowLabels: HID_LBL, colLabels: OUT_LBL, fresh: true,
          meaning: 'The batch axis is gone. Shape matches W₂, exactly as the shape rule demands.' }));
        stage.appendChild(chainRows([[
          '∂L/∂W₂[h₀, o₀]', '=',
          BATCH_ROWS.map(function (r, n) { return sgn(BF.a1[n][0], 3) + '×' + sgn(BG.dz2[n][0], 3); }).join(' + ') +
          ' = ' + sgn(BG.gW2[0][0], 4)
        ]]));
      }
    });

    steps.push({
      title: '∂L/∂b₂ — a broadcast backward is a sum',
      formula: '\\frac{\\partial L}{\\partial b_2} = \\sum_{n=1}^{N} \\frac{\\partial L}{\\partial Z_2}[n,:]',
      note: 'Forward, <code>b₂</code> was copied to all <span>$N$</span> rows. Every copy influenced the loss, so the gradients of all <span>$N$</span> copies add up. The general rule: <strong>whatever a broadcast duplicates along an axis, the backward pass sums along that axis.</strong> Forgetting this sum is the single most common hand-written-backprop bug, and it is invisible at <span>$N = 1$</span> — which is why it survives testing on one example.',
      render: function (stage) {
        stage.appendChild(batchOut('∂L/∂Z₂', BG.dz2, { dim: true }));
        stage.appendChild(UI.arrow('Σ', 'sum over rows'));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₂', shapeLabel: '1 × ' + CFG.nOut, matrix: R2(BG.gb2),
          rowLabels: ['grad'], colLabels: OUT_LBL, fresh: true }));
        stage.appendChild(chainRows(OUT_LBL.map(function (o, k) {
          return ['∂L/∂b₂[' + o + ']', '=',
            BATCH_ROWS.map(function (r, n) { return sgn(BG.dz2[n][k], 4); }).join(' + ') + ' = ' + sgn(BG.gb2[0][k], 4)];
        })));
      }
    });

    steps.push({
      title: 'Back through tanh, one row per example',
      formula: '\\frac{\\partial L}{\\partial A_1} = \\frac{\\partial L}{\\partial Z_2}W_2^{\\top}, \\qquad \\frac{\\partial L}{\\partial Z_1} = \\frac{\\partial L}{\\partial A_1}\\odot\\left(1 - A_1^2\\right)',
      note: 'Both of these keep the batch axis, because activations are per-example — every row of <code>A₁</code> belongs to one example and gets its own gradient. Only the <em>parameter</em> gradients contract over <span>$N$</span>. That distinction is the whole grammar of batched backprop: activation gradients keep the batch axis, parameter gradients sum it away.',
      render: function (stage) {
        stage.appendChild(batchHid('∂L/∂A₁', BG.da1, { fresh: true }));
        stage.appendChild(UI.arrow('⊙', '1 − A₁²'));
        stage.appendChild(batchHid('tanh′(Z₁)', BG.tanhPrime, { dim: true, colorMode: 'prob' }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(batchHid('∂L/∂Z₁', BG.dz1, { fresh: true, meaning: 'Still N rows — one error signal per example.' }));
      }
    });

    steps.push({
      title: '∂L/∂W₁ = Xᵀ·∂L/∂Z₁, and ∂L/∂b₁',
      formula: '\\frac{\\partial L}{\\partial W_1} = X^{\\top}\\frac{\\partial L}{\\partial Z_1}, \\qquad \\frac{\\partial L}{\\partial b_1} = \\sum_n \\frac{\\partial L}{\\partial Z_1}[n,:]',
      note: 'Identical in form to the layer-2 pair: a matmul that contracts the batch axis for the weights, a row sum for the bias. Two layers, two shapes of tensor, one rule each — and that rule does not change when the network is a hundred layers deep.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'Xᵀ', shapeLabel: CFG.nIn + ' × N=' + N,
          matrix: R2(M.transpose(Mo.X)), rowLabels: IN_LBL, colLabels: BATCH_ROWS, dim: true }));
        stage.appendChild(UI.arrow('⊗', 'contract over N'));
        stage.appendChild(batchHid('∂L/∂Z₁', BG.dz1, { dim: true }));
        stage.appendChild(UI.arrow('=', ''));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₁ (batch)', shapeLabel: CFG.nIn + ' × ' + CFG.nHid,
          matrix: R2(BG.gW1), rowLabels: IN_LBL, colLabels: HID_LBL, fresh: true }));
        stage.appendChild(UI.matrixPanel({ title: '∂L/∂b₁ (batch)', shapeLabel: '1 × ' + CFG.nHid,
          matrix: R2(BG.gb1), rowLabels: ['grad'], colLabels: HID_LBL, fresh: true }));
      }
    });

    steps.push({
      title: 'Check: the batch gradient is the average of the per-example gradients',
      formula: '\\max\\left|\\;\\nabla_{\\text{batched}} - \\frac{1}{N}\\sum_{n} \\nabla_{\\text{example } n}\\;\\right| = ' + exp(BT.maxAbsDiff, 1).replace('−', '-'),
      note: 'The claim the matmuls quietly made is that <span>$A_1^{\\top}\\,\\partial L/\\partial Z_2$</span> <em>is</em> the sum over examples. It is testable: run the single-example backward pass ' + N + ' separate times, average the four gradient tensors, and compare against the batched result computed above. If the <span>$1/N$</span> had been applied twice, or a broadcast sum had been missed, this is where it would show.',
      render: function (stage) {
        BT.perExample.forEach(function (p) {
          stage.appendChild(UI.matrixPanel({ title: '∂L/∂W₂ from ex ' + p.n + ' alone', shapeLabel: CFG.nHid + ' × ' + CFG.nOut,
            matrix: R2(p.bwd.gW2), rowLabels: HID_LBL, colLabels: OUT_LBL, dim: true }));
        });
        stage.appendChild(UI.arrow('Σ/N', 'average'));
        stage.appendChild(UI.matrixPanel({ title: 'average of the ' + N, shapeLabel: CFG.nHid + ' × ' + CFG.nOut,
          matrix: R2(BT.avg.gW2), rowLabels: HID_LBL, colLabels: OUT_LBL, fresh: true }));
        stage.appendChild(UI.arrow('≟', ''));
        stage.appendChild(UI.matrixPanel({ title: 'batched A₁ᵀ·∂L/∂Z₂', shapeLabel: CFG.nHid + ' × ' + CFG.nOut,
          matrix: R2(BG.gW2), rowLabels: HID_LBL, colLabels: OUT_LBL }));
        stage.appendChild(tablePanel({
          title: 'Batched vs per-example average', shapeLabel: 'all four parameter tensors',
          headers: ['gradient', 'max |batched − average|'],
          rows: BT.diffs.map(function (d) { return [d.name, exp(d.d, 1)]; })
        }));
        stage.appendChild(UI.checkBadge(BT.ok, 'identical — max |Δ| = ' + exp(BT.maxAbsDiff, 1) + ' across all ' + Mo.nParams + ' parameters'));
        stage.appendChild(UI.textCard('Zero, not merely small: both routes perform the same additions in the same order, so they agree bit for bit. A batched gradient is not an approximation of the per-example gradients — it is their average, computed in one pass.', 'note'));
      }
    });

    return steps;
  }

  var TABS = [
    { id: 'forward', label: 'The forward pass', short: 'Forward', color: 'var(--c-attention)', build: buildForward },
    { id: 'backward', label: 'Backward: the chain rule, one step at a time', short: 'Backward', color: 'var(--accent-2)', build: buildBackward },
    { id: 'check', label: 'Gradient check against central differences', short: 'Gradient check', color: 'var(--c-practice)', build: buildCheck },
    { id: 'descent', label: 'One step of gradient descent', short: 'One step', color: 'var(--c-efficient)', build: buildDescent },
    { id: 'batch', label: 'From one example to a batch', short: 'Batch', color: 'var(--c-gpu)', build: buildBatch }
  ];

  window.BackpropLabSteps = { FWD: F, BWD: G, CHECK: C, STEP: S, BATCH: BT, TABS: TABS };

  /* The contract the shared controller (lab-app.js) reads. */
  window.KML_LAB = {
    tabs: TABS,
    dims: [
      { sym: 'n_in', val: String(CFG.nIn), def: 'Input features — the width of one example. Sets W₁\'s first dimension and nothing else.' },
      { sym: 'n_hidden', val: String(CFG.nHid), def: 'Hidden units in the single tanh layer. The only dimension that is a free design choice here: it sets W₁\'s second dimension and W₂\'s first.' },
      { sym: 'n_out', val: String(CFG.nOut), def: 'Outputs, and therefore the width of the target y and of the residual the loss is built from.' },
      { sym: 'P', val: String(Mo.nParams), def: 'Learnable parameters: 12 in W₁, 4 in b₁, 8 in W₂, 2 in b₂. One backward sweep produces a gradient for every one of them.' }
    ],
    dimsFor: {
      forward: [{ sym: 'L', val: '—', def: 'The loss for this example. Appears once the forward pass reaches it.' }],
      backward: [{ sym: 'L', val: F.loss.toFixed(4), def: 'The scalar every gradient on this tab is a derivative of.' }],
      check: [
        { sym: 'h', val: CFG.h.toExponential(0), def: 'Finite-difference step. Each parameter is nudged by ±h and the whole forward pass is re-run, giving a numerical estimate of its derivative that never touches the chain rule.' },
        { sym: 'max |Δ|', val: '—', def: 'The largest disagreement between the analytic and numerical gradients found so far on this tab. Computed live when the page loads.' }
      ],
      descent: [
        { sym: 'η', val: String(CFG.eta), def: 'Learning rate — how far along the negative gradient one step travels.' },
        { sym: 'L', val: F.loss.toFixed(4), def: 'The loss. Watch it change when the updated parameters are used.' }
      ],
      batch: [
        { sym: 'N', val: String(CFG.N), def: 'Examples in the batch. Activation gradients keep this axis; parameter gradients sum it away.' },
        { sym: 'L', val: BT.fwd.loss.toFixed(4), def: 'The batch loss: the mean of the per-example losses.' }
      ]
    },
    /* Chips that change as you step: the loss appears when it is computed, drops
       when the update is applied, and the running worst gradient-check gap fills
       in as each tensor is checked. */
    dimFix: function (tabId, stepIndex, list) {
      function set(sym, val) { list.forEach(function (d) { if (d.sym === sym) d.val = val; }); }
      if (tabId === 'forward') set('L', stepIndex >= 10 ? F.loss.toFixed(4) : '—');
      if (tabId === 'descent') set('L', stepIndex >= 4 ? S.lossAfter.toFixed(4) + ' ↓' : F.loss.toFixed(4));
      if (tabId === 'check') {
        // worst gap among the tensors checked up to and including this step
        var upto = [];
        if (stepIndex >= 1) upto.push(ONE.errCentral);
        if (stepIndex >= 3) upto.push(C.parts[0].maxAbs);
        if (stepIndex >= 4) upto.push(C.parts[1].maxAbs);
        if (stepIndex >= 5) upto.push(C.parts[2].maxAbs, C.parts[3].maxAbs);
        if (stepIndex >= 6) upto.push(C.parts[4].maxAbs);
        set('max |Δ|', upto.length ? exp(Math.max.apply(null, upto), 1) : '—');
      }
    }
  };
})();
