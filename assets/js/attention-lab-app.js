/* KnowML — Attention Lab: app controller. Tab switching, step navigation,
   the persistent dimension key, and wiring KaTeX into dynamically-built steps. */
(function () {
  'use strict';
  var UI = window.KMLLabUI, CFG = window.KMLLabModel.CFG, TABS = window.KMLLabSteps.TABS;

  var state = { tabIndex: 0, stepIndex: 0, steps: [] };

  var els = {};
  function q(id) { return document.getElementById(id); }

  var DIM_BASE = [
    { sym: 'B', val: '1', def: 'Batch — how many independent sequences run side by side. Fixed to 1 throughout: batch just stacks an extra, fully independent copy of everything below. Nothing in this page interacts across the batch axis.' },
    { sym: 'T', val: null, def: 'Sequence length — how many tokens exist so far. Starts at 4 (the prefill), grows to 5 once a token is generated.' },
    { sym: 'd_model', val: String(CFG.dModel), def: 'Model / embedding dimension — the width of every token\'s vector. The one number that stays constant through an entire layer.' },
    { sym: 'H', val: String(CFG.H), def: 'Query heads — how many independent attention "subspaces" the model splits d_model into.' },
    { sym: 'd_h', val: String(CFG.dH), def: 'Per-head dimension = d_model / H. Each head\'s Q, K, V rows live in this many dimensions.' }
  ];
  var DIM_EXTRA = {
    gqa: [{ sym: 'G', val: String(CFG.gqaGroups), def: 'GQA groups — how many distinct key/value heads exist. Query heads are split evenly across them.' }],
    mqa: [{ sym: 'G', val: '1', def: 'MQA is GQA with exactly one group — every query head shares the same single key/value head.' }],
    mla: [{ sym: 'd_c', val: String(CFG.dC), def: 'MLA latent dimension — the width of the compressed vector that gets cached, instead of full-width K and V.' }],
    paged: [{ sym: 'blk', val: String(CFG.blockSize), def: 'Block size — how many tokens\' worth of K/V live in one fixed-size physical block.' }],
    flash: [{ sym: 'blk', val: String(CFG.blockSize), def: 'Tile size — how many rows/columns of the score matrix are computed together in one pass through fast memory.' }]
  };

  function renderDimKey() {
    var tab = TABS[state.tabIndex];
    var list = DIM_BASE.map(function (d) { return Object.assign({}, d); });
    if (tab.id === 'kvcache' || tab.id === 'paged') list[1].val = (tab.id === 'paged') ? '5' : (state.stepIndex >= 1 ? '4→5' : '4');
    else list[1].val = '4';
    (DIM_EXTRA[tab.id] || []).forEach(function (d) { list.push(d); });

    var prevDefs = els.dimstrip.querySelector('.lab-dimdefs');
    var defsWereOpen = !!(prevDefs && prevDefs.open);
    els.dimstrip.innerHTML = list.map(function (d) {
      return '<span class="lab-chip" title="' + d.def.replace(/"/g, '&quot;') + '"><span class="lab-chip-sym">' + d.sym + '</span><span class="lab-chip-eq">=</span><span class="lab-chip-val">' + (d.val || '') + '</span></span>';
    }).join('') + '<details class="lab-dimdefs"' + (defsWereOpen ? ' open' : '') + '><summary>What do these mean?</summary><div class="lab-dimdefs-body">' + list.map(function (d) {
      return '<div class="lab-dim-row"><span class="lab-dim-sym">' + d.sym + '</span><span class="lab-dim-val">' + (d.val || '') + '</span><span class="lab-dim-def">' + d.def + '</span></div>';
    }).join('') + '</div></details>';
  }

  function renderTabs() {
    els.tabs.innerHTML = '';
    TABS.forEach(function (tab, i) {
      var btn = UI.el('button', 'lab-tab' + (i === state.tabIndex ? ' active' : ''));
      btn.style.setProperty('--tc', tab.color);
      btn.innerHTML = '<span class="lab-tab-dot"></span>' + tab.short;
      btn.title = tab.label;
      btn.addEventListener('click', function () { switchTab(i); });
      els.tabs.appendChild(btn);
    });
  }

  function switchTab(i, opts) {
    opts = opts || {};
    state.tabIndex = i;
    state.stepIndex = 0;
    state.steps = TABS[i].build();
    renderTabs();
    renderDimKey();
    renderDots();
    renderStep();
    if (!opts.skipHistory) history.replaceState(null, '', '#' + TABS[i].id);
    if (!opts.skipScroll) {
      window.scrollTo({ top: els.shell.getBoundingClientRect().top + window.scrollY - 96, behavior: opts.instant ? 'auto' : 'smooth' });
    }
  }

  function tabIndexFromHash() {
    var id = location.hash.slice(1);
    var i = TABS.findIndex(function (t) { return t.id === id; });
    return i === -1 ? 0 : i;
  }

  function renderDots() {
    els.dots.innerHTML = '';
    state.steps.forEach(function (s, i) {
      var d = UI.el('button', 'lab-dot' + (i === state.stepIndex ? ' active' : i < state.stepIndex ? ' done' : ''));
      d.style.setProperty('--tc', TABS[state.tabIndex].color);
      d.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + s.title);
      d.addEventListener('click', function () { state.stepIndex = i; renderStep(); });
      els.dots.appendChild(d);
    });
  }

  function renderStep() {
    var tab = TABS[state.tabIndex], step = state.steps[state.stepIndex];
    UI.resetLedger();

    els.eyebrow.textContent = 'Step ' + (state.stepIndex + 1) + ' of ' + state.steps.length;
    els.title.textContent = step.title;
    if (step.formula) {
      els.formula.style.display = '';
      els.formula.innerHTML = '';
      if (window.katex) window.katex.render(step.formula, els.formula, { throwOnError: false, displayMode: true });
    } else {
      els.formula.style.display = 'none';
    }
    els.note.innerHTML = step.note || '';

    els.stage.innerHTML = '';
    var inner = UI.el('div', 'lab-stage-inner');
    els.stage.appendChild(inner);
    step.render(inner);

    var ledger = UI.getLedger();
    els.ledger.innerHTML = '<summary>Tensors in this step <span class="lab-ledger-count">' + ledger.length + '</span></summary>' + (ledger.length ? ledger.map(function (l) {
      return '<div class="lab-ledger-row"><span class="lab-ledger-name">' + l.name + '</span><span class="lab-ledger-shape">' + l.shapeLabel + '</span><span class="lab-ledger-meaning">' + (l.meaning || '') + '</span></div>';
    }).join('') : '<div class="lab-ledger-row"><span class="lab-ledger-meaning">No new tensors this step — see the note above.</span></div>');

    renderInlineMath();

    els.prev.disabled = state.stepIndex === 0;
    els.next.disabled = state.stepIndex === state.steps.length - 1;
    renderDots();
    renderDimKey();
  }

  function renderInlineMath() {
    // The dynamic notes/panels use the site's `$...$` convention (see app.js's
    // own renderMath()), but they are inserted long after that one-time pass
    // runs, so each step re-renders its own math the same way.
    if (!window.renderMathInElement) return;
    var opts = { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false };
    renderMathInElement(els.note, opts);
    renderMathInElement(els.stage, opts);
    renderMathInElement(els.ledger, opts);
  }

  function next() { if (state.stepIndex < state.steps.length - 1) { state.stepIndex++; renderStep(); } }
  function prev() { if (state.stepIndex > 0) { state.stepIndex--; renderStep(); } }

  function init() {
    els.shell = q('labShell'); els.tabs = q('labTabs'); els.dimstrip = q('labDimStrip');
    els.eyebrow = q('labEyebrow'); els.title = q('labTitle'); els.formula = q('labFormula'); els.note = q('labNote');
    els.stage = q('labStage'); els.ledger = q('labLedger'); els.dots = q('labDots');
    els.prev = q('labPrev'); els.next = q('labNext');

    els.prev.addEventListener('click', prev);
    els.next.addEventListener('click', next);
    document.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });

    var startIndex = tabIndexFromHash();
    state.tabIndex = startIndex;
    state.steps = TABS[startIndex].build();
    renderTabs();
    renderDimKey();
    renderDots();
    renderStep();
    history.replaceState(null, '', '#' + TABS[startIndex].id);
    if (startIndex !== 0) {
      requestAnimationFrame(function () {
        window.scrollTo({ top: els.shell.getBoundingClientRect().top + window.scrollY - 96, behavior: 'auto' });
      });
    }

    window.addEventListener('popstate', function () {
      var i = tabIndexFromHash();
      if (i !== state.tabIndex) switchTab(i, { skipHistory: true, instant: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
