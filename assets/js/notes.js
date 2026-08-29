/* KnowML — personal notes & highlights, persisted in localStorage per page.

   A highlight is stored as character offsets into the flattened page text plus
   the text itself, and painted as one <mark> per text node it covers, so a
   selection running through a <strong> or an equation still works. See
   anchor.js for the anchoring model. */
(function () {
  'use strict';

  function pageKey() { return 'np-notes::' + location.pathname; }
  function load() {
    try { return JSON.parse(localStorage.getItem(pageKey()) || '{"freeNotes":"","highlights":[]}'); }
    catch (e) { return { freeNotes: '', highlights: [] }; }
  }
  function save(state) { localStorage.setItem(pageKey(), JSON.stringify(state)); }

  var state = load();
  var content, toolbar, editor;
  var orphaned = {};   /* id -> true when the stored text is no longer on the page */

  function uid() { return 'h' + Math.random().toString(36).slice(2, 10); }
  function markClass(color, note) { return 'hl hl-' + color + (note ? ' has-note' : ''); }
  function marksFor(id) { return content.querySelectorAll('mark.hl[data-hid="' + id + '"]'); }
  function byId(id) { return state.highlights.filter(function (h) { return h.id === id; })[0]; }

  function wrapHighlight(h) {
    var pieces = window.KMLAnchor.paint(content, h, function () {
      var mark = document.createElement('mark');
      mark.className = markClass(h.color, h.note);
      mark.dataset.hid = h.id;
      if (h.note) mark.title = h.note;
      return mark;
    });
    /* A highlight crossing inline markup paints as several <mark>s. Round and
       pad only the outer edges so the run reads as one continuous band rather
       than a row of separate pills. */
    if (pieces.length) {
      pieces[0].classList.add('hl-first');
      pieces[pieces.length - 1].classList.add('hl-last');
    }
    if (!pieces.length) orphaned[h.id] = true; else delete orphaned[h.id];
    return pieces;
  }

  function restoreHighlights() { state.highlights.forEach(wrapHighlight); }

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
      div.className = 'hl-item' + (orphaned[h.id] ? ' is-orphan' : '');
      var quote = document.createElement('div');
      quote.className = 'hl-quote';
      quote.textContent = '"' + h.text + '"';
      div.appendChild(quote);
      if (h.note) {
        var note = document.createElement('div');
        note.className = 'hl-note';
        note.textContent = h.note;
        div.appendChild(note);
      }
      if (orphaned[h.id]) {
        var warn = document.createElement('div');
        warn.className = 'hl-orphan';
        warn.textContent = 'This passage has changed, so the highlight is no longer shown on the page.';
        div.appendChild(warn);
      }
      var row = document.createElement('div');
      row.className = 'hl-row';
      row.innerHTML = '<span class="dot" style="background:var(--hl-' + h.color + ')"></span>';
      var go = document.createElement('button');
      go.className = 'hl-go';
      go.textContent = 'jump to';
      go.disabled = !!orphaned[h.id];
      go.addEventListener('click', function () {
        var m = marksFor(h.id)[0];
        if (!m) return;
        closeDrawer();
        m.scrollIntoView({ behavior: 'smooth', block: 'center' });
        m.classList.add('hl-flash');
        setTimeout(function () { m.classList.remove('hl-flash'); }, 1200);
      });
      var del = document.createElement('button');
      del.className = 'hl-del';
      del.textContent = 'remove';
      del.addEventListener('click', function () { removeHighlight(h.id); });
      row.appendChild(go); row.appendChild(del);
      div.appendChild(row);
      list.appendChild(div);
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
    delete orphaned[id];
    save(state);
    Array.prototype.forEach.call(marksFor(id), unwrapMark);
    renderDrawer();
  }

  function addHighlight(anchor, color, note) {
    var h = {
      id: uid(), text: anchor.text, color: color, note: note || '',
      start: anchor.start, end: anchor.end,
      occurrence: window.KMLAnchor.occurrenceAt(content, anchor.start, anchor.text),
      createdAt: Date.now()
    };
    state.highlights.push(h);
    save(state);
    wrapHighlight(h);
    renderDrawer();
    return h;
  }

  function restyle(h) {
    Array.prototype.forEach.call(marksFor(h.id), function (m) {
      var edges = (m.classList.contains('hl-first') ? ' hl-first' : '') +
                  (m.classList.contains('hl-last') ? ' hl-last' : '');
      m.className = markClass(h.color, h.note) + edges;
      if (h.note) m.title = h.note; else m.removeAttribute('title');
    });
  }

  function changeHighlightColor(id, color) {
    var h = byId(id);
    if (!h) return;
    h.color = color;
    save(state); restyle(h); renderDrawer();
  }

  function setNote(id, note) {
    var h = byId(id);
    if (!h) return;
    h.note = note;
    save(state); restyle(h); renderDrawer();
  }

  /* ---------- inline note editor (replaces window.prompt) ---------- */
  function buildEditor() {
    editor = document.createElement('div');
    editor.className = 'note-editor';
    editor.innerHTML =
      '<textarea rows="3" placeholder="What do you want to remember about this?"></textarea>' +
      '<div class="ne-row"><button type="button" class="ne-cancel">Cancel</button>' +
      '<button type="button" class="ne-save">Save note</button></div>';
    document.body.appendChild(editor);
    var ta = editor.querySelector('textarea');
    editor.querySelector('.ne-cancel').addEventListener('click', closeEditor);
    editor.querySelector('.ne-save').addEventListener('click', commitEditor);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeEditor(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitEditor();
    });
    editor.addEventListener('mousedown', function (e) { e.stopPropagation(); });
  }

  function openEditor(rect, existingId, pendingAnchor) {
    editor.dataset.hid = existingId || '';
    editor._pending = pendingAnchor || null;
    var ta = editor.querySelector('textarea');
    ta.value = existingId && byId(existingId) ? byId(existingId).note : '';
    editor.classList.add('open');
    placeFloating(editor, rect);
    ta.focus();
  }

  function closeEditor() {
    editor.classList.remove('open');
    editor._pending = null;
    delete editor.dataset.hid;
  }

  function commitEditor() {
    var note = editor.querySelector('textarea').value.trim();
    if (editor.dataset.hid) setNote(editor.dataset.hid, note);
    else if (editor._pending) addHighlight(editor._pending, 'yellow', note);
    closeEditor();
    window.getSelection().removeAllRanges();
  }

  /* ---------- floating placement, shared by toolbar and editor ---------- */
  function placeFloating(el, rect) {
    var prev = el.style.visibility;
    el.style.visibility = 'hidden';
    if (el === toolbar) el.style.display = 'flex';
    var w = el.offsetWidth, h = el.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    /* prefer above the selection; flip below when that would clip off-screen */
    var top = rect.top - h - 8;
    if (top < 8) top = Math.min(rect.bottom + 8, vh - h - 8);
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8);
    el.style.top = (window.scrollY + top) + 'px';
    el.style.left = (window.scrollX + left) + 'px';
    el.style.visibility = prev;
  }

  /* ---------- selection toolbar ---------- */
  function closeToolbar() {
    toolbar.style.display = 'none';
    toolbar.removeAttribute('data-mode');
    delete toolbar.dataset.editHid;
    toolbar._pending = null;
  }

  function openEditPopover(mark) {
    var h = byId(mark.dataset.hid);
    if (!h) return;
    toolbar.dataset.mode = 'edit';
    toolbar.dataset.editHid = h.id;
    placeFloating(toolbar, mark.getBoundingClientRect());
  }

  function onSelectionSettled(e) {
    if (toolbar.contains(e.target) || (editor && editor.contains(e.target))) return;
    var sel = window.getSelection();
    var text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text || !sel.rangeCount || text.length > 600) {
      if (!(e.target.closest && e.target.closest('mark.hl'))) closeToolbar();
      return;
    }
    var range = sel.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) { closeToolbar(); return; }
    var anchor = window.KMLAnchor.rangeToOffsets(content, range);
    if (!anchor) { closeToolbar(); return; }
    toolbar.dataset.mode = 'select';
    toolbar._pending = anchor;
    placeFloating(toolbar, range.getBoundingClientRect());
  }

  function initToolbar() {
    toolbar = document.getElementById('selectToolbar');
    if (!toolbar) return;

    if (!document.querySelector('.topic-header')) {
      var commentBtn0 = toolbar.querySelector('[data-comment]');
      if (commentBtn0) commentBtn0.style.display = 'none'; /* discussion only exists on topic pages */
    }

    document.addEventListener('mouseup', onSelectionSettled);
    /* touch devices never fire a usable mouseup for a text selection */
    document.addEventListener('touchend', function (e) { setTimeout(function () { onSelectionSettled(e); }, 10); });

    content.addEventListener('click', function (e) {
      var mark = e.target.closest('mark.hl');
      if (!mark) return;
      var sel = window.getSelection();
      if (sel && sel.toString().trim()) return;
      openEditPopover(mark);
    });

    toolbar.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (toolbar.dataset.mode === 'edit') changeHighlightColor(toolbar.dataset.editHid, btn.dataset.color);
        else if (toolbar._pending) addHighlight(toolbar._pending, btn.dataset.color, '');
        closeToolbar();
        window.getSelection().removeAllRanges();
      });
    });

    var noteBtn = toolbar.querySelector('[data-note]');
    if (noteBtn) noteBtn.addEventListener('click', function () {
      var rect = toolbar.getBoundingClientRect();
      if (toolbar.dataset.mode === 'edit') {
        var hid = toolbar.dataset.editHid;
        closeToolbar();
        openEditor(rect, hid, null);
        return;
      }
      var pending = toolbar._pending;
      closeToolbar();
      if (pending) openEditor(rect, null, pending);
    });

    var removeBtn = toolbar.querySelector('[data-remove]');
    if (removeBtn) removeBtn.addEventListener('click', function () {
      if (toolbar.dataset.mode === 'edit' && toolbar.dataset.editHid) removeHighlight(toolbar.dataset.editHid);
      closeToolbar();
    });

    var commentBtn = toolbar.querySelector('[data-comment]');
    if (commentBtn) commentBtn.addEventListener('click', function () {
      if (toolbar.dataset.mode === 'edit') { closeToolbar(); return; }
      var pending = toolbar._pending;
      closeToolbar();
      window.getSelection().removeAllRanges();
      if (pending) document.dispatchEvent(new CustomEvent('kml:comment-request', {
        detail: { text: pending.text, occurrence: window.KMLAnchor.occurrenceAt(content, pending.start, pending.text) }
      }));
    });

    document.addEventListener('mousedown', function (e) {
      if (editor && editor.contains(e.target)) return;
      if (!toolbar.contains(e.target) && !(e.target.closest && e.target.closest('mark.hl'))) closeToolbar();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (editor && editor.classList.contains('open')) closeEditor();
      else closeToolbar();
    });
  }

  /* ---------- drawer open/close + free notes ---------- */
  function openDrawer() { document.getElementById('notesDrawer').classList.add('open'); }
  function closeDrawer() { document.getElementById('notesDrawer').classList.remove('open'); }

  function initDrawer() {
    document.querySelectorAll('[data-notes-toggle]').forEach(function (b) { b.addEventListener('click', openDrawer); });
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

  function start() {
    content = document.getElementById('content');
    if (!content) return;
    buildEditor();
    restoreHighlights();
    renderDrawer();
    initToolbar();
    initDrawer();
  }

  /* KaTeX rewrites the DOM as it renders, which shifts every character offset
     after an equation. app.js fires kml:math-ready once that has settled, on
     every page, math or not. The listener is registered at parse time so it is
     in place before app.js can dispatch. The timeout only covers app.js being
     absent entirely. */
  var started = false;
  function startOnce() { if (!started) { started = true; start(); } }
  document.addEventListener('kml:math-ready', startOnce);
  document.addEventListener('DOMContentLoaded', function () { setTimeout(startOnce, 4000); });
})();
