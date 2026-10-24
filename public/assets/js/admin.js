/* admin.js — the stats dashboard.
 *
 * Two states: a login form, or the dashboard. Which one renders is decided by
 * GET /api/admin/login, which reports whether admin is configured on this
 * deployment and whether the current cookie is valid. The cookie is httpOnly,
 * so this file cannot read it and does not try — the server is the only thing
 * that knows.
 *
 * No charting library. The daily chart is divs, which is plenty for two series
 * over at most a year and keeps the page dependency-free like the rest of the
 * site. */
(function () {
  'use strict';

  var root = document.getElementById('root');
  var days = 30;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

  function api(path, opts) {
    return fetch(path, Object.assign({ credentials: 'same-origin' }, opts || {}))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw Object.assign(new Error(body.error || r.statusText), { status: r.status, body: body });
          return body;
        });
      });
  }

  /* ---------- flag emoji from an ISO-3166 alpha-2 code ----------
     Regional indicator symbols sit at U+1F1E6 + (letter - 'A'). */
  function flag(cc) {
    if (!/^[A-Z]{2}$/.test(cc)) return '🏳';
    return String.fromCodePoint(...[...cc].map(function (c) { return 0x1f1e6 + c.charCodeAt(0) - 65; }));
  }
  var REGION = typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  function countryName(cc) {
    if (cc === '??') return 'Unknown';
    try { return (REGION && REGION.of(cc)) || cc; } catch (e) { return cc; }
  }

  /* ---------- login ---------- */
  function renderLogin(configured) {
    root.innerHTML = '';
    var box = el('div', 'ad-login');
    box.appendChild(el('h1', null, 'Stats'));
    box.appendChild(el('p', null, configured
      ? 'Sign in to see traffic for knowml.'
      : 'Admin is not configured on this deployment yet.'));

    if (!configured) {
      var note = el('div', 'ad-note');
      note.innerHTML =
        'Set three environment variables on Vercel, then redeploy:' +
        '<br><br><code>ADMIN_USER</code>, <code>ADMIN_PASSWORD_HASH</code>, <code>ADMIN_SECRET</code>' +
        '<br><br>Generate the last two with <code>node scripts/hash-admin-password.mjs</code>. ' +
        'Your password is never stored or deployed — only its scrypt digest is.';
      box.appendChild(note);
      root.appendChild(box);
      return;
    }

    var form = el('form');
    form.autocomplete = 'on';

    var u = el('label', 'ad-field');
    u.appendChild(el('span', null, 'Username'));
    var ui = el('input'); ui.type = 'text'; ui.name = 'username'; ui.autocomplete = 'username'; ui.required = true;
    u.appendChild(ui);

    var p = el('label', 'ad-field');
    p.appendChild(el('span', null, 'Password'));
    var pi = el('input'); pi.type = 'password'; pi.name = 'password'; pi.autocomplete = 'current-password'; pi.required = true;
    p.appendChild(pi);

    var btn = el('button', 'ad-btn', 'Sign in'); btn.type = 'submit';
    var err = el('div', 'ad-err');

    form.append(u, p, btn, err);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true; btn.textContent = 'Checking…';
      api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: ui.value, password: pi.value })
      }).then(function () {
        load();
      }).catch(function (e2) {
        err.textContent = e2.message || 'Sign-in failed';
        btn.disabled = false; btn.textContent = 'Sign in';
        pi.value = '';
        pi.focus();
      });
    });

    box.appendChild(form);
    root.appendChild(box);
    ui.focus();
  }

  /* ---------- dashboard ---------- */
  function rows(container, items, nameOf, hrefOf, primary, secondary) {
    var max = items.reduce(function (m, it) { return Math.max(m, primary(it)); }, 0) || 1;
    var list = el('div', 'ad-rows');
    if (!items.length) {
      list.appendChild(el('div', 'ad-empty', 'Nothing recorded yet in this window.'));
      container.appendChild(list);
      return;
    }
    items.forEach(function (it) {
      var r = el('div', 'ad-row');
      r.style.setProperty('--w', (primary(it) / max * 100).toFixed(1) + '%');
      var name = el('div', 'r-name');
      var href = hrefOf && hrefOf(it);
      if (href) {
        var a = el('a', null, nameOf(it)); a.href = href; a.target = '_blank'; a.rel = 'noopener';
        name.appendChild(a);
      } else {
        name.textContent = nameOf(it);
      }
      r.appendChild(name);
      r.appendChild(el('div', 'r-n', fmt(primary(it))));
      r.appendChild(el('div', 'r-n r-n--dim', secondary ? fmt(secondary(it)) : ''));
      list.appendChild(r);
    });
    container.appendChild(list);
  }

  function card(title, sub) {
    var c = el('div', 'ad-card');
    c.appendChild(el('h2', null, title));
    if (sub) c.appendChild(el('p', 'sub', sub));
    return c;
  }

  function pageHref(pageId) {
    // Page ids mirror the filenames: numbered ones live under topics/, the rest
    // at the root. Anything that does not resolve just opens a 404, which is a
    // smaller cost than not linking at all.
    if (/^\d{2}-/.test(pageId)) return './topics/' + pageId + '.html';
    if (pageId === '00-map-timeline') return './index.html';
    if (pageId === '00-sections') return './sections.html';
    return './' + pageId + '.html';
  }

  function renderDash(d) {
    root.innerHTML = '';

    var head = el('div', 'ad-head');
    head.appendChild(el('h1', null, 'Stats'));
    head.appendChild(el('div', 'spacer'));

    var range = el('div', 'ad-range');
    [[7, '7d'], [30, '30d'], [90, '90d'], [365, '1y']].forEach(function (pair) {
      var b = el('button', days === pair[0] ? 'is-on' : '', pair[1]);
      b.type = 'button';
      b.addEventListener('click', function () { days = pair[0]; load(); });
      range.appendChild(b);
    });
    head.appendChild(range);

    var out = el('button', 'ad-logout', 'Sign out');
    out.addEventListener('click', function () {
      api('/api/admin/logout', { method: 'POST' }).then(function () { renderLogin(true); });
    });
    head.appendChild(out);
    root.appendChild(head);

    var kpis = el('div', 'ad-kpis');
    [
      [d.totals.visitors24h, 'Visitors, last 24h'],
      [d.totals.views24h, 'Views, last 24h'],
      [d.totals.visitors, 'Visitor-days, ' + d.days + 'd'],
      [d.totals.views, 'Views, ' + d.days + 'd'],
      [d.totals.pages, 'Pages read, ' + d.days + 'd']
    ].forEach(function (k) {
      var c = el('div', 'ad-kpi');
      c.appendChild(el('div', 'k-num', fmt(k[0])));
      c.appendChild(el('div', 'k-lbl', k[1]));
      kpis.appendChild(c);
    });
    root.appendChild(kpis);

    /* daily chart */
    var chartCard = card('Traffic by day', 'Bars are views; the paler foot of each bar is unique visitors that day.');
    var max = d.daily.reduce(function (m, x) { return Math.max(m, x.views); }, 0) || 1;
    var chart = el('div', 'ad-chart');
    if (!d.daily.length) {
      chartCard.appendChild(el('div', 'ad-empty', 'No views recorded yet. The table fills as people arrive.'));
    } else {
      d.daily.forEach(function (x) {
        var bar = el('div', 'ad-bar');
        bar.setAttribute('data-tip', x.day + ' · ' + fmt(x.views) + ' views · ' + fmt(x.visitors) + ' visitors');
        var i = el('i'); i.style.height = Math.max(2, (x.views - x.visitors) / max * 150) + 'px';
        var u = el('u'); u.style.height = Math.max(2, x.visitors / max * 150) + 'px';
        bar.append(i, u);
        chart.appendChild(bar);
      });
      chartCard.appendChild(chart);
      var axis = el('div', 'ad-axis');
      axis.appendChild(el('span', null, d.daily[0].day));
      axis.appendChild(el('span', null, d.daily[d.daily.length - 1].day));
      chartCard.appendChild(axis);
      var legend = el('div', 'ad-legend');
      legend.innerHTML = '<span><i></i>repeat views</span><span><u></u>unique visitors</span>';
      chartCard.appendChild(legend);
    }
    root.appendChild(chartCard);

    /* pages + countries */
    var grid = el('div', 'ad-grid');

    var pc = card('Most read pages', 'Views, then unique visitors.');
    rows(pc, d.pages, function (x) { return x.pageId; }, function (x) { return pageHref(x.pageId); },
      function (x) { return x.views; }, function (x) { return x.visitors; });
    grid.appendChild(pc);

    var cc = card('Where people are', 'By country, from the edge network. No IP addresses are stored.');
    rows(cc, d.countries, function (x) { return flag(x.country) + '  ' + countryName(x.country); }, null,
      function (x) { return x.views; }, function (x) { return x.visitors; });
    grid.appendChild(cc);
    root.appendChild(grid);

    var grid2 = el('div', 'ad-grid');
    var rc = card('How they got here', 'External referrers only — internal navigation is not counted.');
    rows(rc, d.referrers, function (x) { return x.referrer; }, function (x) { return 'https://' + x.referrer; },
      function (x) { return x.views; }, null);
    grid2.appendChild(rc);

    var lc = card('Latest views', 'The 30 most recent, newest first.');
    var list = el('div', 'ad-rows');
    if (!d.recent.length) list.appendChild(el('div', 'ad-empty', 'Nothing yet.'));
    d.recent.forEach(function (x) {
      var r = el('div', 'ad-row');
      r.appendChild(el('div', 'r-name', x.pageId + (x.referrer ? '  ← ' + x.referrer : '')));
      r.appendChild(el('div', 'r-n', x.country ? flag(x.country) : '—'));
      r.appendChild(el('div', 'r-n r-n--dim', x.ts));
      list.appendChild(r);
    });
    lc.appendChild(list);
    grid2.appendChild(lc);
    root.appendChild(grid2);

    var foot = el('div', 'ad-foot');
    foot.innerHTML =
      'All-time, from the view counters that predate this dashboard: <strong>' + fmt(d.allTime.views) +
      '</strong> views and <strong>' + fmt(d.allTime.likes) + '</strong> likes.' +
      '<br>"Visitor-days" sums distinct visitors per day, so someone who returns on three days counts three times. ' +
      'The visitor id is a hash of IP, user-agent and a salt that rotates at UTC midnight — enough to count people ' +
      'within a day, useless for following anyone across days. No IP address is ever stored.';
    root.appendChild(foot);
  }

  /* ---------- boot ---------- */
  function load() {
    api('/api/admin/login').then(function (s) {
      if (!s.authenticated) { renderLogin(s.configured); return; }
      return api('/api/admin/stats?days=' + days).then(renderDash);
    }).catch(function (e) {
      if (e.status === 401) { renderLogin(true); return; }
      root.innerHTML = '';
      root.appendChild(el('div', 'ad-empty', 'Could not load: ' + (e.message || 'unknown error')));
    });
  }

  load();
})();
