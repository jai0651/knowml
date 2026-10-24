/* KnowML — in-page find (⌘F / Ctrl+F).
   ⌘K is the global search across every page; ⌘F is "find on this page", which
   is what the shortcut means everywhere else.

   Matches are painted with the CSS Custom Highlight API rather than by wrapping
   text in <mark>. That matters here: notes.js anchors user highlights on
   character offsets into the DOM, so injecting and removing wrapper elements
   under it could shift those offsets while the find bar is open. Custom
   highlights never touch the DOM, so the two features cannot interfere. Where
   the API is missing we still scroll to matches, just without the paint. */
(function () {
  'use strict';

  var SUPPORTED = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
  var MAX_MATCHES = 400;

  var bar, input, countEl;
  var ranges = [];
  var cursor = 0;
  var open = false;

  function scope() { return document.getElementById('content'); }

  function buildBar() {
    bar = document.createElement('div');
    bar.className = 'fip-bar';
    bar.innerHTML =
      '<span class="fip-icon">⌕</span>' +
      '<input id="fipInput" type="text" placeholder="Find on this page…" autocomplete="off" spellcheck="false" />' +
      '<span class="fip-count" id="fipCount"></span>' +
      '<button class="fip-btn" id="fipPrev" title="Previous (Shift+Enter)">↑</button>' +
      '<button class="fip-btn" id="fipNext" title="Next (Enter)">↓</button>' +
      '<button class="fip-btn" id="fipClose" title="Close (Esc)">✕</button>';
    document.body.appendChild(bar);
    input = bar.querySelector('#fipInput');
    countEl = bar.querySelector('#fipCount');

    input.addEventListener('input', function () { run(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? step(-1) : step(1); }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    bar.querySelector('#fipNext').addEventListener('click', function () { step(1); });
    bar.querySelector('#fipPrev').addEventListener('click', function () { step(-1); });
    bar.querySelector('#fipClose').addEventListener('click', close);
  }

  /* Every text node under #content that is actually rendered. */
  function textNodes() {
    var root = scope();
    if (!root) return [];
    var out = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('script, style, svg, .fip-bar')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function clearPaint() {
    if (SUPPORTED) { CSS.highlights.delete('kml-find'); CSS.highlights.delete('kml-find-current'); }
  }

  function run(qRaw) {
    var q = (qRaw || '').trim().toLowerCase();
    ranges = []; cursor = 0;
    clearPaint();
    if (q.length < 2) { countEl.textContent = q.length ? '…' : ''; return; }

    textNodes().forEach(function (node) {
      if (ranges.length >= MAX_MATCHES) return;
      var hay = node.nodeValue.toLowerCase();
      var from = 0, at;
      while ((at = hay.indexOf(q, from)) !== -1 && ranges.length < MAX_MATCHES) {
        var r = document.createRange();
        r.setStart(node, at);
        r.setEnd(node, at + q.length);
        ranges.push(r);
        from = at + q.length;
      }
    });

    if (!ranges.length) { countEl.textContent = 'no matches'; return; }
    paint();
    reveal();
  }

  function paint() {
    if (!SUPPORTED) return;
    var others = ranges.filter(function (_, i) { return i !== cursor; });
    /* Highlight takes ranges as separate arguments, so construct it reflectively. */
    if (others.length) CSS.highlights.set('kml-find', Reflect.construct(Highlight, others));
    else CSS.highlights.delete('kml-find');
    if (ranges[cursor]) CSS.highlights.set('kml-find-current', new Highlight(ranges[cursor]));
  }

  function reveal() {
    countEl.textContent = (cursor + 1) + ' of ' + ranges.length + (ranges.length === MAX_MATCHES ? '+' : '');
    var r = ranges[cursor];
    if (!r) return;
    var host = r.startContainer.parentElement;
    /* a match inside a collapsed Q&A or details block is useless unless it opens */
    var d = host && host.closest('details');
    while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); }
    if (host) host.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function step(dir) {
    if (!ranges.length) return;
    cursor = (cursor + dir + ranges.length) % ranges.length;
    paint();
    reveal();
  }

  function openBar() {
    if (!scope()) return false;           /* nothing to search on this page */
    if (!bar) buildBar();
    open = true;
    bar.classList.add('is-open');
    input.select();
    input.focus();
    if (input.value) run(input.value);
    return true;
  }

  function close() {
    open = false;
    if (bar) bar.classList.remove('is-open');
    clearPaint();
    ranges = []; cursor = 0;
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      if (openBar()) e.preventDefault();   /* only swallow it if we handled it */
      return;
    }
    if (e.key === 'Escape' && open) close();
  });

  window.KMLFind = { open: openBar, close: close };
})();
