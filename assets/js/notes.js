/* NeuralPath — personal notes & highlights, persisted in localStorage per page */
(function () {
  'use strict';

  function pageKey() { return 'np-notes::' + location.pathname; }
  function load() {
    try { return JSON.parse(localStorage.getItem(pageKey()) || '{"freeNotes":"","highlights":[]}'); }
    catch (e) { return { freeNotes: '', highlights: [] }; }
  }
  function save(state) { localStorage.setItem(pageKey(), JSON.stringify(state)); }

  var state = load();
  var content;

  function uid() { return 'h' + Math.random().toString(36).slice(2, 10); }

  /* wrap first unwrapped occurrence of text in a text node under .content */
  function wrapText(root, text, color, hid) {
    if (!text || text.length < 2) return false;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.parentElement.closest('mark.hl')) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest('script,style')) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.indexOf(text) > -1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var node = walker.nextNode();
    if (!node) return false;
    var idx = node.nodeValue.indexOf(text);
    var range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + text.length);
    var mark = document.createElement('mark');
    mark.className = 'hl hl-' + color;
    mark.dataset.hid = hid;
    range.surroundContents(mark);
    return true;
  }

  function restoreHighlights() {
    state.highlights.forEach(function (h) { wrapText(content, h.text, h.color, h.id); });
  }

  function renderDrawer() {
    var body = document.getElementById('freeNotes');
    if (body) body.value = state.freeNotes || '';
    var list = document.getElementById('hlList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.highlights.length) {
      list.innerHTML = '<p class="empty-hint">Select any text on the page to highlight it or attach a note. Everything saves automatically, only on this device.</p>';
      return;
    }
    state.highlights.slice().reverse().forEach(function (h) {
      var div = document.createElement('div');
      div.className = 'hl-item';
      div.innerHTML =
        '<div class="hl-quote">"' + h.text + '"</div>' +
        (h.note ? '<div class="hl-note">' + h.note.replace(/</g, '&lt;') + '</div>' : '') +
        '<div class="hl-row"><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--hl-' + h.color + ')"></span><button class="hl-del" data-hid="' + h.id + '">remove</button></div>';
      list.appendChild(div);
    });
    list.querySelectorAll('.hl-del').forEach(function (btn) {
      btn.addEventListener('click', function () { removeHighlight(btn.dataset.hid); });
    });
  }

  function removeHighlight(id) {
    state.highlights = state.highlights.filter(function (h) { return h.id !== id; });
    save(state);
    var mark = content.querySelector('mark[data-hid="' + id + '"]');
    if (mark) {
      var parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    }
    renderDrawer();
  }

  function addHighlight(text, color, note) {
    var h = { id: uid(), text: text, color: color, note: note || '', createdAt: Date.now() };
    state.highlights.push(h);
    save(state);
    wrapText(content, text, color, h.id);
    renderDrawer();
  }

  /* ---------- selection toolbar ---------- */
  function initToolbar() {
    var toolbar = document.getElementById('selectToolbar');
    if (!toolbar) return;
    document.addEventListener('mouseup', function (e) {
      if (toolbar.contains(e.target)) return;
      var sel = window.getSelection();
      var text = sel.toString().trim();
      if (!text || !content.contains(sel.anchorNode) || text.length > 400) {
        toolbar.style.display = 'none';
        return;
      }
      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      toolbar.style.display = 'flex';
      toolbar.style.top = (window.scrollY + rect.top - 42) + 'px';
      toolbar.style.left = Math.max(8, window.scrollX + rect.left + rect.width / 2 - 70) + 'px';
      toolbar.dataset.pendingText = text;
    });
    toolbar.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = toolbar.dataset.pendingText;
        if (text) addHighlight(text, btn.dataset.color, '');
        toolbar.style.display = 'none';
        window.getSelection().removeAllRanges();
      });
    });
    var noteBtn = toolbar.querySelector('[data-note]');
    if (noteBtn) noteBtn.addEventListener('click', function () {
      var text = toolbar.dataset.pendingText;
      if (!text) return;
      var note = prompt('Add a note to this highlight:', '');
      if (note !== null) addHighlight(text, 'yellow', note);
      toolbar.style.display = 'none';
      window.getSelection().removeAllRanges();
      openDrawer();
    });
    document.addEventListener('mousedown', function (e) {
      if (!toolbar.contains(e.target)) toolbar.style.display = 'none';
    });
  }

  /* ---------- drawer open/close + free notes ---------- */
  function openDrawer() { document.getElementById('notesDrawer').classList.add('open'); }
  function closeDrawer() { document.getElementById('notesDrawer').classList.remove('open'); }

  function initDrawer() {
    var toggles = document.querySelectorAll('[data-notes-toggle]');
    toggles.forEach(function (b) { b.addEventListener('click', openDrawer); });
    var closeBtn = document.getElementById('notesClose');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    var freeNotes = document.getElementById('freeNotes');
    if (freeNotes) freeNotes.addEventListener('input', function () {
      state.freeNotes = freeNotes.value;
      save(state);
    });
    var exportBtn = document.getElementById('exportNotes');
    if (exportBtn) exportBtn.addEventListener('click', exportMarkdown);
    var clearBtn = document.getElementById('clearNotes');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (!confirm('Clear all highlights and notes on this page?')) return;
      state = { freeNotes: '', highlights: [] };
      save(state);
      location.reload();
    });
  }

  function exportMarkdown() {
    var title = document.querySelector('h1') ? document.querySelector('h1').textContent : document.title;
    var md = '# ' + title + '\n\n_Exported from NeuralPath — ' + location.href + '_\n\n';
    if (state.freeNotes) md += '## My Notes\n\n' + state.freeNotes + '\n\n';
    if (state.highlights.length) {
      md += '## Highlights\n\n';
      state.highlights.forEach(function (h) {
        md += '> ' + h.text + '\n';
        if (h.note) md += '\n' + h.note + '\n';
        md += '\n';
      });
    }
    var blob = new Blob([md], { type: 'text/markdown' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (document.body.getAttribute('data-page-id') || 'notes') + '.md';
    a.click();
  }

  document.addEventListener('DOMContentLoaded', function () {
    content = document.getElementById('content');
    if (!content) return;
    restoreHighlights();
    renderDrawer();
    initToolbar();
    initDrawer();
  });
})();
