/* KnowML — shared lab renderer. Turns plain arrays-of-arrays into labelled,
   colour-coded grids, plus the non-matrix visuals a lab tends to need: caches,
   block tables, pools, bar comparisons, check badges. One mounting function per
   visual kind; a lab's step functions compose these and nothing else.

   Used by every lab page. Keep it free of any one lab's vocabulary. */
(function () {
  'use strict';
  var M = window.KMLLabMath;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmt(v, mode) {
    if (v === -Infinity) return '−∞';
    var r = M.round(v, 2);
    if (Object.is(r, -0)) r = 0;
    if (mode === 'prob') return r.toFixed(2);
    return (r > 0 ? '+' : '') + r.toFixed(2);
  }

  // value -> background color. mode: 'diverging' (signed, centered at 0) or 'prob' (0..1)
  function cellColor(v, mode, maxAbs) {
    if (mode === 'prob') {
      var pct = Math.max(0, Math.min(1, v)) * 78;
      return 'color-mix(in srgb, var(--accent) ' + pct.toFixed(0) + '%, var(--bg-card))';
    }
    var m = maxAbs || 2;
    var pct = Math.min(1, Math.abs(v) / m) * 70;
    var hue = v >= 0 ? 'var(--c-attention)' : 'var(--accent-2)';
    return 'color-mix(in srgb, ' + hue + ' ' + pct.toFixed(0) + '%, var(--bg-card))';
  }

  var LEDGER = []; // reset every step: [{name, shapeLabel, meaning}]
  function note(name, shapeLabel, meaning) { LEDGER.push({ name: name, shapeLabel: shapeLabel, meaning: meaning }); }

  // ---------- core matrix grid ----------
  // opts: {title, shapeLabel, matrix, rowLabels, colLabels, mask (bool grid, true=masked),
  //        colorMode:'diverging'|'prob'|'none', maxAbs, dim:boolean, badge:string, meaning:string, fresh:boolean}
  function matrixPanel(opts) {
    var wrap = el('div', 'lab-panel' + (opts.dim ? ' lab-panel--dim' : '') + (opts.fresh ? ' lab-panel--new' : ''));
    var head = el('div', 'lab-panel-head');
    head.appendChild(el('span', 'lab-panel-title', opts.title));
    if (opts.shapeLabel) head.appendChild(el('span', 'lab-panel-shape', opts.shapeLabel));
    wrap.appendChild(head);
    if (opts.badge) wrap.appendChild(el('div', 'lab-panel-badge', opts.badge));

    var grid = el('div', 'lab-grid');
    var m = opts.matrix, rows = m.length, cols = m[0] ? m[0].length : 0;
    grid.style.setProperty('--cols', cols);
    if (opts.colLabels) {
      grid.appendChild(el('div', 'lab-cell lab-cell--corner'));
      opts.colLabels.forEach(function (c) { grid.appendChild(el('div', 'lab-cell lab-cell--head', c)); });
    }
    for (var i = 0; i < rows; i++) {
      if (opts.rowLabels) grid.appendChild(el('div', 'lab-cell lab-cell--head', opts.rowLabels[i]));
      for (var j = 0; j < cols; j++) {
        var v = m[i][j];
        var masked = opts.mask && opts.mask[i][j];
        var cell = el('div', 'lab-cell' + (masked ? ' lab-cell--masked' : ''));
        if (masked) { cell.textContent = '·'; cell.title = 'masked — this position is in the future, softmax gives it zero weight'; }
        else {
          cell.textContent = fmt(v, opts.colorMode);
          cell.style.background = cellColor(v, opts.colorMode || 'diverging', opts.maxAbs);
        }
        grid.appendChild(cell);
      }
    }
    if (opts.colLabels) grid.style.setProperty('--haslabels', 1);
    wrap.appendChild(grid);
    if (opts.meaning) wrap.appendChild(el('div', 'lab-panel-meaning', opts.meaning));
    note(opts.title, opts.shapeLabel || (rows + '×' + cols), opts.meaning || '');
    return wrap;
  }

  // ---------- a titled row of per-head matrix panels ----------
  function headsPanel(opts) {
    // opts: {title, heads:[{title,shapeLabel,matrix,mask,colorMode,maxAbs,meaning,dim,fresh}], groupMeaning}
    var wrap = el('div', 'lab-heads-group');
    wrap.appendChild(el('div', 'lab-heads-group-title', opts.title));
    var row = el('div', 'lab-heads-row');
    opts.heads.forEach(function (h) { row.appendChild(matrixPanel(h)); });
    wrap.appendChild(row);
    if (opts.groupMeaning) wrap.appendChild(el('div', 'lab-panel-meaning', opts.groupMeaning));
    return wrap;
  }

  function arrow(glyph, label) {
    var wrap = el('div', 'lab-arrow');
    wrap.appendChild(el('div', 'lab-arrow-glyph', glyph));
    if (label) wrap.appendChild(el('div', 'lab-arrow-label', label));
    return wrap;
  }

  function textCard(html, kind) {
    return el('div', 'lab-textcard' + (kind ? ' lab-textcard--' + kind : ''), html);
  }

  // ---------- cache panel: a matrix where the last N rows are visually "new" ----------
  function cachePanel(opts) {
    // opts: {title, matrix, newFrom (row index where freshly-appended rows start, or -1), shapeLabel, meaning, colorMode, maxAbs}
    var wrap = matrixPanel({
      title: opts.title, shapeLabel: opts.shapeLabel, matrix: opts.matrix,
      colorMode: opts.colorMode, maxAbs: opts.maxAbs, meaning: opts.meaning
    });
    wrap.classList.add('lab-panel--cache');
    if (opts.newFrom != null && opts.newFrom >= 0) {
      var rows = wrap.querySelectorAll('.lab-grid > .lab-cell:not(.lab-cell--head):not(.lab-cell--corner)');
      var cols = opts.matrix[0].length;
      for (var i = opts.newFrom * cols; i < rows.length; i++) rows[i].classList.add('lab-cell--fresh-row');
    }
    return wrap;
  }

  // ---------- physical block pool + block table (PagedAttention) ----------
  function poolPanel(opts) {
    // opts: {size, allocated: [physicalIds], meaning}
    var wrap = el('div', 'lab-panel');
    wrap.appendChild(el('div', 'lab-panel-head', '<span class="lab-panel-title">Physical block pool</span><span class="lab-panel-shape">' + opts.size + ' blocks total</span>'));
    var row = el('div', 'lab-pool');
    for (var i = 0; i < opts.size; i++) {
      var used = opts.allocated.indexOf(i) !== -1;
      var b = el('div', 'lab-pool-block' + (used ? ' lab-pool-block--used' : ''), '#' + i);
      row.appendChild(b);
    }
    wrap.appendChild(row);
    if (opts.meaning) wrap.appendChild(el('div', 'lab-panel-meaning', opts.meaning));
    note('Physical pool', opts.size + ' blocks', opts.meaning || '');
    return wrap;
  }
  function blockTablePanel(opts) {
    // opts: {rows:[{logical,physical,tokensHeld}], meaning, highlightLogical}
    var wrap = el('div', 'lab-panel');
    wrap.appendChild(el('div', 'lab-panel-head', '<span class="lab-panel-title">Block table (this request)</span><span class="lab-panel-shape">' + opts.rows.length + ' entries</span>'));
    var t = el('table', 'lab-table');
    t.innerHTML = '<thead><tr><th>logical block</th><th>physical block</th><th>tokens held</th></tr></thead>';
    var tb = el('tbody');
    opts.rows.forEach(function (r) {
      var tr = el('tr', r.logical === opts.highlightLogical ? 'lab-row--highlight' : '');
      tr.innerHTML = '<td>' + r.logical + '</td><td>#' + r.physical + '</td><td>' + r.tokensHeld + '</td>';
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    if (opts.meaning) wrap.appendChild(el('div', 'lab-panel-meaning', opts.meaning));
    note('Block table', opts.rows.length + ' rows', opts.meaning || '');
    return wrap;
  }
  function stripPanel(opts) {
    // opts: {title, total, filled, meaning}  — the "naive contiguous reservation" bar
    var wrap = el('div', 'lab-panel');
    wrap.appendChild(el('div', 'lab-panel-head', '<span class="lab-panel-title">' + opts.title + '</span><span class="lab-panel-shape">' + opts.total + ' slots reserved</span>'));
    var row = el('div', 'lab-pool');
    for (var i = 0; i < opts.total; i++) {
      var cls = i < opts.filled ? 'lab-pool-block lab-pool-block--used' : 'lab-pool-block lab-pool-block--wasted';
      row.appendChild(el('div', cls, i < opts.filled ? String(i) : '✕'));
    }
    wrap.appendChild(row);
    if (opts.meaning) wrap.appendChild(el('div', 'lab-panel-meaning', opts.meaning));
    note(opts.title, opts.filled + '/' + opts.total + ' used', opts.meaning || '');
    return wrap;
  }

  // ---------- bar comparison (cache-size callouts) ----------
  function barsPanel(opts) {
    // opts: {title, items:[{label,value,colorVar}], unit, meaning}
    var wrap = el('div', 'lab-panel');
    wrap.appendChild(el('div', 'lab-panel-head', '<span class="lab-panel-title">' + opts.title + '</span>'));
    var maxV = Math.max.apply(null, opts.items.map(function (it) { return it.value; }));
    var box = el('div', 'lab-bars');
    opts.items.forEach(function (it) {
      var row = el('div', 'lab-bar-row');
      row.appendChild(el('div', 'lab-bar-label', it.label));
      var track = el('div', 'lab-bar-track');
      var fill = el('div', 'lab-bar-fill');
      fill.style.width = (it.value / maxV * 100).toFixed(0) + '%';
      fill.style.background = it.colorVar || 'var(--accent)';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'lab-bar-value', it.value + (opts.unit || '')));
      box.appendChild(row);
    });
    wrap.appendChild(box);
    if (opts.meaning) wrap.appendChild(el('div', 'lab-panel-meaning', opts.meaning));
    note(opts.title, '', opts.meaning || '');
    return wrap;
  }

  function checkBadge(ok, text) {
    return el('div', 'lab-checkbadge' + (ok ? ' lab-checkbadge--ok' : ' lab-checkbadge--bad'), (ok ? '✓ ' : '✕ ') + text);
  }

  window.KMLLabUI = {
    el: el, fmt: fmt, cellColor: cellColor,
    resetLedger: function () { LEDGER = []; }, getLedger: function () { return LEDGER; },
    matrixPanel: matrixPanel, headsPanel: headsPanel, arrow: arrow, textCard: textCard,
    cachePanel: cachePanel, poolPanel: poolPanel, blockTablePanel: blockTablePanel, stripPanel: stripPanel,
    barsPanel: barsPanel, checkBadge: checkBadge
  };
})();
