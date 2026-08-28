/* KnowML — the Review page: drill UI, mastery bars, resurfaced highlights.
   Only loaded on review.html, where the full question bank is available. */
(function () {
  'use strict';

  var R, CARDS;
  var queue = [];
  var pos = 0;
  var sessionStats = { again: 0, hard: 0, good: 0 };
  var revealed = false;

  var el = {};

  function $(id) { return document.getElementById(id); }

  function renderMath(node) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(node, {
          delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        });
      } catch (e) {}
    }
  }

  /* ---------- landing stats ---------- */
  function paintStats() {
    var c = R.counts(CARDS);
    $('statDue').textContent = c.due;
    $('statNew').textContent = c.unseen;
    $('statKnown').textContent = c.known;
    $('statStreak').textContent = R.streak();

    var pct = c.total ? Math.round((c.known / c.total) * 100) : 0;
    $('overallPct').textContent = pct + '%';
    $('overallBar').style.width = pct + '%';
    $('overallDetail').textContent = c.known + ' of ' + c.total + ' questions known · ' +
      c.learning + ' still learning · ' + c.unseen + ' not yet seen';
  }

  /* ---------- mastery by section ---------- */
  function paintMastery() {
    var groups = {};
    CARDS.forEach(function (c) {
      if (!groups[c.group]) groups[c.group] = { color: c.color, cards: [] };
      groups[c.group].cards.push(c);
    });
    var wrap = $('masteryList');
    wrap.innerHTML = '';
    Object.keys(groups).forEach(function (g) {
      var info = groups[g];
      var st = R.counts(info.cards);
      var pct = st.total ? Math.round((st.known / st.total) * 100) : 0;
      var row = document.createElement('div');
      row.className = 'mastery-row';
      row.style.setProperty('--mc', info.color);
      row.innerHTML =
        '<div class="mr-head">' +
          '<span class="mr-name">' + escapeHtml(g) + '</span>' +
          '<span class="mr-num">' + st.known + '/' + st.total + '</span>' +
        '</div>' +
        '<div class="mr-track"><div class="mr-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="mr-sub">' + (st.due ? st.due + ' due now · ' : '') + st.unseen + ' new</div>';
      row.addEventListener('click', function () {
        $('filterGroup').value = g;
        startSession();
      });
      wrap.appendChild(row);
    });
  }

  /* ---------- highlights ---------- */
  function timeAgo(ts) {
    if (!ts) return '';
    var d = (Date.now() - ts) / 1000;
    if (d < 3600) return Math.max(1, Math.floor(d / 60)) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    if (d < 2592000) return Math.floor(d / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function paintHighlights() {
    var hs = R.allHighlights();
    var wrap = $('hlList');
    $('hlCount').textContent = hs.length ? hs.length + (hs.length === 1 ? ' highlight' : ' highlights') : '';
    if (!hs.length) {
      wrap.innerHTML = '<p class="rv-empty">Nothing highlighted yet. Select any passage while reading and pick a colour — it will resurface here so it does not just sit in a page you never reopen.</p>';
      return;
    }
    wrap.innerHTML = hs.slice(0, 40).map(function (h) {
      return '<a class="hl-card" href="' + escapeAttr(h.path) + '" style="--hc:var(--hl-' + escapeAttr(h.color) + ')">' +
        '<div class="hl-text">' + escapeHtml(h.text) + '</div>' +
        (h.note ? '<div class="hl-note">' + escapeHtml(h.note) + '</div>' : '') +
        '<div class="hl-meta">' + escapeHtml(prettyPage(h.page)) + ' · ' + timeAgo(h.createdAt) + '</div>' +
        '</a>';
    }).join('');
  }

  function prettyPage(slug) {
    if (!slug) return 'this site';
    var match = CARDS.filter(function (c) { return c.page === slug; })[0];
    return match ? match.pageTitle : slug.replace(/^\d+-/, '').replace(/-/g, ' ');
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  /* ---------- session ---------- */
  function startSession() {
    var group = $('filterGroup').value;
    var level = $('filterLevel').value;
    var limit = parseInt($('filterLimit').value, 10) || 20;

    queue = R.buildQueue(CARDS, {
      group: group || null,
      level: level || null,
      limit: limit,
    });

    if (!queue.length) {
      $('drillEmpty').hidden = false;
      $('drillEmpty').textContent = 'Nothing queued for that filter — everything there is scheduled for a later day. Try a wider filter, or come back tomorrow.';
      return;
    }
    $('drillEmpty').hidden = true;
    pos = 0;
    sessionStats = { again: 0, hard: 0, good: 0 };
    document.body.classList.add('in-session');
    $('reviewSetup').hidden = true;
    $('drillDone').hidden = true;
    $('drill').hidden = false;
    showCard();
  }

  function showCard() {
    var card = queue[pos];
    if (!card) return finishSession();
    revealed = false;

    $('drillChip').textContent = card.pageTitle;
    $('drillChip').style.setProperty('--dc', card.color);
    $('drillChip').href = 'topics/' + card.page + '.html';
    $('drillLevel').textContent = card.level;
    $('drillLevel').className = 'qa-level ' + card.level;
    $('drillCount').textContent = (pos + 1) + ' / ' + queue.length;
    $('drillProgress').style.width = (pos / queue.length * 100) + '%';

    var stateNote = R.isNew(card.id) ? 'New' : 'Review';
    $('drillState').textContent = stateNote;

    $('drillQ').innerHTML = card.q;
    $('drillA').innerHTML = card.a;
    $('drillA').hidden = true;
    $('drillReveal').hidden = false;
    $('drillRate').hidden = true;
    $('drillSource').href = 'topics/' + card.page + '.html';

    renderMath($('drillQ'));
    renderMath($('drillA'));
    $('drillReveal').focus({ preventScroll: true });
    /* keep the card itself in view — the stats above it would otherwise
       push the first question below the fold */
    if (pos === 0) {
      var top = $('drill').getBoundingClientRect().top + window.scrollY - 76;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    $('drillA').hidden = false;
    $('drillReveal').hidden = true;
    $('drillRate').hidden = false;
  }

  function answer(rating) {
    if (!revealed) return;
    var card = queue[pos];
    if (!card) return;
    R.rate(card.id, rating);
    sessionStats[rating] += 1;

    /* a lapsed card comes back at the end of this same session */
    if (rating === 'again') queue.push(card);

    pos += 1;
    if (pos >= queue.length) finishSession();
    else showCard();
  }

  function finishSession() {
    document.body.classList.remove('in-session');
    $('drill').hidden = true;
    $('drillDone').hidden = false;
    var total = sessionStats.again + sessionStats.hard + sessionStats.good;
    $('doneSummary').textContent = total + ' answered — ' +
      sessionStats.good + ' got it, ' + sessionStats.hard + ' shaky, ' + sessionStats.again + ' missed.';
    paintStats();
    paintMastery();
  }

  function exitSession() {
    document.body.classList.remove('in-session');
    $('drill').hidden = true;
    $('reviewSetup').hidden = false;
    paintStats();
    paintMastery();
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    R = window.KMLReview;
    CARDS = window.KML_QUESTIONS || [];
    if (!R || !CARDS.length) return;

    /* section filter options */
    var groups = [];
    CARDS.forEach(function (c) { if (groups.indexOf(c.group) === -1) groups.push(c.group); });
    var sel = $('filterGroup');
    groups.forEach(function (g) {
      var o = document.createElement('option');
      o.value = g; o.textContent = g;
      sel.appendChild(o);
    });

    /* deep-link: review.html?section=Foundations or ?page=08-... */
    var params = new URLSearchParams(location.search);
    if (params.get('section') && groups.indexOf(params.get('section')) > -1) {
      sel.value = params.get('section');
    }
    var pageParam = params.get('page');
    if (pageParam) {
      var pageCards = CARDS.filter(function (c) { return c.page === pageParam; });
      if (pageCards.length) {
        sel.value = pageCards[0].group;
        $('setupHint').textContent = 'Drilling ' + pageCards[0].pageTitle + '.';
      }
    }

    paintStats();
    paintMastery();
    paintHighlights();

    $('startBtn').addEventListener('click', function () {
      if (pageParam) {
        queue = R.buildQueue(CARDS, { page: pageParam, limit: parseInt($('filterLimit').value, 10) || 20 });
        if (!queue.length) { $('drillEmpty').hidden = false; return; }
        $('drillEmpty').hidden = true;
        pos = 0; sessionStats = { again: 0, hard: 0, good: 0 };
        document.body.classList.add('in-session');
        $('reviewSetup').hidden = true; $('drillDone').hidden = true; $('drill').hidden = false;
        showCard();
        return;
      }
      startSession();
    });
    $('drillReveal').addEventListener('click', reveal);
    $('drillExit').addEventListener('click', exitSession);
    $('doneAgain').addEventListener('click', function () { $('drillDone').hidden = true; $('reviewSetup').hidden = false; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-rate]'), function (b) {
      b.addEventListener('click', function () { answer(b.getAttribute('data-rate')); });
    });

    /* keyboard: space/enter reveals, 1-3 rate — drilling should not need a mouse */
    document.addEventListener('keydown', function (e) {
      if ($('drill').hidden) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); revealed ? answer('good') : reveal(); }
      else if (e.key === '1') { e.preventDefault(); answer('again'); }
      else if (e.key === '2') { e.preventDefault(); answer('hard'); }
      else if (e.key === '3') { e.preventDefault(); answer('good'); }
      else if (e.key === 'Escape') { e.preventDefault(); exitSession(); }
    });

    $('resetBtn').addEventListener('click', function () {
      if (!confirm('Reset all review progress? Your highlights and notes are not affected.')) return;
      R.reset();
      paintStats(); paintMastery();
    });
  });
})();
