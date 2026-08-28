/* KnowML — spaced-repetition engine.
   A simplified SM-2: every card carries an ease factor and an interval in days.
   Rating a card adjusts both and schedules the next showing. State lives in
   localStorage, so a learner's schedule is per-browser, like their notes.

   Loaded on every topic page (for the sidebar mastery widget) and on the
   Review page (for the drill itself). Deliberately has no dependency on the
   full question bank — topic pages only load the tiny question-index. */
(function () {
  'use strict';

  var CARDS_KEY = 'kml-review::cards';
  var STREAK_KEY = 'kml-review::streak';
  var DAY = 86400000;

  var MIN_EASE = 1.3;
  var MAX_EASE = 2.8;
  var START_EASE = 2.5;
  /* a card counts as "known" once it has survived to a 3-day gap */
  var KNOWN_INTERVAL = 3;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function loadCards() { return readJson(CARDS_KEY, {}); }
  function saveCards(state) { writeJson(CARDS_KEY, state); }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  /* ---------- scheduling ---------- */
  function rate(cardId, rating) {
    var state = loadCards();
    var c = state[cardId] || { ease: START_EASE, interval: 0, reps: 0, lapses: 0, due: 0, last: null };

    if (rating === 'again') {
      c.ease = clamp(c.ease - 0.2, MIN_EASE, MAX_EASE);
      c.interval = 0;
      c.reps = 0;
      c.lapses += 1;
    } else if (rating === 'hard') {
      c.ease = clamp(c.ease - 0.15, MIN_EASE, MAX_EASE);
      /* always gain at least a day, or repeated "hard" sticks at 1 forever */
      c.interval = c.reps === 0 ? 1 : Math.max(c.interval + 1, Math.round(c.interval * 1.2));
      c.reps += 1;
    } else { /* good */
      if (c.reps === 0) c.interval = 1;
      else if (c.reps === 1) c.interval = 3;
      else c.interval = Math.round(c.interval * c.ease);
      c.reps += 1;
    }

    c.last = rating;
    c.seenAt = Date.now();
    /* interval 0 means "show again later in this same session" */
    c.due = c.interval === 0 ? Date.now() : Date.now() + c.interval * DAY;
    state[cardId] = c;
    saveCards(state);
    touchStreak();
    return c;
  }

  function isDue(cardId, state) {
    var c = (state || loadCards())[cardId];
    if (!c) return false;
    return c.due <= Date.now();
  }
  function isNew(cardId, state) {
    return !(state || loadCards())[cardId];
  }

  /* status is what the mastery bars report: unseen | learning | known */
  function status(cardId, state) {
    var c = (state || loadCards())[cardId];
    if (!c || c.reps === 0) return c ? 'learning' : 'unseen';
    return c.interval >= KNOWN_INTERVAL ? 'known' : 'learning';
  }

  /* Build a session queue: everything due first (oldest due first), then new
     cards, capped so a session stays finishable. */
  function buildQueue(cards, opts) {
    opts = opts || {};
    var state = loadCards();
    var limit = opts.limit || 9999;

    var pool = cards.filter(function (c) {
      if (opts.page && c.page !== opts.page) return false;
      if (opts.group && c.group !== opts.group) return false;
      if (opts.level && c.level !== opts.level) return false;
      return true;
    });

    var due = pool.filter(function (c) { return !isNew(c.id, state) && isDue(c.id, state); });
    var fresh = pool.filter(function (c) { return isNew(c.id, state); });

    due.sort(function (a, b) { return state[a.id].due - state[b.id].due; });
    if (opts.shuffle !== false) shuffle(fresh);

    return due.concat(fresh).slice(0, limit);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- stats ---------- */
  function counts(cards) {
    var state = loadCards();
    var out = { total: cards.length, unseen: 0, learning: 0, known: 0, due: 0 };
    cards.forEach(function (c) {
      var s = status(c.id, state);
      out[s] += 1;
      if (!isNew(c.id, state) && isDue(c.id, state)) out.due += 1;
    });
    return out;
  }

  /* Mastery per page, derived from the tiny question-index rather than the
     full bank, so topic pages can show it without loading 160KB. */
  function masteryByPage(pageList) {
    var state = loadCards();
    var byPage = {};
    Object.keys(state).forEach(function (id) {
      var pageId = id.split('::')[0];
      if (!byPage[pageId]) byPage[pageId] = { known: 0, learning: 0 };
      var s = status(id, state);
      if (s === 'known') byPage[pageId].known += 1;
      else if (s === 'learning') byPage[pageId].learning += 1;
    });
    var out = {};
    (pageList || []).forEach(function (p) {
      var m = byPage[p.pageId] || { known: 0, learning: 0 };
      out[p.pageId] = {
        total: p.count,
        known: m.known,
        learning: m.learning,
        pct: p.count ? Math.round((m.known / p.count) * 100) : 0,
      };
    });
    return out;
  }

  function overallMastery(pageList) {
    var m = masteryByPage(pageList);
    var known = 0, total = 0;
    Object.keys(m).forEach(function (k) { known += m[k].known; total += m[k].total; });
    return { known: known, total: total, pct: total ? Math.round((known / total) * 100) : 0 };
  }

  /* ---------- streak ---------- */
  function touchStreak() {
    var s = readJson(STREAK_KEY, { last: null, count: 0 });
    var t = today();
    if (s.last === t) return s;
    var yesterday = new Date(Date.now() - DAY);
    var y = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    s.count = s.last === y ? s.count + 1 : 1;
    s.last = t;
    writeJson(STREAK_KEY, s);
    return s;
  }
  function streak() {
    var s = readJson(STREAK_KEY, { last: null, count: 0 });
    if (!s.last) return 0;
    var t = today();
    var yesterday = new Date(Date.now() - DAY);
    var y = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    /* a streak stays alive until the end of the following day */
    return (s.last === t || s.last === y) ? s.count : 0;
  }

  /* ---------- highlights, pulled back out of the notes store ---------- */
  function allHighlights() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key.indexOf('np-notes::') !== 0) continue;
      var path = key.slice('np-notes::'.length);
      var data;
      try { data = JSON.parse(localStorage.getItem(key)); } catch (e) { continue; }
      if (!data || !data.highlights) continue;
      data.highlights.forEach(function (h) {
        out.push({
          id: h.id, text: h.text, note: h.note || '', color: h.color,
          createdAt: h.createdAt || 0, path: path,
          page: (path.split('/').pop() || '').replace('.html', ''),
        });
      });
    }
    out.sort(function (a, b) { return b.createdAt - a.createdAt; });
    return out;
  }

  function reset() {
    try { localStorage.removeItem(CARDS_KEY); localStorage.removeItem(STREAK_KEY); } catch (e) {}
  }

  window.KMLReview = {
    rate: rate,
    status: status,
    isDue: isDue,
    isNew: isNew,
    buildQueue: buildQueue,
    counts: counts,
    masteryByPage: masteryByPage,
    overallMastery: overallMastery,
    streak: streak,
    allHighlights: allHighlights,
    loadCards: loadCards,
    reset: reset,
    shuffle: shuffle,
  };
})();
