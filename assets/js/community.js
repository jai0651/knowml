/* NeuralPath — shared view/like counters + per-page discussion.
   Backed by /api/counters and /api/comments (Postgres via Neon).
   Fails silently if the API isn't reachable (e.g. plain static preview
   without `vercel dev`) so the rest of the site keeps working. */
(function () {
  'use strict';

  function pageId() { return document.body.getAttribute('data-page-id'); }
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
      '<span class="pc-views">👁 <span id="pcViewCount">' + counts.views + '</span> views</span>' +
      '<button class="pc-like-btn' + (liked ? ' is-liked' : '') + '" id="pcLikeBtn" type="button">' +
        '<span class="pc-heart">' + (liked ? '❤️' : '🤍') + '</span> <span id="pcLikeCount">' + counts.likes + '</span>' +
      '</button>';
    return bar;
  }

  function mountCommunityBar(bar) {
    var header = document.querySelector('.topic-header');
    if (header) {
      var metaRow = header.querySelector('.meta-row');
      if (metaRow) { metaRow.insertAdjacentElement('afterend', bar); return; }
      header.appendChild(bar);
      return;
    }
    var hero = document.querySelector('.hero');
    if (hero) {
      var cta = hero.querySelector('.hero-cta');
      if (cta) { cta.insertAdjacentElement('afterend', bar); return; }
      hero.appendChild(bar);
      return;
    }
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
    if (!pid) return;
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
    return (
      '<div class="comment-item">' +
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
              '<span class="comment-hint">Visible to anyone who visits this page.</span>' +
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

  function initDiscussion() {
    var pid = pageId();
    if (!pid) return;
    var section = buildDiscussionSection();
    mountDiscussion(section);

    var savedName = localStorage.getItem('community:name');
    if (savedName) document.getElementById('commentName').value = savedName;

    apiGet('/api/comments?pageId=' + encodeURIComponent(pid))
      .then(function (data) { renderComments(data.comments || []); })
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
        .then(function (data) {
          localStorage.setItem('community:name', name);
          bodyInput.value = '';
          apiGet('/api/comments?pageId=' + encodeURIComponent(pid))
            .then(function (d) { renderComments(d.comments || []); });
        })
        .catch(function () {
          alert('Could not post your comment — please try again.');
        })
        .finally(function () { submitBtn.disabled = false; });
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
