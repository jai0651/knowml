/* KnowML — shell behavior: theme, nav, TOC, search, progress, KaTeX render */
(function () {
  'use strict';

  /* ---------- theme ---------- */
  var THEME_KEY = 'np-theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = t === 'dark' ? '☀' : '☽';
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });
  });

  /* ---------- mobile sidebar ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var ham = document.getElementById('hamburger');
    var sb = document.getElementById('sidebarLeft');
    if (ham && sb) {
      ham.addEventListener('click', function () { sb.classList.toggle('open'); });
      document.addEventListener('click', function (e) {
        if (sb.classList.contains('open') && !sb.contains(e.target) && e.target !== ham && !ham.contains(e.target)) {
          sb.classList.remove('open');
        }
      });
    }
  });

  /* ---------- reading progress ---------- */
  window.addEventListener('scroll', function () {
    var bar = document.getElementById('progressBar');
    if (!bar) return;
    var el = document.getElementById('content') || document.documentElement;
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    var pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    bar.style.width = Math.min(100, Math.max(0, pct)) + '%';

    var top = document.getElementById('toTop');
    if (top) top.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });

  document.addEventListener('DOMContentLoaded', function () {
    var top = document.getElementById('toTop');
    if (top) top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  });

  /* ---------- mark page as read (learning-graph progress) ---------- */
  var DONE_KEY = 'np-done-pages';
  function getDone() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch (e) { return []; } }
  function setDone(arr) { localStorage.setItem(DONE_KEY, JSON.stringify(arr)); }
  window.NP_toggleDone = function (pageId) {
    var arr = getDone();
    var i = arr.indexOf(pageId);
    if (i >= 0) arr.splice(i, 1); else arr.push(pageId);
    setDone(arr);
    paintDoneMarks();
  };
  function paintDoneMarks() {
    var done = getDone();
    var links = document.querySelectorAll('.sidebar-left a[data-page]');
    links.forEach(function (a) {
      a.classList.toggle('is-done', done.indexOf(a.getAttribute('data-page')) >= 0);
    });
    var doneBtn = document.getElementById('markDoneBtn');
    if (doneBtn) {
      var pid = document.body.getAttribute('data-page-id');
      var isDone = done.indexOf(pid) >= 0;
      doneBtn.textContent = isDone ? '✓ Marked as revised' : 'Mark as revised';
      doneBtn.classList.toggle('is-active', isDone);
    }
    injectSidebarProgress(done.length, links.length);
  }

  function injectSidebarProgress(count, total) {
    var sb = document.getElementById('sidebarLeft');
    if (!sb || !total) return;
    var pct = Math.round((count / total) * 100);
    var el = document.getElementById('sidebarProgress');
    if (!el) {
      el = document.createElement('div');
      el.className = 'sidebar-progress';
      el.id = 'sidebarProgress';
      el.innerHTML = '<div class="sp-row"><span class="sp-label">Your progress</span><span class="sp-count" id="spCount"></span></div><div class="sp-track"><div class="sp-fill" id="spFill"></div></div>';
      var backLink = sb.querySelector('a[href*="index.html"]');
      if (backLink && backLink.nextSibling) backLink.parentNode.insertBefore(el, backLink.nextSibling);
      else sb.insertBefore(el, sb.firstChild);
    }
    document.getElementById('spCount').textContent = count + ' / ' + total;
    document.getElementById('spFill').style.width = pct + '%';
  }

  /* ---------- table of contents ---------- */
  function buildTOC() {
    var toc = document.getElementById('toc');
    var content = document.getElementById('content');
    if (!toc || !content) return;
    var heads = content.querySelectorAll('section > h2, section > h3');
    if (!heads.length) { toc.closest('.toc-block') && (toc.closest('.toc-block').style.display = 'none'); return; }
    var frag = document.createDocumentFragment();
    heads.forEach(function (h) {
      if (!h.id) h.id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/^\d+(\.\d+)?\s*/, '');
      if (h.tagName === 'H3') a.className = 'lvl3';
      frag.appendChild(a);
    });
    toc.appendChild(frag);

    var links = toc.querySelectorAll('a');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.id;
        var link = toc.querySelector('a[href="#' + id + '"]');
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('active'); });
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ---------- search ---------- */
  var searchIndex = window.SEARCH_INDEX || [];
  function openSearch() {
    var modal = document.getElementById('searchModal');
    if (!modal) return;
    modal.classList.add('open');
    var input = document.getElementById('searchInput');
    input.value = '';
    input.focus();
    renderResults('');
  }
  function closeSearch() {
    var modal = document.getElementById('searchModal');
    if (modal) modal.classList.remove('open');
  }
  function scorePage(q, item) {
    q = q.toLowerCase();
    var hay = (item.title + ' ' + item.section + ' ' + (item.tags || []).join(' ') + ' ' + item.summary).toLowerCase();
    if (!q) return 1;
    if (item.title.toLowerCase().indexOf(q) === 0) return 100;
    if (item.title.toLowerCase().indexOf(q) > -1) return 60;
    if (hay.indexOf(q) > -1) return 20;
    var terms = q.split(/\s+/).filter(Boolean);
    var hits = terms.filter(function (t) { return hay.indexOf(t) > -1; }).length;
    return hits === terms.length && terms.length > 0 ? 10 : 0;
  }
  function pathPrefix() {
    return location.pathname.indexOf('/topics/') > -1 ? '../' : './';
  }
  function renderResults(q) {
    var box = document.getElementById('searchResults');
    if (!box) return;
    var ranked = searchIndex.map(function (it) { return { it: it, s: scorePage(q, it) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 40);
    box.innerHTML = '';
    if (!ranked.length) {
      box.innerHTML = '<div class="search-empty">No matches. Try "attention", "backprop", "RAG", "diffusion"…</div>';
      return;
    }
    ranked.forEach(function (r, idx) {
      var it = r.it;
      var a = document.createElement('a');
      a.href = pathPrefix() + it.url;
      a.className = 'search-hit' + (idx === 0 ? ' active' : '');
      a.innerHTML = '<div class="sh-sec" style="color:' + it.color + '">' + it.section + '</div>' +
        '<div class="sh-title">' + it.title + '</div>' +
        '<div class="sh-sum">' + it.summary + '</div>';
      box.appendChild(a);
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var trigger = document.getElementById('searchTrigger');
    var modal = document.getElementById('searchModal');
    var input = document.getElementById('searchInput');
    if (trigger) trigger.addEventListener('click', openSearch);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeSearch(); });
    if (input) input.addEventListener('input', function () { renderResults(input.value); });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') closeSearch();
      var m = document.getElementById('searchModal');
      if (m && m.classList.contains('open') && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
        var box = document.getElementById('searchResults');
        var hits = Array.prototype.slice.call(box.querySelectorAll('.search-hit'));
        if (!hits.length) return;
        var curIdx = hits.findIndex(function (h) { return h.classList.contains('active'); });
        if (e.key === 'Enter') { if (curIdx > -1) hits[curIdx].click(); return; }
        e.preventDefault();
        hits[curIdx] && hits[curIdx].classList.remove('active');
        var next = e.key === 'ArrowDown' ? Math.min(curIdx + 1, hits.length - 1) : Math.max(curIdx - 1, 0);
        hits[next].classList.add('active');
        hits[next].scrollIntoView({ block: 'nearest' });
      }
    });
  });

  /* ---------- diagram play/pause ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-diagram-toggle]');
    if (!btn) return;
    var dia = btn.closest('.diagram');
    dia.classList.toggle('paused');
    btn.textContent = dia.classList.contains('paused') ? '▶ Play' : '⏸ Pause';
  });

  document.addEventListener('DOMContentLoaded', function () {
    buildTOC();
    paintDoneMarks();
    var doneBtn = document.getElementById('markDoneBtn');
    if (doneBtn) doneBtn.addEventListener('click', function () {
      NP_toggleDone(document.body.getAttribute('data-page-id'));
    });
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ]
      });
    } else {
      window.addEventListener('load', function () {
        if (window.renderMathInElement) {
          renderMathInElement(document.body, {
            delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }]
          });
        }
      });
    }
  });
})();
