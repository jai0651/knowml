/* KnowML — the small review surface on each topic page: an overall recall bar
   in the sidebar, plus a button to drill just this section right after reading
   it. Needs review.js and question-index.js; deliberately not the full bank. */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var R = window.KMLReview;
    var PAGES = window.KML_QUESTION_PAGES;
    if (!R || !PAGES) return;

    var sb = document.getElementById('sidebarLeft');
    if (!sb) return;

    var pageId = document.body.getAttribute('data-page-id');
    var slug = (location.pathname.split('/').pop() || '').replace('.html', '');
    var thisPage = PAGES.filter(function (p) { return p.pageId === pageId; })[0];

    var overall = R.overallMastery(PAGES);
    var mastery = R.masteryByPage(PAGES);

    /* ---- overall recall, under the existing reading-progress bar ---- */
    var host = document.getElementById('sidebarProgress');
    if (host && !document.getElementById('sbRecall')) {
      var block = document.createElement('div');
      block.className = 'sb-mastery';
      block.id = 'sbRecall';
      block.innerHTML =
        '<div class="sp-row"><span class="sp-label">Recall</span>' +
        '<span class="sp-count">' + overall.known + ' / ' + overall.total + '</span></div>' +
        '<div class="sb-mastery-track"><div class="sb-mastery-fill" style="width:' + overall.pct + '%"></div></div>';
      host.appendChild(block);
    }

    /* ---- drill this section ---- */
    if (thisPage && !document.getElementById('sbDrill')) {
      var m = mastery[pageId] || { known: 0, total: thisPage.count };
      var btn = document.createElement('a');
      btn.className = 'sb-drill-btn';
      btn.id = 'sbDrill';
      btn.href = '../review.html?page=' + encodeURIComponent(slug);
      btn.innerHTML = '↺ Drill this section <span style="opacity:.6;font-weight:600">' + m.known + '/' + m.total + '</span>';
      if (host) host.insertAdjacentElement('afterend', btn);
      else sb.insertBefore(btn, sb.firstChild);
    }
  });
})();
