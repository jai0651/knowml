/* KnowML — shared view/like counters + per-page discussion, with Confluence-style
   inline comment pins anchored to specific text (via the shared KMLAnchor utility).
   Backed by /api/counters and /api/comments (Postgres via Neon).
   Fails silently if the API isn't reachable (e.g. plain static preview
   without `vercel dev`) so the rest of the site keeps working. */
(function () {
  'use strict';

  function pageId() { return document.body.getAttribute('data-page-id'); }
  function isTopicPage() { return !!document.querySelector('.topic-header'); }
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function timeAgo(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
  }

  /* ---------- views + likes widget ---------- */
  function renderCommunityBar(counts) {
    var pid = pageId();
    var liked = localStorage.getItem('liked:' + pid) === '1';
    var bar = document.createElement('div');
    bar.className = 'page-community';
    bar.id = 'pageCommunity';
    bar.innerHTML =
      '<span class="pc-views"><svg class="pc-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/></svg> <span id="pcViewCount">' + counts.views + '</span> views</span>' +
      '<button class="pc-like-btn' + (liked ? ' is-liked' : '') + '" id="pcLikeBtn" type="button">' +
        '<span class="pc-heart">' + (liked ? '❤️' : '🤍') + '</span> <span id="pcLikeCount">' + counts.likes + '</span>' +
      '</button>';
    return bar;
  }

  function mountCommunityBar(bar) {
    var header = document.querySelector('.topic-header');
    if (!header) return; /* topic pages only — not the homepage */
    var metaRow = header.querySelector('.meta-row');
    if (metaRow) { metaRow.insertAdjacentElement('afterend', bar); return; }
    header.appendChild(bar);
  }

  function wireLikeButton() {
    var btn = document.getElementById('pcLikeBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var pid = pageId();
      var liked = localStorage.getItem('liked:' + pid) === '1';
      var action = liked ? 'unlike' : 'like';
      btn.disabled = true;
      apiPost('/api/counters', { pageId: pid, action: action })
        .then(function (data) {
          localStorage.setItem('liked:' + pid, liked ? '0' : '1');
          btn.classList.toggle('is-liked', !liked);
          btn.querySelector('.pc-heart').textContent = liked ? '🤍' : '❤️';
          document.getElementById('pcLikeCount').textContent = data.likes;
        })
        .catch(function () {})
        .finally(function () { btn.disabled = false; });
    });
  }

  function initCommunityBar() {
    var pid = pageId();
    if (!pid || !isTopicPage()) return;
    apiGet('/api/counters?pageId=' + encodeURIComponent(pid))
      .then(function (counts) {
        mountCommunityBar(renderCommunityBar(counts));
        wireLikeButton();
        var sessionKey = 'viewed:' + pid;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1');
          apiPost('/api/counters', { pageId: pid, action: 'view' })
            .then(function (data) {
              var el = document.getElementById('pcViewCount');
              if (el) el.textContent = data.views;
            })
            .catch(function () {});
        }
      })
      .catch(function () { /* API not reachable — skip the widget entirely */ });
  }

  /* ---------- discussion / comments ---------- */
  function commentItemHtml(c) {
    var anchorHtml = c.anchorText ? '<div class="c-anchor-quote">"' + escapeHtml(c.anchorText) + '"</div>' : '';
    return (
      '<div class="comment-item" data-comment-id="' + c.id + '">' +
        anchorHtml +
        '<div class="c-head"><span class="c-author">' + escapeHtml(c.authorName) + '</span>' +
        '<span class="c-time">' + timeAgo(c.createdAt) + '</span></div>' +
        '<div class="c-body">' + escapeHtml(c.body) + '</div>' +
      '</div>'
    );
  }

  function buildDiscussionSection() {
    var section = document.createElement('section');
    section.className = 'discussion-section';
    section.id = 'discussion';
    section.innerHTML =
      '<details id="discussionToggle">' +
        '<summary>' +
          '<span class="disc-title">Discussion</span>' +
          '<span class="discussion-count" id="discussionCount">Loading…</span>' +
          '<span class="disc-chev">▸</span>' +
        '</summary>' +
        '<div class="discussion-body">' +
          '<div class="comment-list" id="commentList"></div>' +
          '<form class="comment-form" id="commentForm">' +
            '<input type="text" id="commentName" placeholder="Your name" maxlength="60" required />' +
            '<textarea id="commentBody" placeholder="Share a thought, a question, a correction…" maxlength="2000" required></textarea>' +
            '<div class="comment-form-row">' +
              '<span class="comment-hint">Visible to anyone who visits this page. Tip: select any text on the page to pin a comment to it.</span>' +
              '<button class="comment-submit-btn" type="submit">Post comment</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</details>';
    return section;
  }

  function mountDiscussion(section) {
    var main = document.getElementById('content');
    if (!main) return;
    main.appendChild(section);
  }

  function renderComments(list) {
    var listEl = document.getElementById('commentList');
    var countEl = document.getElementById('discussionCount');
    if (!listEl || !countEl) return;
    countEl.textContent = list.length === 0 ? 'No comments yet — be the first.' : list.length + (list.length === 1 ? ' comment' : ' comments');
    listEl.innerHTML = list.map(commentItemHtml).join('');
  }

  /* ---------- inline comment pins, anchored via KMLAnchor ---------- */
  function anchorKey(c) { return c.anchorText + '::' + (c.anchorOccurrence || 0); }

  function clearAnchors(content) {
    content.querySelectorAll('.cm-anchor-wrap').forEach(function (wrap) {
      var parent = wrap.parentNode;
      while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
      parent.removeChild(wrap);
      parent.normalize();
    });
    content.querySelectorAll('.cm-pin').forEach(function (p) { p.remove(); });
    content.querySelectorAll('mark.cm-anchor').forEach(function (m) {
      var parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }

  function scrollToComment(id) {
    requestAnimationFrame(function () {
      var el = document.querySelector('.comment-item[data-comment-id="' + id + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(function () { el.classList.remove('flash'); }, 1700);
    });
  }

  function renderAnchors(list) {
    var content = document.getElementById('content');
    if (!content) return;
    clearAnchors(content);
    var groups = {};
    var order = [];
    list.forEach(function (c) {
      if (!c.anchorText) return;
      var key = anchorKey(c);
      if (!groups[key]) { groups[key] = { text: c.anchorText, occurrence: c.anchorOccurrence || 0, comments: [] }; order.push(key); }
      groups[key].comments.push(c);
    });
    order.forEach(function (key) {
      var g = groups[key];
      var mark = window.KMLAnchor.wrapOccurrence(content, g.text, g.occurrence, function () {
        var m = document.createElement('mark');
        m.className = 'cm-anchor';
        return m;
      });
      if (!mark) return;
      var pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'cm-pin';
      pin.title = g.comments.length + (g.comments.length === 1 ? ' comment' : ' comments') + ' on this passage';
      pin.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4z"/></svg><span>' + g.comments.length + '</span>';
      pin.addEventListener('click', function (e) {
        e.stopPropagation();
        var toggle = document.getElementById('discussionToggle');
        if (toggle) toggle.open = true;
        scrollToComment(g.comments[g.comments.length - 1].id);
      });
      /* keep the badge glued to its anchor text — otherwise it can wrap onto its own line */
      var wrap = document.createElement('span');
      wrap.className = 'cm-anchor-wrap';
      mark.parentNode.insertBefore(wrap, mark);
      wrap.appendChild(mark);
      wrap.appendChild(pin);
    });
  }

  function applyComments(list) {
    renderComments(list);
    renderAnchors(list);
  }

  function initDiscussion() {
    var pid = pageId();
    if (!pid || !isTopicPage()) return;
    var section = buildDiscussionSection();
    mountDiscussion(section);

    var savedName = localStorage.getItem('community:name');
    if (savedName) document.getElementById('commentName').value = savedName;

    apiGet('/api/comments?pageId=' + encodeURIComponent(pid))
      .then(function (data) { applyComments(data.comments || []); })
      .catch(function () {
        document.getElementById('discussionCount').textContent = 'Comments are unavailable right now.';
      });

    document.getElementById('commentForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var nameInput = document.getElementById('commentName');
      var bodyInput = document.getElementById('commentBody');
      var name = nameInput.value.trim();
      var body = bodyInput.value.trim();
      if (!name || !body) return;
      var submitBtn = section.querySelector('.comment-submit-btn');
      submitBtn.disabled = true;
      apiPost('/api/comments', { pageId: pid, authorName: name, body: body })
        .then(function () {
          localStorage.setItem('community:name', name);
          bodyInput.value = '';
          return apiGet('/api/comments?pageId=' + encodeURIComponent(pid));
        })
        .then(function (d) { applyComments(d.comments || []); })
        .catch(function () {
          alert('Could not post your comment — please try again.');
        })
        .finally(function () { submitBtn.disabled = false; });
    });

    document.addEventListener('kml:comment-request', function (e) {
      var text = e.detail && e.detail.text;
      var occurrence = e.detail ? e.detail.occurrence : 0;
      if (!text) return;
      var name = localStorage.getItem('community:name');
      if (!name) {
        name = (prompt('Your name (shown on your comment):', '') || '').trim();
        if (!name) return;
      }
      var preview = text.length > 90 ? text.slice(0, 90) + '…' : text;
      var body = (prompt('Comment on:\n"' + preview + '"', '') || '').trim();
      if (!body) return;
      apiPost('/api/comments', { pageId: pid, authorName: name, body: body, anchorText: text, anchorOccurrence: occurrence })
        .then(function () {
          localStorage.setItem('community:name', name);
          return apiGet('/api/comments?pageId=' + encodeURIComponent(pid));
        })
        .then(function (d) {
          var list = d.comments || [];
          applyComments(list);
          var toggle = document.getElementById('discussionToggle');
          if (toggle) toggle.open = true;
          var group = list.filter(function (c) { return c.anchorText === text && (c.anchorOccurrence || 0) === occurrence; });
          if (group.length) scrollToComment(group[group.length - 1].id);
        })
        .catch(function () { alert('Could not post your comment — please try again.'); });
    });
  }

  /* ---------- tiny fetch helpers ---------- */
  function apiGet(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); });
  }
  function apiPost(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCommunityBar();
    initDiscussion();
  });
})();
