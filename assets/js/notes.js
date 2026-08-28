/* KnowML — personal notes & highlights, persisted in localStorage per page */
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
  var toolbar;

  function uid() { return 'h' + Math.random().toString(36).slice(2, 10); }

  function markClass(color, note) { return 'hl hl-' + color + (note ? ' has-note' : ''); }

  function wrapHighlight(h) {
    return window.KMLAnchor.wrapOccurrence(content, h.text, h.occurrence || 0, function () {
      var mark = document.createElement('mark');
      mark.className = markClass(h.color, h.note);
      mark.dataset.hid = h.id;
      return mark;
    });
  }

  function restoreHighlights() {
    state.highlights.forEach(wrapHighlight);
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

  function unwrapMark(mark) {
    var parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }

  function removeHighlight(id) {
    state.highlights = state.highlights.filter(function (h) { return h.id !== id; });
    save(state);
    var mark = content.querySelector('mark.hl[data-hid="' + id + '"]');
    if (mark) unwrapMark(mark);
    renderDrawer();
  }

  function addHighlight(text, color, note, occurrence) {
    var h = { id: uid(), text: text, color: color, note: note || '', occurrence: occurrence || 0, createdAt: Date.now() };
    state.highlights.push(h);
    save(state);
    wrapHighlight(h);
    renderDrawer();
  }

  function changeHighlightColor(id, color) {
    var h = state.highlights.filter(function (x) { return x.id === id; })[0];
    if (!h) return;
    h.color = color;
    save(state);
    var mark = content.querySelector('mark.hl[data-hid="' + id + '"]');
    if (mark) mark.className = markClass(h.color, h.note);
    renderDrawer();
  }

  function editHighlightNote(id) {
    var h = state.highlights.filter(function (x) { return x.id === id; })[0];
    if (!h) return;
    var note = prompt('Edit note:', h.note || '');
    if (note === null) return;
    h.note = note;
    save(state);
    var mark = content.querySelector('mark.hl[data-hid="' + id + '"]');
    if (mark) mark.className = markClass(h.color, h.note);
    renderDrawer();
  }

  /* ---------- selection toolbar: new selections + click-to-edit existing highlights ---------- */
  function closeToolbar() {
    toolbar.style.display = 'none';
    toolbar.removeAttribute('data-mode');
    delete toolbar.dataset.editHid;
    delete toolbar.dataset.pendingText;
    delete toolbar.dataset.pendingOccurrence;
  }

  function positionToolbarAt(rect) {
    toolbar.style.display = 'flex';
    toolbar.style.top = (window.scrollY + rect.top - 42) + 'px';
    toolbar.style.left = Math.max(8, window.scrollX + rect.left + rect.width / 2 - 70) + 'px';
  }

  function openEditPopover(mark) {
    var h = state.highlights.filter(function (x) { return x.id === mark.dataset.hid; })[0];
    if (!h) return;
    toolbar.dataset.mode = 'edit';
    toolbar.dataset.editHid = h.id;
    positionToolbarAt(mark.getBoundingClientRect());
  }

  function initToolbar() {
    toolbar = document.getElementById('selectToolbar');
    if (!toolbar) return;

    if (!document.querySelector('.topic-header')) {
      var commentBtn0 = toolbar.querySelector('[data-comment]');
      if (commentBtn0) commentBtn0.style.display = 'none'; /* discussion only exists on topic pages */
    }

    document.addEventListener('mouseup', function (e) {
      if (toolbar.contains(e.target)) return;
      var sel = window.getSelection();
      var text = sel.toString().trim();
      if (!text || !content.contains(sel.anchorNode) || text.length > 400) {
        if (!e.target.closest('mark.hl')) closeToolbar();
        return;
      }
      var range = sel.getRangeAt(0);
      toolbar.dataset.mode = 'select';
      toolbar.dataset.pendingText = text;
      toolbar.dataset.pendingOccurrence = window.KMLAnchor.computeOccurrence(content, range, text);
      positionToolbarAt(range.getBoundingClientRect());
    });

    /* plain click (not a drag-selection) on an existing highlight opens the edit popover */
    content.addEventListener('click', function (e) {
      var mark = e.target.closest('mark.hl');
      if (!mark) return;
      var sel = window.getSelection();
      if (sel && sel.toString().trim()) return;
      openEditPopover(mark);
    });

    toolbar.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (toolbar.dataset.mode === 'edit') {
          changeHighlightColor(toolbar.dataset.editHid, btn.dataset.color);
        } else {
          var text = toolbar.dataset.pendingText;
          if (text) addHighlight(text, btn.dataset.color, '', +toolbar.dataset.pendingOccurrence || 0);
        }
        closeToolbar();
        window.getSelection().removeAllRanges();
      });
    });

    var noteBtn = toolbar.querySelector('[data-note]');
    if (noteBtn) noteBtn.addEventListener('click', function () {
      if (toolbar.dataset.mode === 'edit') {
        editHighlightNote(toolbar.dataset.editHid);
        closeToolbar();
        return;
      }
      var text = toolbar.dataset.pendingText;
      if (!text) return;
      var note = prompt('Add a note to this highlight:', '');
      if (note !== null) addHighlight(text, 'yellow', note, +toolbar.dataset.pendingOccurrence || 0);
      closeToolbar();
      window.getSelection().removeAllRanges();
      openDrawer();
    });

    var removeBtn = toolbar.querySelector('[data-remove]');
    if (removeBtn) removeBtn.addEventListener('click', function () {
      if (toolbar.dataset.mode === 'edit' && toolbar.dataset.editHid) removeHighlight(toolbar.dataset.editHid);
      closeToolbar();
    });

    var commentBtn = toolbar.querySelector('[data-comment]');
    if (commentBtn) commentBtn.addEventListener('click', function () {
      if (toolbar.dataset.mode === 'edit') { closeToolbar(); return; }
      var text = toolbar.dataset.pendingText;
      var occurrence = +toolbar.dataset.pendingOccurrence || 0;
      closeToolbar();
      window.getSelection().removeAllRanges();
      if (text) document.dispatchEvent(new CustomEvent('kml:comment-request', { detail: { text: text, occurrence: occurrence } }));
    });

    document.addEventListener('mousedown', function (e) {
      if (!toolbar.contains(e.target) && !e.target.closest('mark.hl')) closeToolbar();
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
    var md = '# ' + title + '\n\n_Exported from KnowML — ' + location.href + '_\n\n';
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
