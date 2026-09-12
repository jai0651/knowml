/* KnowML — Quantization Lab: four walkthroughs over one small float weight block.
   Every step is one primitive operation — find the peak, divide, round, clamp,
   multiply back — never several folded together, so stepping through the page
   matches tracing the arithmetic by hand. Every figure in every caption is read
   out of the live computation in quantization-lab-model.js. */
(function () {
  'use strict';
  var M = window.KMLLabMath, Mo = window.QuantizationLabModel, UI = window.KMLLabUI, CFG = Mo.CFG;

  var ROWL = Mo.rowLabels, COLL = Mo.colLabels, ORD = Mo.ORDINARY_ROWS;
  var R2 = function (m) { return m.map(function (r) { return r.map(function (v) { return M.round(v, 2); }); }); };
  var x100 = function (m) { return Mo.times(m, 100); };
  var n = function (v, d) { return Number(v).toFixed(d == null ? 4 : d); };
  var pctS = function (v) { return v.toFixed(1) + '%'; };
  var cellName = function (i, j) { return ROWL[i] + '/' + COLL[j]; };

  // ---------------- everything the page shows, computed once ----------------
  var PT8 = Mo.quantPerTensor(Mo.W, CFG.bits8);        // tab 1 — clean block, one scale for all 32 weights
  var OUT8 = Mo.quantPerTensor(Mo.Wout, CFG.bits8);    // tab 2 — same block plus one planted outlier
  var PC8 = Mo.quantPerChannel(Mo.Wout, CFG.bits8);    // tab 3 — outlier block, one scale per row
  var PC8C = Mo.quantPerChannel(Mo.W, CFG.bits8);      // tab 4 baseline — clean block, per-channel INT8
  var PC4 = Mo.quantPerChannel(Mo.W, CFG.bits4);       // tab 4 — clean block, per-channel INT4
  var CHECK = Mo.selfCheck(Mo.W, CFG.bits8);

  var CS_CLEAN = Mo.codeStats(PT8.codes, CFG.bits8);
  var CS_OUT_ORD = Mo.codeStats(OUT8.codes, CFG.bits8, ORD);
  var CS_PC_ORD = Mo.codeStats(PC8.codes, CFG.bits8, ORD);
  var CS_INT4 = Mo.codeStats(PC4.codes, CFG.bits4);

  var CS_PC8C = Mo.codeStats(PC8C.codes, CFG.bits8);
  var COL_CLEAN = Mo.collisions(Mo.W, PT8.deq, PT8.codes);
  var COL_OUT = Mo.collisions(Mo.Wout, OUT8.deq, OUT8.codes, ORD);
  var COL_PC = Mo.collisions(Mo.Wout, PC8.deq, PC8.codes, ORD);
  var COL_8C = Mo.collisions(Mo.W, PC8C.deq, PC8C.codes);
  var COL_4 = Mo.collisions(Mo.W, PC4.deq, PC4.codes);

  var ERR_CLEAN_ORD = Mo.errStats(PT8.err, ORD);       // tab 1's error on the rows tab 2 will damage
  var ERR_OUT_ORD = Mo.errStats(OUT8.err, ORD);
  var ERR_PC_ORD = Mo.errStats(PC8.err, ORD);
  var ERR_OUT_ROW = Mo.errStats(OUT8.err, [CFG.outlierRow]);
  var ERR_PC_ROW = Mo.errStats(PC8.err, [CFG.outlierRow]);

  var OUTLIER_RATIO = CFG.outlierVal / PT8.peak.v;     // how much bigger the planted weight is
  var SCALE_RATIO = OUT8.scale / PT8.scale;
  var ERR_RATIO_OUT = ERR_OUT_ORD.meanAbs / ERR_CLEAN_ORD.meanAbs;
  var ERR_RATIO_FIX = ERR_OUT_ORD.meanAbs / ERR_PC_ORD.meanAbs;
  var ERR_RATIO_4 = PC4.stats.meanAbs / PC8C.stats.meanAbs;
  var STEP_RATIO_4 = Mo.qMax(CFG.bits8) / Mo.qMax(CFG.bits4);

  // colour scales for the error grids, in the ×100 display units, so that two
  // tabs comparing the same matrix are drawn on exactly the same ramp
  var E_CLEAN = PT8.bound * 100;
  var E_OUT = OUT8.bound * 100;                        // shared by tabs 2 and 3
  var E_INT4 = Math.max.apply(null, PC4.bounds) * 100;

  var MEM = {
    fp32: Mo.memory(CFG.rows, CFG.cols, 32, 'none'),
    int8pt: Mo.memory(CFG.rows, CFG.cols, CFG.bits8, 'per-tensor'),
    int8pc: Mo.memory(CFG.rows, CFG.cols, CFG.bits8, 'per-channel'),
    int4pc: Mo.memory(CFG.rows, CFG.cols, CFG.bits4, 'per-channel')
  };
  var BIG = {
    fp32: Mo.bigLayerMB(32, 'none'),
    int8pc: Mo.bigLayerMB(CFG.bits8, 'per-channel'),
    int4pc: Mo.bigLayerMB(CFG.bits4, 'per-channel')
  };
  var BIGMEM8 = Mo.memory(CFG.bigLayer, CFG.bigLayer, CFG.bits8, 'per-channel');
  var SCALE_OVERHEAD_PCT = BIGMEM8.scaleBytes / BIGMEM8.total * 100;

  // ---------------- rendering helpers built only from KMLLabUI ----------------
  // matrixPanel formats every cell as ±d.dd, which is right for floats and wrong
  // for integer codes and for numbers near ±127. This re-labels the cells after
  // the panel is built, and shrinks the type if a value needs more than 5 glyphs.
  function numPanel(opts, fmtFn) {
    var panel = UI.matrixPanel(opts);
    var cells = panel.querySelectorAll('.lab-grid > .lab-cell:not(.lab-cell--head):not(.lab-cell--corner)');
    var m = opts.matrix, texts = [], maxLen = 0;
    for (var i = 0; i < m.length; i++) {
      for (var j = 0; j < m[i].length; j++) {
        var t = fmtFn(m[i][j], i, j);
        texts.push(t);
        if (t.length > maxLen) maxLen = t.length;
      }
    }
    var size = maxLen >= 7 ? '9px' : maxLen >= 6 ? '10px' : '';
    for (var k = 0; k < cells.length && k < texts.length; k++) {
      cells[k].textContent = texts[k];
      if (size) cells[k].style.fontSize = size;
    }
    return panel;
  }
  function codePanel(opts) { return numPanel(opts, function (v) { return String(v); }); }
  function divPanel(opts) { return numPanel(opts, function (v) { return (Math.round(v * 10) / 10).toFixed(1); }); }

  function statsPanel(opts) {
    // opts: {title, shapeLabel, rows:[{k,v,hi}], meaning, fresh, headers:[a,b]}
    var wrap = UI.el('div', 'lab-panel' + (opts.fresh ? ' lab-panel--new' : ''));
    var head = UI.el('div', 'lab-panel-head');
    head.appendChild(UI.el('span', 'lab-panel-title', opts.title));
    if (opts.shapeLabel) head.appendChild(UI.el('span', 'lab-panel-shape', opts.shapeLabel));
    wrap.appendChild(head);
    var h = opts.headers || ['quantity', 'value'];
    var t = UI.el('table', 'lab-table');
    t.innerHTML = '<thead><tr><th>' + h[0] + '</th><th>' + h[1] + '</th></tr></thead>';
    var tb = UI.el('tbody');
    opts.rows.forEach(function (r) {
      var tr = UI.el('tr', r.hi ? 'lab-row--highlight' : '');
      tr.innerHTML = '<td>' + r.k + '</td><td>' + r.v + '</td>';
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    if (opts.meaning) wrap.appendChild(UI.el('div', 'lab-panel-meaning', opts.meaning));
    return wrap;
  }

  function ladderPanel(scale, bits, title, meaning) {
    var L = Mo.ladder(scale, bits, 9);
    return UI.matrixPanel({
      title: title, shapeLabel: 'sampled from ' + Mo.nCodes(bits) + ' codes',
      matrix: [L.values], rowLabels: ['value'], colLabels: L.codes.map(String),
      maxAbs: Mo.qMax(bits) * scale, meaning: meaning
    });
  }

  function errPanel(err, opts) {
    return UI.matrixPanel({
      title: opts.title, shapeLabel: CFG.rows + '×' + CFG.cols,
      badge: 'shown ×100 — a cell reading +1.00 is an error of 0.01',
      matrix: R2(x100(err)), rowLabels: ROWL, colLabels: COLL,
      colorMode: 'diverging', maxAbs: opts.maxAbs, dim: opts.dim, fresh: opts.fresh,
      meaning: opts.meaning
    });
  }

  function collisionPanel(col, title, meaning) {
    var wrap = UI.el('div', 'lab-panel lab-panel--new');
    wrap.appendChild(UI.el('div', 'lab-panel-head',
      '<span class="lab-panel-title">' + title + '</span><span class="lab-panel-shape">' + col.nGroups + ' shared values</span>'));
    var t = UI.el('table', 'lab-table');
    t.innerHTML = '<thead><tr><th>code</th><th>all become W′ =</th><th>distinct float weights that landed there</th><th>spread lost</th></tr></thead>';
    var tb = UI.el('tbody');
    col.groups.forEach(function (g) {
      var lo = Math.min.apply(null, g.values), hi = Math.max.apply(null, g.values);
      var tr = UI.el('tr');
      tr.innerHTML = '<td>' + g.codes.join(' / ') + '</td><td>' + g.value.toFixed(4) + '</td><td>' +
        g.values.map(function (v) { return v.toFixed(2); }).join(', ') + '</td><td>' + (hi - lo).toFixed(2) + '</td>';
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    if (meaning) wrap.appendChild(UI.el('div', 'lab-panel-meaning', meaning));
    return wrap;
  }

  function wPanel(mat, opts) {
    opts = opts || {};
    return UI.matrixPanel({
      title: opts.title || 'W — the float weights', shapeLabel: CFG.rows + '×' + CFG.cols,
      matrix: R2(mat), rowLabels: ROWL, colLabels: COLL,
      maxAbs: opts.maxAbs || 1, dim: opts.dim, fresh: opts.fresh, badge: opts.badge, meaning: opts.meaning
    });
  }

  // ============================================================ TAB 1 · INT8, PER-TENSOR ============================================================
  function buildInt8() {
    var steps = [];

    steps.push({
      title: 'The block we are about to shrink',
      formula: null,
      note: 'One slice of one layer: <strong>' + CFG.rows + ' output channels × ' + CFG.cols + ' input dimensions</strong>, ' + (CFG.rows * CFG.cols) + ' float weights. At fp32 that is <strong>' + MEM.fp32.weightBytes + ' bytes</strong>. Everything on this page — every code, every error, every byte — is derived from exactly these ' + (CFG.rows * CFG.cols) + ' numbers. A real layer is 4096×4096; the arithmetic below does not change, only the size of the grid.',
      render: function (stage) {
        stage.appendChild(wPanel(Mo.W, {
          meaning: 'Row = output channel, column = input dimension. Values were drawn once from a seeded RNG in [−1, 1] and rounded to 2 decimals, so you can check any cell by hand.'
        }));
      }
    });

    steps.push({
      title: 'Step one is a search, not arithmetic: find max |W|',
      formula: '\\alpha = \\max_{i,j} |W_{ij}|',
      note: 'Symmetric quantization is defined entirely by one number — the largest magnitude in the block. Here it is <strong>' + n(PT8.peak.v, 2) + '</strong>, at <code>' + cellName(PT8.peak.i, PT8.peak.j) + '</code>. Remember that this is a <em>max</em>, not an average: a single weight, anywhere in the block, decides the fate of all ' + (CFG.rows * CFG.cols) + '. That is the hinge the whole next tab turns on.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({
          title: '|W| — magnitudes only', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: R2(Mo.absMat(Mo.W)), rowLabels: ROWL, colLabels: COLL,
          maxAbs: PT8.peak.v, fresh: true,
          meaning: 'The darkest cell is the block maximum, α = ' + n(PT8.peak.v, 2) + ' at ' + cellName(PT8.peak.i, PT8.peak.j) + '. Sign has been dropped — symmetric quantization only cares about distance from zero.'
        }));
      }
    });

    steps.push({
      title: 'Choose the scale: s = α / 127',
      formula: 's = \\frac{\\alpha}{2^{b-1}-1} = \\frac{' + n(PT8.peak.v, 2) + '}{' + PT8.qMax + '} = ' + n(PT8.scale, 6),
      note: 'An <code>int8</code> byte holds 256 bit patterns, but symmetric quantization drops the most negative one (<code>−128</code>) so the grid is centred on an exact zero — leaving <strong>' + PT8.nCodes + ' usable codes</strong>, from <code>−' + PT8.qMax + '</code> to <code>+' + PT8.qMax + '</code>. The scale <span>$s$</span> is the width of one step on that grid: the distance in float space between two neighbouring integers. Everything that follows is division and multiplication by this single number.',
      render: function (stage) {
        stage.appendChild(statsPanel({
          title: 'The quantization grid', fresh: true,
          rows: [
            { k: 'bits', v: String(CFG.bits8) },
            { k: 'bit patterns in the byte', v: String(Math.pow(2, CFG.bits8)) },
            { k: 'usable codes (symmetric)', v: String(PT8.nCodes) + '  (−' + PT8.qMax + ' … +' + PT8.qMax + ')' },
            { k: 'α = max |W|', v: n(PT8.peak.v, 2) + '  at ' + cellName(PT8.peak.i, PT8.peak.j) },
            { k: 's = α / ' + PT8.qMax, v: n(PT8.scale, 9), hi: true }
          ],
          meaning: 'One float per block is stored alongside the integers. That is the entire overhead of per-tensor quantization: ' + MEM.int8pt.scaleBytes + ' bytes.'
        }));
        stage.appendChild(UI.arrow('↦', 'grid of representable values'));
        stage.appendChild(ladderPanel(PT8.scale, CFG.bits8, 'What INT8 can represent',
          'Nine of the ' + PT8.nCodes + ' rungs. Any float now has to land on one of them — the rungs are ' + n(PT8.scale, 6) + ' apart, everywhere, uniformly.'));
      }
    });

    steps.push({
      title: 'Divide every weight by the scale',
      formula: 'W / s \\in [-' + PT8.qMax + ',\\, ' + PT8.qMax + ']',
      note: 'This is the only place the float values move. Each weight is re-expressed as "how many grid steps from zero am I" — a real number, still carrying its fractional part. The cell holding <span>$\\alpha$</span> lands on exactly <strong>' + (Mo.W[PT8.peak.i][PT8.peak.j] < 0 ? '−' : '+') + PT8.qMax + '.0</strong> by construction, and nothing else can exceed it.',
      render: function (stage) {
        stage.appendChild(wPanel(Mo.W, { dim: true }));
        stage.appendChild(UI.arrow('÷', '÷ s = ' + n(PT8.scale, 6)));
        stage.appendChild(divPanel({
          title: 'W / s — grid steps, still fractional', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: PT8.div, rowLabels: ROWL, colLabels: COLL, maxAbs: PT8.qMax, fresh: true,
          meaning: 'Look at the digits after the decimal point. That fraction is precisely what the next step throws away — and it is the entire quantization error.'
        }));
      }
    });

    steps.push({
      title: 'Round to the nearest integer — this is where information is lost',
      formula: 'q = \\mathrm{round}(W/s)',
      note: 'Rounding is the lossy operation. Every other step on this tab is exactly reversible; this one is not. The discarded fraction is bounded by <span>$0.5$</span> grid steps, which is why the float error can never exceed <span>$s/2 = ' + n(PT8.bound, 6) + '$</span> — a bound this page checks numerically two steps from now.',
      render: function (stage) {
        stage.appendChild(divPanel({
          title: 'W / s', shapeLabel: CFG.rows + '×' + CFG.cols, matrix: PT8.div, maxAbs: PT8.qMax, dim: true
        }));
        stage.appendChild(UI.arrow('⌊⌉', 'round to nearest'));
        stage.appendChild(codePanel({
          title: 'q — integer codes', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: PT8.rounded, rowLabels: ROWL, colLabels: COLL, maxAbs: PT8.qMax, fresh: true,
          meaning: 'These ' + (CFG.rows * CFG.cols) + ' integers are what actually gets stored — one byte each, ' + MEM.int8pt.weightBytes + ' bytes in total.'
        }));
      }
    });

    steps.push({
      title: 'Clamp into the representable range',
      formula: 'q \\leftarrow \\mathrm{clip}(q,\\, -' + PT8.qMax + ',\\, +' + PT8.qMax + ')',
      note: 'A byte cannot hold anything outside <span>$[-' + PT8.qMax + ', ' + PT8.qMax + ']$</span>, so out-of-range codes are clipped. Here <strong>' + PT8.nClamped + ' of ' + (CFG.rows * CFG.cols) + ' cells clamp</strong> — and that is not luck, it is forced: the scale was derived from the block maximum, so by construction no weight can round past <span>$\\pm' + PT8.qMax + '$</span>. Clipping only starts to bite when the scale comes from a calibration set rather than from the tensor itself, which is exactly how activation quantization works.',
      render: function (stage) {
        stage.appendChild(codePanel({
          title: 'q after clamping', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: PT8.codes, rowLabels: ROWL, colLabels: COLL, maxAbs: PT8.qMax,
          meaning: 'Identical to the previous panel: ' + PT8.nClamped + ' values changed.'
        }));
        stage.appendChild(UI.checkBadge(PT8.nClamped === 0,
          PT8.nClamped + ' of ' + (CFG.rows * CFG.cols) + ' codes needed clipping — max |q| before clamping was ' +
          Math.max.apply(null, Mo.flat(Mo.absMat(PT8.rounded))) + ', the limit is ' + PT8.qMax));
      }
    });

    steps.push({
      title: 'Dequantize: W′ = q · s',
      formula: 'W\' = q \\cdot s',
      note: 'To use the weights in a matmul you multiply the integers back by the scale. This is one float multiply per weight, and in practice it gets folded into the surrounding arithmetic so it is nearly free. <code>W′</code> is what the model actually computes with from now on — the original <code>W</code> no longer exists anywhere.',
      render: function (stage) {
        stage.appendChild(codePanel({
          title: 'q', shapeLabel: CFG.rows + '×' + CFG.cols, matrix: PT8.codes, maxAbs: PT8.qMax, dim: true
        }));
        stage.appendChild(UI.arrow('×', '× s = ' + n(PT8.scale, 6)));
        stage.appendChild(wPanel(PT8.deq, {
          title: 'W′ — dequantized weights', fresh: true, maxAbs: PT8.peak.v,
          meaning: 'Same shape, same rough values, but every entry is now an exact multiple of s. Only ' + PT8.nCodes + ' distinct values are reachable anywhere in this grid.'
        }));
      }
    });

    steps.push({
      title: 'What was lost: the error matrix W − W′',
      formula: 'E = W - W\' ,\\qquad \\max|E| = ' + n(PT8.stats.maxAbs, 6) + ',\\quad \\overline{|E|} = ' + n(PT8.stats.meanAbs, 6),
      note: 'Here is the answer to "what does quantization cost". <strong>Max absolute error ' + n(PT8.stats.maxAbs, 6) + '</strong>, <strong>mean absolute error ' + n(PT8.stats.meanAbs, 6) + '</strong> — that is ' + pctS(PT8.stats.maxAbs / PT8.peak.v * 100) + ' and ' + pctS(PT8.stats.meanAbs / PT8.peak.v * 100) + ' of the largest weight. Notice the error is <em>not uniform</em>: some cells are almost exact, some sit at the full half-step. Whether a given weight is hurt depends only on where its fractional part fell, which is effectively arbitrary.',
      render: function (stage) {
        stage.appendChild(errPanel(PT8.err, {
          title: 'E = W − W′', maxAbs: E_CLEAN, fresh: true,
          meaning: 'Pink is a positive error (W′ undershot the true weight), blue is negative. The ramp saturates at ±' + n(E_CLEAN, 2) + ', which is the half-step bound s/2 × 100 — so a fully saturated cell is a worst-case round.'
        }));
        stage.appendChild(statsPanel({
          title: 'Error accounting', fresh: true,
          rows: [
            { k: 'max |W − W′|', v: n(PT8.stats.maxAbs, 8), hi: true },
            { k: 'mean |W − W′|', v: n(PT8.stats.meanAbs, 8) },
            { k: 'theoretical bound s/2', v: n(PT8.bound, 8) },
            { k: 'max error ÷ bound', v: n(PT8.stats.maxAbs / PT8.bound, 6) },
            { k: 'max error as % of α', v: pctS(PT8.stats.maxAbs / PT8.peak.v * 100) },
            { k: 'cells with zero error', v: String(Mo.flat(PT8.err).filter(function (v) { return v === 0; }).length) + ' of ' + (CFG.rows * CFG.cols) }
          ],
          meaning: 'The worst cell sits exactly on the bound, which is the strongest evidence that nothing here is approximate: rounding really cannot do worse than half a step.'
        }));
      }
    });

    steps.push({
      title: 'Self-check: is W′ really nothing but code × scale?',
      formula: 'W\'_{' + CHECK.i + ',' + CHECK.j + '} \\stackrel{?}{=} q_{' + CHECK.i + ',' + CHECK.j + '} \\cdot s = ' + CHECK.code + ' \\times ' + n(CHECK.scale, 9) + ' = ' + n(CHECK.byHand, 9),
      note: 'Three independent checks that the claim on this tab is literal. <strong>(1)</strong> Take the worst-error cell <code>' + cellName(CHECK.i, CHECK.j) + '</code>, read its printed code and the printed scale, multiply them by hand, and compare to the stored <code>W′</code>. <strong>(2)</strong> Re-derive the scale from <code>W′</code> alone and quantize it a second time: if dequantized values are exactly on the grid, the codes must come back identical, and quantization must be idempotent. <strong>(3)</strong> Confirm no error exceeded the half-step bound.',
      render: function (stage) {
        stage.appendChild(statsPanel({
          title: 'Cell ' + cellName(CHECK.i, CHECK.j) + ', recomputed by hand', fresh: true,
          rows: [
            { k: 'W (original)', v: n(Mo.W[CHECK.i][CHECK.j], 2) },
            { k: 'q (stored code)', v: String(CHECK.code) },
            { k: 's (stored scale)', v: n(CHECK.scale, 12) },
            { k: 'q × s, by hand', v: n(CHECK.byHand, 12), hi: true },
            { k: 'W′ as stored', v: n(CHECK.stored, 12), hi: true },
            { k: '| difference |', v: CHECK.handDiff === 0 ? '0 (bit-identical)' : CHECK.handDiff.toExponential(2) },
            { k: 'W − W′ for this cell', v: n(CHECK.worstErr, 10) }
          ]
        }));
        stage.appendChild(statsPanel({
          title: 'Quantize W′ a second time', fresh: true,
          rows: [
            { k: 'scale re-derived from W′', v: n(CHECK.scale2, 12) },
            { k: '| Δ scale |', v: CHECK.scaleDiff === 0 ? '0' : CHECK.scaleDiff.toExponential(2) },
            { k: 'max | q₂ − q |', v: String(CHECK.codeDiff), hi: true },
            { k: 'max | W″ − W′ |', v: CHECK.deqDiff === 0 ? '0' : CHECK.deqDiff.toExponential(2), hi: true },
            { k: 'max |E| ≤ s/2 ?', v: n(CHECK.t.stats.maxAbs, 8) + ' ≤ ' + n(CHECK.bound, 8) }
          ]
        }));
        stage.appendChild(UI.checkBadge(CHECK.handDiff === 0,
          'by hand: ' + CHECK.code + ' × ' + n(CHECK.scale, 9) + ' = ' + n(CHECK.byHand, 9) + ', stored W′ = ' + n(CHECK.stored, 9) + ' — difference ' + (CHECK.handDiff === 0 ? 'exactly 0' : CHECK.handDiff.toExponential(2))));
        stage.appendChild(UI.checkBadge(CHECK.codeDiff === 0 && CHECK.deqDiff === 0 && CHECK.scaleDiff === 0,
          'idempotent: quantizing W′ again reproduces all ' + (CFG.rows * CFG.cols) + ' codes (max |Δq| = ' + CHECK.codeDiff + ') and the same scale (Δs = ' + CHECK.scaleDiff + ')'));
        stage.appendChild(UI.checkBadge(CHECK.boundOk,
          'no error exceeds half a grid step: max |E| = ' + n(CHECK.t.stats.maxAbs, 8) + ' vs bound s/2 = ' + n(CHECK.bound, 8)));
      }
    });

    steps.push({
      title: 'How much of the integer range did we actually use?',
      formula: null,
      note: 'This is the question the next tab exists to ask. With a well-behaved block, the codes reach from <code>' + CS_CLEAN.min + '</code> to <code>' + CS_CLEAN.max + '</code> — <strong>' + CS_CLEAN.span + ' of the ' + CS_CLEAN.total + ' available codes</strong>, ' + pctS(CS_CLEAN.pct) + ' of the range, or <strong>' + n(CS_CLEAN.effBits, 2) + ' of the ' + CFG.bits8 + ' bits</strong> genuinely in use. The ' + (CFG.rows * CFG.cols) + ' weights hold ' + Mo.distinctWeights(Mo.W) + ' distinct float values and map to ' + CS_CLEAN.distinct + ' distinct codes, with ' + COL_CLEAN.nGroups + ' collisions: no two different weights were merged. Hold on to those numbers.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Code range occupied', unit: ' codes',
          items: [
            { label: 'available in int8 (symmetric)', value: CS_CLEAN.total, colorVar: 'var(--text-faint)' },
            { label: 'actually spanned by these weights', value: CS_CLEAN.span, colorVar: 'var(--c-practice)' }
          ],
          meaning: pctS(CS_CLEAN.pct) + ' of the grid is in play — about as good as symmetric per-tensor INT8 can do.'
        }));
        stage.appendChild(statsPanel({
          title: 'Code utilisation',
          rows: [
            { k: 'distinct float weights', v: String(Mo.distinctWeights(Mo.W)) + ' of ' + (CFG.rows * CFG.cols) },
            { k: 'distinct integer codes used', v: String(CS_CLEAN.distinct), hi: true },
            { k: 'code range [min, max]', v: '[' + CS_CLEAN.min + ', ' + CS_CLEAN.max + ']' },
            { k: 'codes spanned / available', v: CS_CLEAN.span + ' / ' + CS_CLEAN.total + '  (' + pctS(CS_CLEAN.pct) + ')' },
            { k: 'effective bits used', v: n(CS_CLEAN.effBits, 2) + ' of ' + CFG.bits8 },
            { k: 'weights merged onto a shared value', v: String(COL_CLEAN.nCollidedValues) + '  (nothing collided)' }
          ]
        }));
      }
    });

    steps.push({
      title: 'What the compression bought',
      formula: null,
      note: 'The ' + (CFG.rows * CFG.cols) + ' weights went from ' + MEM.fp32.total + ' bytes to ' + MEM.int8pt.weightBytes + ' bytes of integers plus ' + MEM.int8pt.scaleBytes + ' bytes for the single scale — <strong>' + n(MEM.fp32.total / MEM.int8pt.total, 2) + '× smaller</strong>, for a mean error of ' + n(PT8.stats.meanAbs, 6) + '. On a real 4096×4096 layer the same scheme is <strong>' + n(BIG.fp32, 1) + ' MB → ' + n(BIG.int8pc, 1) + ' MB</strong>. Weight memory is the thing that decides whether a model fits on a card at all, which is why this trade is usually worth making — see page <a href="./topics/23-efficient-ai-systems.html">23</a>.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'This ' + CFG.rows + '×' + CFG.cols + ' block', unit: ' bytes',
          items: [
            { label: 'fp32 weights', value: MEM.fp32.total, colorVar: 'var(--know-cold)' },
            { label: 'int8 + 1 scale', value: MEM.int8pt.total, colorVar: 'var(--c-efficient)' }
          ],
          meaning: MEM.int8pt.weightBytes + ' bytes of codes + ' + MEM.int8pt.scaleBytes + ' bytes of scale.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'A 4096×4096 layer', unit: ' MB',
          items: [
            { label: 'fp32', value: M.round(BIG.fp32, 2), colorVar: 'var(--know-cold)' },
            { label: 'int8, per-channel', value: M.round(BIG.int8pc, 2), colorVar: 'var(--c-efficient)' },
            { label: 'int4, per-channel', value: M.round(BIG.int4pc, 2), colorVar: 'var(--c-frontier)' }
          ],
          meaning: 'Scale overhead is included in both integer bars and is invisible at this size — ' + pctS(SCALE_OVERHEAD_PCT) + ' for int8.'
        }));
      }
    });

    return steps;
  }

  // ============================================================ TAB 2 · THE OUTLIER PROBLEM ============================================================
  function buildOutlier() {
    var steps = [];

    steps.push({
      title: 'Change exactly one weight',
      formula: 'W_{' + CFG.outlierRow + ',' + CFG.outlierCol + '} \\leftarrow ' + n(CFG.outlierVal, 1),
      note: 'Same block as the previous tab, with a single value replaced: <code>' + cellName(CFG.outlierRow, CFG.outlierCol) + '</code> is now <strong>' + n(CFG.outlierVal, 2) + '</strong>, which is <strong>' + n(OUTLIER_RATIO, 2) + '× the largest weight anywhere else</strong>. Nothing else moved. This is not a contrived case: large-magnitude outliers in a handful of channels are a measured, reproducible property of transformer weights and especially activations — they are why <em>LLM.int8()</em>, <em>SmoothQuant</em> and <em>AWQ</em> exist at all.',
      render: function (stage) {
        stage.appendChild(wPanel(Mo.Wout, {
          title: 'W with one outlier', maxAbs: CFG.outlierVal, fresh: true,
          badge: 'colour ramp saturates at ±' + n(CFG.outlierVal, 2) + ' — the outlier owns it',
          meaning: 'The ' + (CFG.rows * CFG.cols - 1) + ' ordinary weights have not changed by a thousandth. They just went pale, because one cell now defines the top of the colour scale — which is a preview of what it is about to do to the code range.'
        }));
      }
    });

    steps.push({
      title: 'One number sets the scale, and it is the wrong number',
      formula: 's_{\\text{out}} = \\frac{' + n(CFG.outlierVal, 2) + '}{' + OUT8.qMax + '} = ' + n(OUT8.scale, 6) + ' \\qquad (' + n(SCALE_RATIO, 2) + '\\times\\ \\text{the old } s)',
      note: 'The scale is <span>$\\max|W| / ' + OUT8.qMax + '$</span> and nothing else — so replacing one weight multiplied the grid step by <strong>' + n(SCALE_RATIO, 3) + '</strong>. Every rung of the ladder is now ' + n(SCALE_RATIO, 2) + '× further apart, for all ' + (CFG.rows * CFG.cols) + ' weights, because of one of them. The rounding bound moved with it: <span>$s/2$</span> went from ' + n(PT8.bound, 6) + ' to ' + n(OUT8.bound, 6) + '.',
      render: function (stage) {
        stage.appendChild(statsPanel({
          title: 'Scale, before and after', fresh: true,
          headers: ['quantity', 'value'],
          rows: [
            { k: 'α without the outlier', v: n(PT8.peak.v, 2) },
            { k: 's without the outlier', v: n(PT8.scale, 9) },
            { k: 'α with the outlier', v: n(OUT8.peak.v, 2) + '  at ' + cellName(OUT8.peak.i, OUT8.peak.j) },
            { k: 's with the outlier', v: n(OUT8.scale, 9), hi: true },
            { k: 'scale blow-up', v: n(SCALE_RATIO, 4) + '×', hi: true },
            { k: 'rounding bound s/2', v: n(PT8.bound, 6) + '  →  ' + n(OUT8.bound, 6) }
          ]
        }));
        stage.appendChild(UI.arrow('↦', 'a much coarser grid'));
        stage.appendChild(ladderPanel(OUT8.scale, CFG.bits8, 'What INT8 can now represent',
          'Same ' + OUT8.nCodes + ' rungs, stretched over a ' + n(SCALE_RATIO, 2) + '× wider interval so that one weight at ' + n(CFG.outlierVal, 2) + ' still fits.'));
      }
    });

    steps.push({
      title: 'Quantize with the new scale',
      formula: 'q = \\mathrm{clip}(\\mathrm{round}(W / s_{\\text{out}}))',
      note: 'Identical machinery to tab 1, one different constant. The result is a grid of very small integers with a single <code>' + OUT8.qMax + '</code> in it. The ordinary weights, which used codes from <code>' + CS_CLEAN.min + '</code> to <code>' + CS_CLEAN.max + '</code> a moment ago, are now squeezed into <code>' + CS_OUT_ORD.min + '</code>…<code>' + CS_OUT_ORD.max + '</code>.',
      render: function (stage) {
        stage.appendChild(codePanel({
          title: 'q — per-tensor codes, with the outlier', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: OUT8.codes, rowLabels: ROWL, colLabels: COLL, maxAbs: OUT8.qMax, fresh: true,
          meaning: 'One cell reaches ' + OUT8.qMax + '. The other ' + (CFG.rows * CFG.cols - 1) + ' are two-digit or smaller. The colour ramp, keyed to ±' + OUT8.qMax + ', tells the story on its own.'
        }));
        stage.appendChild(codePanel({
          title: 'q from tab 1 (no outlier)', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: PT8.codes, rowLabels: ROWL, colLabels: COLL, maxAbs: PT8.qMax, dim: true,
          meaning: 'The same weights, with the scale set by a normal maximum.'
        }));
      }
    });

    steps.push({
      title: 'Count the codes the ordinary weights can still reach',
      formula: '\\text{span} = q_{\\max} - q_{\\min} + 1 = ' + CS_OUT_ORD.span + ' \\ \\text{ of } \\ ' + CS_OUT_ORD.total,
      note: 'Restricting attention to the ' + ORD.length + ' rows that do <em>not</em> contain the outlier: their codes run from <code>' + CS_OUT_ORD.min + '</code> to <code>' + CS_OUT_ORD.max + '</code>, which is <strong>' + CS_OUT_ORD.span + ' of the ' + CS_OUT_ORD.total + ' available codes — ' + pctS(CS_OUT_ORD.pct) + '</strong>. In bit terms those weights are getting <strong>' + n(CS_OUT_ORD.effBits, 2) + ' bits, not ' + CFG.bits8 + '</strong>. You are paying for a byte per weight and receiving the precision of roughly a ' + Math.round(CS_OUT_ORD.effBits) + '-bit one. The other ' + n(CS_OUT_ORD.lostBits, 2) + ' bits were spent on reaching one weight.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Code range reachable by the ' + (ORD.length * CFG.cols) + ' ordinary weights', unit: ' codes',
          items: [
            { label: 'available in int8', value: CS_OUT_ORD.total, colorVar: 'var(--text-faint)' },
            { label: 'tab 1: no outlier', value: CS_CLEAN.span, colorVar: 'var(--c-practice)' },
            { label: 'with the outlier', value: CS_OUT_ORD.span, colorVar: 'var(--know-cold)' }
          ],
          meaning: pctS(CS_CLEAN.pct) + ' of the grid, down to ' + pctS(CS_OUT_ORD.pct) + '. That is the outlier problem in one bar chart.'
        }));
        stage.appendChild(statsPanel({
          title: 'Effective precision', fresh: true,
          rows: [
            { k: 'nominal bits stored', v: String(CFG.bits8) },
            { k: 'code span, ordinary rows', v: CS_OUT_ORD.span + ' / ' + CS_OUT_ORD.total + '  (' + pctS(CS_OUT_ORD.pct) + ')', hi: true },
            { k: 'effective bits, ordinary rows', v: n(CS_OUT_ORD.effBits, 2), hi: true },
            { k: 'bits lost to the outlier', v: n(CS_OUT_ORD.lostBits, 2) },
            { k: 'same figure, tab 1', v: n(CS_CLEAN.effBits, 2) + ' bits (' + pctS(CS_CLEAN.pct) + ' of range)' }
          ]
        }));
      }
    });

    steps.push({
      title: 'Distinct weights that were merged into the same integer',
      formula: null,
      note: 'A coarse grid does not just add noise — it destroys distinctions. The ordinary rows hold <strong>' + Mo.distinctWeights(Mo.Wout, ORD) + ' distinct float values</strong>, and they come out the other side as <strong>' + CS_OUT_ORD.distinct + ' distinct codes</strong>. ' + COL_OUT.nCollidedValues + ' different weights collapsed onto ' + COL_OUT.nGroups + ' shared codes, ' + COL_OUT.merged + ' distinctions gone; after dequantization those weights are, bit for bit, the same number. No later step can tell them apart again.',
      render: function (stage) {
        stage.appendChild(collisionPanel(COL_OUT, 'Collisions among the ordinary rows',
          'Each row is a set of genuinely different weights that the per-tensor grid can no longer tell apart. Tab 1, the same block without the outlier, had ' + COL_CLEAN.nGroups + '.'));
        stage.appendChild(statsPanel({
          title: 'Distinguishability',
          rows: [
            { k: 'ordinary weights', v: String(ORD.length * CFG.cols) },
            { k: 'distinct float values among them', v: String(Mo.distinctWeights(Mo.Wout, ORD)) },
            { k: 'distinct codes they map to', v: String(CS_OUT_ORD.distinct), hi: true },
            { k: 'distinctions destroyed', v: String(COL_OUT.merged), hi: true }
          ]
        }));
      }
    });

    steps.push({
      title: 'Dequantize, and compare the error to tab 1',
      formula: 'W\' = q\\cdot s_{\\text{out}},\\qquad \\overline{|E|}_{\\text{ordinary}} = ' + n(ERR_OUT_ORD.meanAbs, 6) + ' \\ \\ (' + n(ERR_RATIO_OUT, 2) + '\\times\\ \\text{tab 1})',
      note: 'Same ' + (ORD.length * CFG.cols) + ' weights, same bit budget, same code, one different constant — and the mean absolute error on them went from <strong>' + n(ERR_CLEAN_ORD.meanAbs, 6) + '</strong> to <strong>' + n(ERR_OUT_ORD.meanAbs, 6) + '</strong>, a factor of <strong>' + n(ERR_RATIO_OUT, 2) + '</strong>. The worst cell went from ' + n(ERR_CLEAN_ORD.maxAbs, 6) + ' to ' + n(ERR_OUT_ORD.maxAbs, 6) + '. The outlier itself, meanwhile, is represented beautifully: it sits on code ' + OUT8.codes[CFG.outlierRow][CFG.outlierCol] + ' with an error of ' + n(Math.abs(OUT8.err[CFG.outlierRow][CFG.outlierCol]), 8) + '.',
      render: function (stage) {
        stage.appendChild(errPanel(PT8.err, {
          title: 'E, tab 1 (no outlier)', maxAbs: E_OUT, dim: true,
          meaning: 'Drawn on the same ±' + n(E_OUT, 2) + ' ramp as the panel beside it, so the comparison is visual as well as numerical.'
        }));
        stage.appendChild(UI.arrow('→', 'one weight changed'));
        stage.appendChild(errPanel(OUT8.err, {
          title: 'E, with the outlier', maxAbs: E_OUT, fresh: true,
          meaning: 'The outlier cell itself is near-white — it is the one weight this scale represents well. Everything around it got worse.'
        }));
        stage.appendChild(statsPanel({
          title: 'Error on the ' + (ORD.length * CFG.cols) + ' ordinary weights', fresh: true,
          rows: [
            { k: 'mean |E|, tab 1', v: n(ERR_CLEAN_ORD.meanAbs, 8) },
            { k: 'mean |E|, with outlier', v: n(ERR_OUT_ORD.meanAbs, 8), hi: true },
            { k: 'ratio', v: n(ERR_RATIO_OUT, 3) + '×', hi: true },
            { k: 'max |E|, tab 1', v: n(ERR_CLEAN_ORD.maxAbs, 8) },
            { k: 'max |E|, with outlier', v: n(ERR_OUT_ORD.maxAbs, 8) },
            { k: 'error on the outlier cell itself', v: n(Math.abs(OUT8.err[CFG.outlierRow][CFG.outlierCol]), 8) }
          ]
        }));
      }
    });

    steps.push({
      title: 'Each channel has its own natural range',
      formula: '\\alpha_i = \\max_j |W_{ij}|',
      note: 'Look at the per-row maxima. Three of the ' + CFG.rows + ' rows peak below ' + n(Math.max.apply(null, ORD.map(function (r) { return PC8.rowPeak[r]; })), 2) + '; one peaks at ' + n(PC8.rowPeak[CFG.outlierRow], 2) + '. A single tensor-wide scale has to serve all four, so it serves the largest and fails the rest. Nothing about the arithmetic forces one scale per tensor — that is a choice, and the next tab makes the other one.',
      render: function (stage) {
        stage.appendChild(statsPanel({
          title: 'Per-row maximum, and the scale each row would want', fresh: true,
          headers: ['row', 'α_i  →  α_i / ' + OUT8.qMax],
          rows: PC8.rowPeak.map(function (p, i) {
            return { k: ROWL[i] + (i === CFG.outlierRow ? '  (holds the outlier)' : ''), v: n(p, 2) + '  →  ' + n(p / OUT8.qMax, 8), hi: i === CFG.outlierRow };
          }),
          meaning: 'The per-tensor scale in use is ' + n(OUT8.scale, 8) + ' — identical to what row ' + CFG.outlierRow + ' wants, and ' + n(OUT8.scale / PC8.scales[0], 1) + '× what row 0 wants.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'α per row', unit: '',
          items: PC8.rowPeak.map(function (p, i) {
            return { label: ROWL[i], value: M.round(p, 2), colorVar: i === CFG.outlierRow ? 'var(--know-cold)' : 'var(--c-efficient)' };
          }),
          meaning: 'One of these bars is deciding the precision of the other three.'
        }));
      }
    });

    steps.push({
      title: 'Why this is the whole field, not a footnote',
      formula: null,
      note: 'A quantization scheme is judged almost entirely on how it handles this. <strong>LLM.int8()</strong> splits the outlier channels out and runs them in fp16. <strong>SmoothQuant</strong> migrates the difficulty from activations into weights with a per-channel rescaling that the next linear layer absorbs. <strong>AWQ</strong> keeps a small fraction of salient channels at higher precision. <strong>GPTQ</strong> does not fix the range at all — it reorders and error-corrects the rounding decisions so that the damage lands where the loss cares least. Every one of them is a response to the ' + n(ERR_RATIO_OUT, 1) + '× on the previous step.',
      render: function (stage) {
        stage.appendChild(UI.textCard('<strong>What the numbers on this tab actually said.</strong> One weight out of ' + (CFG.rows * CFG.cols) + ', worth ' + n(OUTLIER_RATIO, 1) + '× the next largest, cost the other ' + (CFG.rows * CFG.cols - 1) + ' weights ' + n(CS_OUT_ORD.lostBits, 1) + ' of their ' + CFG.bits8 + ' bits, merged ' + COL_OUT.merged + ' distinct values into shared codes, and multiplied their mean error by ' + n(ERR_RATIO_OUT, 1) + '. None of that was asserted — it was measured on this page, on ' + (CFG.rows * CFG.cols) + ' numbers you can read.', 'warn'));
        stage.appendChild(UI.textCard('The cheapest of the fixes needs no calibration data, no search, and no extra precision anywhere: just stop using one scale for the whole tensor. That is the next tab. Background on why these outliers appear at all is on page <a href="./topics/23-efficient-ai-systems.html">23</a>, and the serving-side consequences on page <a href="./topics/31-llm-inference-serving.html">31</a>.', 'note'));
      }
    });

    return steps;
  }

  // ============================================================ TAB 3 · PER-CHANNEL ============================================================
  function buildPerChannel() {
    var steps = [];

    steps.push({
      title: 'One scale per row instead of one per tensor',
      formula: 's_i = \\frac{\\max_j |W_{ij}|}{' + PC8.qMax + '}',
      note: 'Exactly the same matrix as tab 2 — outlier included — and exactly the same arithmetic. The only change is the <em>scope</em> of the maximum: each output channel derives its scale from its own row. Row ' + CFG.outlierRow + ' still sees the outlier and still gets a coarse scale. The other ' + ORD.length + ' rows never have to know it exists.',
      render: function (stage) {
        stage.appendChild(wPanel(Mo.Wout, { title: 'W (unchanged from tab 2)', maxAbs: CFG.outlierVal, dim: true }));
        stage.appendChild(UI.arrow('↦', 'row-wise max'));
        stage.appendChild(statsPanel({
          title: 'The ' + CFG.rows + ' scales', shapeLabel: CFG.rows + '×1', fresh: true,
          headers: ['row', 'α_i / ' + PC8.qMax],
          rows: PC8.scales.map(function (s, i) {
            return { k: ROWL[i] + '   α=' + n(PC8.rowPeak[i], 2), v: n(s, 9), hi: i === CFG.outlierRow };
          }),
          meaning: 'Per-tensor used ' + n(OUT8.scale, 8) + ' for every row. Three rows now get a scale ' + n(OUT8.scale / PC8.scales[0], 1) + '–' + n(OUT8.scale / PC8.scales[3], 1) + '× finer; row ' + CFG.outlierRow + ' gets the same one it had.'
        }));
      }
    });

    steps.push({
      title: 'Quantize each row against its own scale',
      formula: 'q_{ij} = \\mathrm{clip}\\big(\\mathrm{round}(W_{ij}/s_i)\\big)',
      note: 'The division is now row-dependent. Watch what happens to the rows that do not contain the outlier: each one now has a cell at <code>±' + PC8.qMax + '</code>, because by construction every row\'s own maximum maps to the top of the grid. That is the definition of using the range.',
      render: function (stage) {
        stage.appendChild(codePanel({
          title: 'q — per-tensor (tab 2)', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: OUT8.codes, rowLabels: ROWL, colLabels: COLL, maxAbs: OUT8.qMax, dim: true,
          meaning: 'Ordinary rows span ' + CS_OUT_ORD.min + '…' + CS_OUT_ORD.max + '.'
        }));
        stage.appendChild(UI.arrow('→', 'one scale per row'));
        stage.appendChild(codePanel({
          title: 'q — per-channel', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: PC8.codes, rowLabels: ROWL, colLabels: COLL, maxAbs: PC8.qMax, fresh: true,
          meaning: 'Ordinary rows now span ' + CS_PC_ORD.min + '…' + CS_PC_ORD.max + '. Row ' + CFG.outlierRow + ' is byte-for-byte identical to the panel on the left — its scale did not change.'
        }));
      }
    });

    steps.push({
      title: 'Code utilisation, before and after, on the same weights',
      formula: '\\text{span}: ' + CS_OUT_ORD.span + ' \\rightarrow ' + CS_PC_ORD.span + ' \\ \\text{ of } \\ ' + CS_PC_ORD.total,
      note: 'The ordinary weights went from spanning <strong>' + CS_OUT_ORD.span + ' codes (' + pctS(CS_OUT_ORD.pct) + ')</strong> to <strong>' + CS_PC_ORD.span + ' codes (' + pctS(CS_PC_ORD.pct) + ')</strong> — from <strong>' + n(CS_OUT_ORD.effBits, 2) + ' effective bits to ' + n(CS_PC_ORD.effBits, 2) + '</strong>, out of ' + CFG.bits8 + ' paid for. The stored bytes did not change. The only thing that changed is which number the divisor came from.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Codes spanned by the ordinary weights', unit: ' of ' + CS_PC_ORD.total,
          items: [
            { label: 'per-tensor, with outlier', value: CS_OUT_ORD.span, colorVar: 'var(--know-cold)' },
            { label: 'per-channel, same matrix', value: CS_PC_ORD.span, colorVar: 'var(--c-practice)' }
          ],
          meaning: pctS(CS_OUT_ORD.pct) + ' → ' + pctS(CS_PC_ORD.pct) + ' of the integer range, for free.'
        }));
        stage.appendChild(statsPanel({
          title: 'Utilisation and distinguishability', fresh: true,
          headers: ['quantity', 'per-tensor  →  per-channel'],
          rows: [
            { k: 'code span (ordinary rows)', v: CS_OUT_ORD.span + '  →  ' + CS_PC_ORD.span, hi: true },
            { k: 'percent of range', v: pctS(CS_OUT_ORD.pct) + '  →  ' + pctS(CS_PC_ORD.pct) },
            { k: 'effective bits', v: n(CS_OUT_ORD.effBits, 2) + '  →  ' + n(CS_PC_ORD.effBits, 2), hi: true },
            { k: 'distinct codes used', v: CS_OUT_ORD.distinct + '  →  ' + CS_PC_ORD.distinct },
            { k: 'groups landing on one value', v: COL_OUT.nGroups + '  →  ' + COL_PC.nGroups },
            { k: 'distinctions destroyed', v: COL_OUT.merged + '  →  ' + COL_PC.merged, hi: true }
          ]
        }));
      }
    });

    steps.push({
      title: 'Dequantize: W′ = q_i · s_i',
      formula: 'W\'_{ij} = q_{ij}\\cdot s_i',
      note: 'The multiply back is row-dependent too — in a real kernel the ' + CFG.rows + ' scales sit in a small vector that gets broadcast down the output axis, which is precisely why <em>per-channel along the output dimension</em> is the axis everyone picks: it is the axis the matmul accumulates into, so the scale factors out of the inner loop entirely.',
      render: function (stage) {
        stage.appendChild(codePanel({
          title: 'q', shapeLabel: CFG.rows + '×' + CFG.cols, matrix: PC8.codes, maxAbs: PC8.qMax, dim: true
        }));
        stage.appendChild(UI.arrow('×', '× s_i (row-wise)'));
        stage.appendChild(wPanel(PC8.deq, {
          title: 'W′ — per-channel dequantized', maxAbs: CFG.outlierVal, fresh: true,
          meaning: 'Each row is now a multiple of a different step size. Every row can still reach ' + PC8.nCodes + ' distinct values — but now they are ' + PC8.nCodes + ' values chosen to fit that row.'
        }));
      }
    });

    steps.push({
      title: 'The error, on the same matrix, on the same colour ramp',
      formula: '\\overline{|E|}_{\\text{ordinary}}:\\ ' + n(ERR_OUT_ORD.meanAbs, 6) + ' \\rightarrow ' + n(ERR_PC_ORD.meanAbs, 6) + ' \\quad (' + n(ERR_RATIO_FIX, 2) + '\\times\\ \\text{better})',
      note: 'Both grids below are drawn with the ramp saturating at ±' + n(E_OUT, 2) + ', so the colours are directly comparable. On the ' + (ORD.length * CFG.cols) + ' ordinary weights, mean absolute error drops <strong>' + n(ERR_RATIO_FIX, 2) + '×</strong> — from ' + n(ERR_OUT_ORD.meanAbs, 6) + ' to ' + n(ERR_PC_ORD.meanAbs, 6) + ' — and the worst cell drops from ' + n(ERR_OUT_ORD.maxAbs, 6) + ' to ' + n(ERR_PC_ORD.maxAbs, 6) + '. That factor is not the ' + n(SCALE_RATIO, 2) + '× tensor-wide scale ratio, and it should not be: each ordinary row got its own finer scale, by ' + ORD.map(function (r) { return n(OUT8.scale / PC8.scales[r], 1) + '×'; }).join(', ') + ' respectively. Error tracks step size, so the improvement tracks those, not one global number.',
      render: function (stage) {
        stage.appendChild(errPanel(OUT8.err, {
          title: 'E — per-tensor', maxAbs: E_OUT, dim: true,
          meaning: 'Tab 2\'s result, unchanged.'
        }));
        stage.appendChild(UI.arrow('→', 'per-channel'));
        stage.appendChild(errPanel(PC8.err, {
          title: 'E — per-channel', maxAbs: E_OUT, fresh: true,
          meaning: 'Three rows have gone nearly white. Row ' + CFG.outlierRow + ' is unchanged — look carefully and it is the same row of numbers as the panel on the left.'
        }));
        stage.appendChild(statsPanel({
          title: 'Error, same weights, two schemes', fresh: true,
          headers: ['group', 'per-tensor  →  per-channel'],
          rows: [
            { k: 'mean |E|, ordinary rows', v: n(ERR_OUT_ORD.meanAbs, 8) + '  →  ' + n(ERR_PC_ORD.meanAbs, 8), hi: true },
            { k: 'max |E|, ordinary rows', v: n(ERR_OUT_ORD.maxAbs, 8) + '  →  ' + n(ERR_PC_ORD.maxAbs, 8) },
            { k: 'improvement factor (mean)', v: n(ERR_RATIO_FIX, 3) + '×', hi: true },
            { k: 'mean |E|, outlier row ' + CFG.outlierRow, v: n(ERR_OUT_ROW.meanAbs, 8) + '  →  ' + n(ERR_PC_ROW.meanAbs, 8) },
            { k: 'mean |E|, whole block', v: n(OUT8.stats.meanAbs, 8) + '  →  ' + n(PC8.stats.meanAbs, 8) }
          ]
        }));
      }
    });

    steps.push({
      title: 'Per-channel quarantines the outlier — it does not remove it',
      formula: 's_{' + CFG.outlierRow + '} = \\frac{' + n(CFG.outlierVal, 2) + '}{' + PC8.qMax + '} = s_{\\text{out}}',
      note: 'Be precise about what was fixed. Row ' + CFG.outlierRow + ' contains the outlier, so its own maximum <em>is</em> the outlier, so its per-channel scale is <strong>numerically identical</strong> to the per-tensor scale — and its error is unchanged, to the last bit. Per-channel did not make that channel better; it stopped the other ' + ORD.length + ' from paying for it. Getting row ' + CFG.outlierRow + ' itself under control needs a different kind of idea: keep the outlier in fp16 (LLM.int8), move it into the activations (SmoothQuant), or subdivide the row further (group-wise scales, the last tab).',
      render: function (stage) {
        stage.appendChild(statsPanel({
          title: 'Row ' + CFG.outlierRow + ' under both schemes', fresh: true,
          rows: [
            { k: 'per-tensor scale', v: n(OUT8.scale, 12) },
            { k: 'per-channel scale for row ' + CFG.outlierRow, v: n(PC8.scales[CFG.outlierRow], 12), hi: true },
            { k: '| difference |', v: Math.abs(PC8.scales[CFG.outlierRow] - OUT8.scale) === 0 ? '0 (bit-identical)' : Math.abs(PC8.scales[CFG.outlierRow] - OUT8.scale).toExponential(2) },
            { k: 'max |Δ codes| on that row', v: String(M.maxAbsDiff([PC8.codes[CFG.outlierRow]], [OUT8.codes[CFG.outlierRow]])) },
            { k: 'mean |E| on that row', v: n(ERR_PC_ROW.meanAbs, 8) + '  (per-tensor: ' + n(ERR_OUT_ROW.meanAbs, 8) + ')' }
          ]
        }));
        stage.appendChild(UI.checkBadge(
          PC8.scales[CFG.outlierRow] === OUT8.scale && M.maxAbsDiff([PC8.codes[CFG.outlierRow]], [OUT8.codes[CFG.outlierRow]]) === 0,
          'row ' + CFG.outlierRow + ' is untouched by the fix: same scale, same ' + CFG.cols + ' codes, same error — the benefit went entirely to the other ' + ORD.length + ' rows'));
      }
    });

    steps.push({
      title: 'Self-check: still exactly code × scale, row by row',
      formula: '\\max_{i,j}\\big|W\'_{ij} - q_{ij}s_i\\big| \\stackrel{?}{=} 0',
      note: 'The same three proofs as tab 1, now with a scale that varies down the rows. <strong>(1)</strong> Recompute every cell as <span>$q_{ij}\\cdot s_i$</span> and take the largest disagreement with the stored <code>W′</code>. <strong>(2)</strong> Re-quantize <code>W′</code> row by row and check the codes come back identical. <strong>(3)</strong> Check every row against its own half-step bound <span>$s_i/2$</span>, which now differs per row.',
      render: function (stage) {
        var recomputed = Mo.mapMat(PC8.codes, function (v, i) { return v * PC8.scales[i]; });
        var handDiff = M.maxAbsDiff(recomputed, PC8.deq);
        var codes2 = Mo.mapMat(PC8.deq, function (v, i) { return Mo.clampCode(Math.round(v / PC8.scales[i]), CFG.bits8); });
        var codeDiff = M.maxAbsDiff(codes2, PC8.codes);
        var rowsOk = PC8.err.map(function (row, i) {
          var mx = Math.max.apply(null, row.map(Math.abs));
          return { i: i, max: mx, bound: PC8.bounds[i], ok: mx <= PC8.bounds[i] + 1e-12 };
        });
        var allBounds = rowsOk.every(function (r) { return r.ok; });
        var i0 = CFG.outlierRow === 0 ? 1 : 0, j0 = CFG.cols - 1;

        stage.appendChild(statsPanel({
          title: 'Cell ' + cellName(i0, j0) + ', recomputed by hand', fresh: true,
          rows: [
            { k: 'q', v: String(PC8.codes[i0][j0]) },
            { k: 's_' + i0, v: n(PC8.scales[i0], 12) },
            { k: 'q × s_' + i0 + ', by hand', v: n(PC8.codes[i0][j0] * PC8.scales[i0], 12), hi: true },
            { k: 'W′ as stored', v: n(PC8.deq[i0][j0], 12), hi: true },
            { k: 'W (original)', v: n(Mo.Wout[i0][j0], 2) }
          ]
        }));
        stage.appendChild(statsPanel({
          title: 'Per-row half-step bound', fresh: true,
          headers: ['row', 'max |E|  ≤  s_i / 2'],
          rows: rowsOk.map(function (r) {
            return { k: ROWL[r.i], v: n(r.max, 8) + '  ≤  ' + n(r.bound, 8) + (r.ok ? '  ✓' : '  ✕'), hi: !r.ok };
          })
        }));
        stage.appendChild(UI.checkBadge(handDiff === 0,
          'every cell of W′ equals its own q × s_i exactly — max disagreement over all ' + (CFG.rows * CFG.cols) + ' cells = ' + (handDiff === 0 ? '0' : handDiff.toExponential(2))));
        stage.appendChild(UI.checkBadge(codeDiff === 0,
          'idempotent per row: re-quantizing W′ reproduces every code (max |Δq| = ' + codeDiff + ')'));
        stage.appendChild(UI.checkBadge(allBounds,
          'every row obeys its own bound: the tightest margin is row ' + rowsOk.reduce(function (a, b) { return (b.bound - b.max) < (a.bound - a.max) ? b : a; }).i + ', at ' + n(rowsOk.reduce(function (a, b) { return (b.bound - b.max) < (a.bound - a.max) ? b : a; }).max, 8) + ' against a bound of ' + n(rowsOk.reduce(function (a, b) { return (b.bound - b.max) < (a.bound - a.max) ? b : a; }).bound, 8)));
      }
    });

    steps.push({
      title: 'What the extra scales cost',
      formula: null,
      note: 'Per-channel stores ' + MEM.int8pc.nScales + ' floats instead of ' + MEM.int8pt.nScales + ' — on this toy block that is ' + MEM.int8pt.total + ' bytes → ' + MEM.int8pc.total + ' bytes, which sounds bad only because the block is ' + CFG.cols + ' wide. On a 4096×4096 layer the scale vector is ' + n(BIGMEM8.scaleBytes / 1024, 0) + ' KB against ' + n(BIG.int8pc, 1) + ' MB of codes: <strong>' + pctS(SCALE_OVERHEAD_PCT) + ' overhead for a ' + n(ERR_RATIO_FIX, 1) + '× error reduction</strong>. That ratio is why per-channel weight quantization is simply the default now, not an optimization you reach for.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'This ' + CFG.rows + '×' + CFG.cols + ' block', unit: ' bytes',
          items: [
            { label: 'fp32', value: MEM.fp32.total, colorVar: 'var(--know-cold)' },
            { label: 'int8, 1 scale', value: MEM.int8pt.total, colorVar: 'var(--c-efficient)' },
            { label: 'int8, ' + CFG.rows + ' scales', value: MEM.int8pc.total, colorVar: 'var(--accent)' }
          ],
          meaning: 'The scale vector is ' + MEM.int8pc.scaleBytes + ' bytes here because there are only ' + CFG.cols + ' weights per row. Widen the row and it vanishes.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Cost per weight, at 4096 wide', unit: ' bits/weight',
          items: [
            { label: 'int8 codes', value: 8, colorVar: 'var(--c-efficient)' },
            { label: 'per-channel scale share', value: M.round(32 / CFG.bigLayer, 4), colorVar: 'var(--accent)' }
          ],
          meaning: 'One fp32 scale amortized over ' + CFG.bigLayer + ' weights is ' + n(32 / CFG.bigLayer, 4) + ' bits each.'
        }));
      }
    });

    return steps;
  }

  // ============================================================ TAB 4 · INT4 ============================================================
  function buildInt4() {
    var steps = [];
    var q4 = Mo.qMax(CFG.bits4);

    steps.push({
      title: 'Four bits: fifteen usable codes',
      formula: '2^{b-1}-1 = ' + q4 + ',\\qquad \\text{codes} = ' + Mo.nCodes(CFG.bits4),
      note: 'Nothing about the procedure changes at 4 bits — find the max, divide, round, clamp, multiply back. Only the size of the integer grid changes: from <strong>' + Mo.nCodes(CFG.bits8) + ' codes to ' + Mo.nCodes(CFG.bits4) + '</strong>. Each weight now costs half a byte, and two weights get packed into one byte in practice. This tab uses the <em>clean</em> block from tab 1 and per-channel scales throughout, so the only variable between the comparisons below is the bit width.',
      render: function (stage) {
        stage.appendChild(statsPanel({
          title: 'INT8 against INT4', fresh: true,
          headers: ['quantity', 'int8  →  int4'],
          rows: [
            { k: 'bits per weight', v: CFG.bits8 + '  →  ' + CFG.bits4 },
            { k: 'usable codes (symmetric)', v: Mo.nCodes(CFG.bits8) + '  →  ' + Mo.nCodes(CFG.bits4), hi: true },
            { k: 'q_max', v: Mo.qMax(CFG.bits8) + '  →  ' + q4 },
            { k: 'grid step, relative', v: '1×  →  ' + n(STEP_RATIO_4, 2) + '×', hi: true },
            { k: 'bytes for this block', v: MEM.int8pc.weightBytes + '  →  ' + MEM.int4pc.weightBytes }
          ],
          meaning: 'Dropping 4 bits multiplies the step size by ' + Mo.qMax(CFG.bits8) + '/' + q4 + ' = ' + n(STEP_RATIO_4, 3) + ', so the predicted error increase is the same factor.'
        }));
        stage.appendChild(UI.arrow('↦', 'a much sparser ladder'));
        stage.appendChild(ladderPanel(PC4.scales[0], CFG.bits4, 'Every value row 0 can represent',
          'Not a sample this time — these are all ' + Mo.nCodes(CFG.bits4) + ' rungs available to row 0, spaced ' + n(PC4.scales[0], 4) + ' apart. Every weight in that row has to become one of them.'));
      }
    });

    steps.push({
      title: 'Same machinery, one constant changed',
      formula: 's_i = \\frac{\\max_j|W_{ij}|}{' + q4 + '}',
      note: 'The per-channel scales are the same row maxima as before, divided by ' + q4 + ' instead of ' + Mo.qMax(CFG.bits8) + '. Every step is therefore ' + n(STEP_RATIO_4, 2) + '× wider.',
      render: function (stage) {
        stage.appendChild(statsPanel({
          title: 'Scales, int8 against int4', fresh: true,
          headers: ['row', 'α_i / 127  →  α_i / ' + q4],
          rows: PC4.scales.map(function (s, i) {
            return { k: ROWL[i] + '   α=' + n(PC4.rowPeak[i], 2), v: n(PC8C.scales[i], 6) + '  →  ' + n(s, 6) };
          }),
          meaning: 'Row maxima are unchanged — this is the same clean block as tab 1. Only the divisor moved.'
        }));
      }
    });

    steps.push({
      title: 'Quantize to 4 bits',
      formula: 'q_{ij} = \\mathrm{clip}\\big(\\mathrm{round}(W_{ij}/s_i),\\, -' + q4 + ',\\, ' + q4 + '\\big)',
      note: 'Every one of the ' + (CFG.rows * CFG.cols) + ' weights is now a single digit. The codes span <code>' + CS_INT4.min + '</code>…<code>' + CS_INT4.max + '</code>, the full ' + CS_INT4.total + ' — utilisation is perfect, and that is exactly the point: <em>the range is not the problem at 4 bits, the resolution is</em>.',
      render: function (stage) {
        stage.appendChild(codePanel({
          title: 'q — int8, per-channel', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: PC8C.codes, rowLabels: ROWL, colLabels: COLL, maxAbs: Mo.qMax(CFG.bits8), dim: true
        }));
        stage.appendChild(UI.arrow('→', '4 bits'));
        stage.appendChild(codePanel({
          title: 'q — int4, per-channel', shapeLabel: CFG.rows + '×' + CFG.cols,
          matrix: PC4.codes, rowLabels: ROWL, colLabels: COLL, maxAbs: q4, fresh: true,
          meaning: 'Spans ' + CS_INT4.span + ' of ' + CS_INT4.total + ' codes (' + pctS(CS_INT4.pct) + '), using ' + n(CS_INT4.effBits, 2) + ' of ' + CFG.bits4 + ' bits. The range is fully used — there is simply not much range.'
        }));
      }
    });

    steps.push({
      title: 'Where it starts to hurt: weights merging',
      formula: null,
      note: 'At 8 bits, with these same per-channel scales, no two different weights in the block landed on the same number: <strong>' + COL_8C.nGroups + ' collisions</strong> across all ' + (CFG.rows * CFG.cols) + ' cells. At 4 bits, <strong>' + COL_4.nGroups + ' groups</strong> form — ' + COL_4.nCollidedValues + ' weights that were genuinely different become ' + COL_4.nGroups + ' numbers, destroying <strong>' + COL_4.merged + ' distinctions</strong>. The largest group below is ' + COL_4.biggest + ' different weights that are now one value. That is qualitatively different from adding noise: it is a loss of identity, and nothing downstream can undo it.',
      render: function (stage) {
        stage.appendChild(collisionPanel(COL_4, 'Weights that became the same number at 4 bits',
          'Grouped by the value they all dequantize to rather than by the integer code — with one scale per row, the same code in two rows is two different floats. The last column is the spread of true weights now represented by a single number.'));
        stage.appendChild(statsPanel({
          title: 'Distinguishability, 8 bits → 4 bits', fresh: true,
          headers: ['quantity', 'int8  →  int4'],
          rows: [
            { k: 'cells in the block', v: String(CFG.rows * CFG.cols) + ', holding ' + Mo.distinctWeights(Mo.W) + ' distinct values' },
            { k: 'codes spanned, per row', v: CS_PC8C.span + '  →  ' + CS_INT4.span + '  (of ' + CS_PC8C.total + '  →  ' + CS_INT4.total + ')' },
            { k: 'groups landing on one value', v: COL_8C.nGroups + '  →  ' + COL_4.nGroups, hi: true },
            { k: 'weights inside those groups', v: COL_8C.nCollidedValues + '  →  ' + COL_4.nCollidedValues },
            { k: 'distinctions destroyed', v: COL_8C.merged + '  →  ' + COL_4.merged, hi: true }
          ]
        }));
      }
    });

    steps.push({
      title: 'The error, 8 bits against 4, on the same weights',
      formula: '\\overline{|E|}:\\ ' + n(PC8C.stats.meanAbs, 6) + ' \\rightarrow ' + n(PC4.stats.meanAbs, 6) + ' \\quad (' + n(ERR_RATIO_4, 1) + '\\times)',
      note: 'Mean absolute error goes from <strong>' + n(PC8C.stats.meanAbs, 6) + ' to ' + n(PC4.stats.meanAbs, 6) + '</strong>, a factor of <strong>' + n(ERR_RATIO_4, 2) + '</strong>. The guaranteed part is the bound: every row\'s half-step widens by exactly ' + Mo.qMax(CFG.bits8) + '/' + q4 + ' = ' + n(STEP_RATIO_4, 3) + '×, no more and no less. The <em>mean</em> is not guaranteed to move by that factor — over only ' + (CFG.rows * CFG.cols) + ' weights it depends on where each fraction happened to fall, and here it came out a little higher. The worst cell is now off by ' + n(PC4.stats.maxAbs, 5) + ', which is ' + pctS(PC4.stats.maxAbs / PT8.peak.v * 100) + ' of the largest weight in the block. The ramp below saturates at ±' + n(E_INT4, 2) + ' — note that this is ' + n(E_INT4 / E_CLEAN, 0) + '× the ramp used on tab 1, or the int8 panel would be a blank white grid.',
      render: function (stage) {
        stage.appendChild(errPanel(PC8C.err, {
          title: 'E — int8, per-channel', maxAbs: E_INT4, dim: true,
          meaning: 'Practically invisible at this scale: max ' + n(PC8C.stats.maxAbs, 5) + '.'
        }));
        stage.appendChild(UI.arrow('→', '4 bits'));
        stage.appendChild(errPanel(PC4.err, {
          title: 'E — int4, per-channel', maxAbs: E_INT4, fresh: true,
          meaning: 'The same non-uniformity as everywhere else on this page — a few cells land almost exactly, several sit near the half-step bound.'
        }));
        stage.appendChild(statsPanel({
          title: 'Error, same block, two bit widths', fresh: true,
          headers: ['quantity', 'int8  →  int4'],
          rows: [
            { k: 'mean |E|', v: n(PC8C.stats.meanAbs, 8) + '  →  ' + n(PC4.stats.meanAbs, 8), hi: true },
            { k: 'max |E|', v: n(PC8C.stats.maxAbs, 8) + '  →  ' + n(PC4.stats.maxAbs, 8) },
            { k: 'measured ratio (mean)', v: n(ERR_RATIO_4, 3) + '×', hi: true },
            { k: 'bound ratio (exact, guaranteed)', v: n(STEP_RATIO_4, 3) + '×' },
            { k: 'measured ratio (max)', v: n(PC4.stats.maxAbs / PC8C.stats.maxAbs, 3) + '×' },
            { k: 'max |E| as % of α', v: pctS(PC8C.stats.maxAbs / PT8.peak.v * 100) + '  →  ' + pctS(PC4.stats.maxAbs / PT8.peak.v * 100) }
          ]
        }));
      }
    });

    steps.push({
      title: 'Self-check at 4 bits',
      formula: '\\max_{i,j}\\big|W\'_{ij} - q_{ij}s_i\\big| \\stackrel{?}{=} 0',
      note: 'Nothing about the identity depends on the bit width: a dequantized weight is its code times its row\'s scale, exactly, at 4 bits as at 8. Verified the same three ways — by hand on one cell, by re-quantizing the whole block, and against the per-row half-step bound.',
      render: function (stage) {
        var recomputed = Mo.mapMat(PC4.codes, function (v, i) { return v * PC4.scales[i]; });
        var handDiff = M.maxAbsDiff(recomputed, PC4.deq);
        var codes2 = Mo.mapMat(PC4.deq, function (v, i) { return Mo.clampCode(Math.round(v / PC4.scales[i]), CFG.bits4); });
        var codeDiff = M.maxAbsDiff(codes2, PC4.codes);
        var worst = Mo.maxAbsCell(PC4.err);
        var boundsOk = PC4.err.every(function (row, i) {
          return Math.max.apply(null, row.map(Math.abs)) <= PC4.bounds[i] + 1e-12;
        });
        stage.appendChild(statsPanel({
          title: 'Worst cell ' + cellName(worst.i, worst.j) + ', by hand', fresh: true,
          rows: [
            { k: 'W (original)', v: n(Mo.W[worst.i][worst.j], 2) },
            { k: 'q', v: String(PC4.codes[worst.i][worst.j]) },
            { k: 's_' + worst.i, v: n(PC4.scales[worst.i], 12) },
            { k: 'q × s, by hand', v: n(PC4.codes[worst.i][worst.j] * PC4.scales[worst.i], 12), hi: true },
            { k: 'W′ as stored', v: n(PC4.deq[worst.i][worst.j], 12), hi: true },
            { k: 'W − W′', v: n(PC4.err[worst.i][worst.j], 10) },
            { k: 'bound s_' + worst.i + '/2', v: n(PC4.bounds[worst.i], 10) }
          ]
        }));
        stage.appendChild(UI.checkBadge(handDiff === 0,
          'W′ = q × s_i exactly at 4 bits too — max disagreement over all ' + (CFG.rows * CFG.cols) + ' cells = ' + (handDiff === 0 ? '0' : handDiff.toExponential(2))));
        stage.appendChild(UI.checkBadge(codeDiff === 0,
          'idempotent: re-quantizing the 4-bit W′ reproduces every code (max |Δq| = ' + codeDiff + ')'));
        stage.appendChild(UI.checkBadge(boundsOk,
          'every row still within its half-step bound — worst is ' + n(PC4.stats.maxAbs, 8) + ' against ' + n(Math.max.apply(null, PC4.bounds), 8)));
      }
    });

    steps.push({
      title: 'What 4 bits actually buys, and the fix that makes it usable',
      formula: null,
      note: 'A 4096×4096 layer goes <strong>' + n(BIG.fp32, 1) + ' MB → ' + n(BIG.int8pc, 1) + ' MB → ' + n(BIG.int4pc, 1) + ' MB</strong>. That last halving is what puts a 70B model on a single consumer card, which is why 4-bit weight-only quantization is the default for local inference (page <a href="./topics/30-running-models-locally.html">30</a>). The ' + n(ERR_RATIO_4, 1) + '× error is real, and the standard mitigation is visible directly in the arithmetic above: <strong>shrink the scope of the scale again</strong>. Per-channel gave one scale to ' + CFG.cols + ' weights here and to 4096 in a real layer; group-wise quantization gives one scale to every 64 or 128 weights instead. Same idea as tab 3, applied one level further down — plus <em>GPTQ</em> and <em>AWQ</em>, which choose <em>which</em> rounding errors to make rather than shrinking them.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'A 4096×4096 layer', unit: ' MB',
          items: [
            { label: 'fp32', value: M.round(BIG.fp32, 2), colorVar: 'var(--know-cold)' },
            { label: 'int8, per-channel', value: M.round(BIG.int8pc, 2), colorVar: 'var(--c-efficient)' },
            { label: 'int4, per-channel', value: M.round(BIG.int4pc, 2), colorVar: 'var(--c-frontier)' }
          ],
          meaning: n(BIG.fp32 / BIG.int4pc, 2) + '× smaller than fp32, ' + n(BIG.int8pc / BIG.int4pc, 2) + '× smaller than int8.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Weights sharing one scale', unit: ' weights',
          items: [
            { label: 'per-tensor (tabs 1–2)', value: CFG.bigLayer * CFG.bigLayer, colorVar: 'var(--know-cold)' },
            { label: 'per-channel (tab 3)', value: CFG.bigLayer, colorVar: 'var(--c-efficient)' },
            { label: 'group-wise, g=128', value: 128, colorVar: 'var(--c-frontier)' }
          ],
          meaning: 'Every advance on this page is the same move: give fewer weights a shared destiny. The scale overhead grows as you go down the list — g=128 at fp16 costs 0.125 bits per weight — and that is the trade.'
        }));
        stage.appendChild(UI.textCard('<strong>The through-line of all four tabs.</strong> Quantization error is not a uniform fog: it is set by one number, the maximum, and it falls unevenly on the weights depending on where their fractions land. A single outlier cost the other ' + (CFG.rows * CFG.cols - 1) + ' weights ' + n(CS_OUT_ORD.lostBits, 1) + ' bits and ' + n(ERR_RATIO_OUT, 1) + '× their error. Narrowing the scope of the maximum — per-tensor → per-channel → per-group — recovers it, and every serious quantization method is either that move or a smarter choice of which errors to make.', 'note'));
      }
    });

    return steps;
  }

  var TABS = [
    { id: 'int8', label: 'INT8, per-tensor', short: 'INT8', color: 'var(--c-efficient)', build: buildInt8 },
    { id: 'outlier', label: 'The outlier problem', short: 'Outlier', color: 'var(--know-cold)', build: buildOutlier },
    { id: 'perchannel', label: 'Per-channel scaling', short: 'Per-channel', color: 'var(--c-practice)', build: buildPerChannel },
    { id: 'int4', label: 'INT4', short: 'INT4', color: 'var(--c-gpu)', build: buildInt4 }
  ];

  window.KMLQuantSteps = { PT8: PT8, OUT8: OUT8, PC8: PC8, PC8C: PC8C, PC4: PC4, CHECK: CHECK, TABS: TABS };

  /* The contract the shared controller (lab-app.js) reads. */
  window.KML_LAB = {
    tabs: TABS,
    dims: [
      { sym: 'W', val: CFG.rows + '×' + CFG.cols, def: 'The weight block being quantized: ' + CFG.rows + ' output channels × ' + CFG.cols + ' input dimensions, ' + (CFG.rows * CFG.cols) + ' floats. A real layer is 4096×4096 — every operation on this page is identical at that size, only the grid would not fit on a screen.' },
      { sym: 'b', val: String(CFG.bits8), def: 'Bits per stored weight. 8 on the first three tabs, 4 on the last.' },
      { sym: 'codes', val: String(Mo.nCodes(CFG.bits8)), def: 'How many distinct integers a weight can become. Symmetric quantization uses −(2^(b−1)−1) … +(2^(b−1)−1), which is 255 of the 256 int8 patterns and 15 of the 16 int4 patterns — the most negative pattern is dropped so the grid has an exact zero.' },
      { sym: 's', val: n(PT8.scale, 6), def: 'The scale: the float distance between two neighbouring integer codes, computed as max|W| / (2^(b−1)−1). Every number on this page follows from it. Per-channel and INT4 use one scale per row, so the chip shows the range across rows.' }
    ],
    dimsFor: {
      outlier: [{ sym: 'α', val: n(CFG.outlierVal, 2), def: 'The planted outlier at ' + cellName(CFG.outlierRow, CFG.outlierCol) + ' — ' + n(OUTLIER_RATIO, 2) + '× the largest weight anywhere else in the block, and the single number that sets the scale for all ' + (CFG.rows * CFG.cols) + ' weights.' }],
      perchannel: [{ sym: 'scales', val: String(CFG.rows), def: 'One fp32 scale per output channel instead of one per tensor. Costs ' + (CFG.rows * CFG.fp32Bytes) + ' bytes on this block, ' + pctS(SCALE_OVERHEAD_PCT) + ' of a real layer.' }],
      int4: [{ sym: 'scales', val: String(CFG.rows), def: 'Per-channel again — the last tab changes only the bit width, so that INT8 and INT4 can be compared on one variable.' }]
    },
    /* bits, code count and scale all change from tab to tab, and the scale only
       exists after the step that computes it, so all four are rewritten live. */
    dimFix: function (tabId, stepIndex, list) {
      function chip(sym) { return list.filter(function (d) { return d.sym === sym; })[0]; }
      var b = chip('b'), c = chip('codes'), s = chip('s');
      if (tabId === 'int4') {
        if (b) b.val = String(CFG.bits4);
        if (c) c.val = String(Mo.nCodes(CFG.bits4));
        if (s) s.val = n(Math.min.apply(null, PC4.scales), 4) + ' – ' + n(Math.max.apply(null, PC4.scales), 4);
        return;
      }
      if (b) b.val = String(CFG.bits8);
      if (c) c.val = String(Mo.nCodes(CFG.bits8));
      if (!s) return;
      if (tabId === 'int8') s.val = stepIndex >= 2 ? n(PT8.scale, 6) : 'not chosen yet';
      else if (tabId === 'outlier') s.val = stepIndex >= 1 ? n(OUT8.scale, 6) : n(PT8.scale, 6);
      else s.val = n(Math.min.apply(null, PC8.scales), 6) + ' – ' + n(Math.max.apply(null, PC8.scales), 6);
    }
  };
})();
