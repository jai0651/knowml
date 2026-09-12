/* back-link.js — makes the nav's back control mean "where you came from".
 *
 * The control ships in the HTML as an ordinary link to the page's parent, so
 * with JavaScript off it still goes somewhere sensible. This file upgrades it:
 *
 *   - If you arrived from another page on this site, it says so ("← Roadmaps")
 *     and calls history.back(), which is the only way to restore the scroll
 *     position you left. A plain href would dump you at the top of a long page,
 *     which is the thing that makes people reach for the browser button again.
 *
 *   - If you arrived cold — a search result, a shared link, a new tab — there
 *     is nothing to go back to, so it keeps the parent href and labels it with
 *     the parent's name.
 *
 * Deliberately not used: sessionStorage breadcrumb trails. They drift out of
 * sync with real history the moment someone uses the browser's own back or
 * forward button, and then the label lies. document.referrer is what the
 * browser actually did.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* Friendly names for the pages someone is most likely to arrive from. Topic
     pages are not listed: their name is read out of the title at the end. */
  var NAMES = {
    'index.html': 'Home',
    'sections.html': 'Browse',
    'roadmaps.html': 'Roadmaps',
    'labs.html': 'Labs',
    'practice.html': 'Practice',
    'review.html': 'Review',
    'admin.html': 'Stats',
    'attention-lab.html': 'Attention Lab',
    'backprop-lab.html': 'Backprop Lab',
    'tokenizer-lab.html': 'Tokenizer Lab',
    'sampling-lab.html': 'Sampling Lab',
    'quantization-lab.html': 'Quantization Lab',
    'technique-map.html': 'Technique Map'
  };

  function fileOf(pathname) {
    var f = pathname.split('/').pop();
    return f || 'index.html';
  }

  /* "09-nlp-evolution.html" -> "09 · NLP Evolution" is not reliably derivable
     from the slug (casing, ampersands, acronyms), so numbered pages get their
     number and the generic word rather than a mangled guess. */
  function nameFor(file) {
    if (NAMES[file]) return NAMES[file];
    var m = file.match(/^(\d{2})-/);
    if (m) return 'Section ' + m[1];
    return 'Back';
  }

  ready(function () {
    var btn = document.getElementById('backBtn');
    if (!btn) return;

    var label = btn.querySelector('.bb-label');
    var fallback = btn.getAttribute('data-fallback');

    /* Label the fallback properly even when there is no referrer, so the
       control never just says "Home" on a page whose parent is not home. */
    if (label) label.textContent = nameFor(fileOf(new URL(fallback, location.href).pathname));

    var ref = document.referrer;
    if (!ref) return;

    var from;
    try { from = new URL(ref); } catch (e) { return; }
    if (from.origin !== location.origin) return;                 // off-site referrer
    if (from.pathname === location.pathname) return;             // reload, or an in-page anchor

    var file = fileOf(from.pathname);
    if (label) label.textContent = nameFor(file);
    btn.setAttribute('title', 'Back to ' + nameFor(file));
    btn.setAttribute('href', from.pathname + from.search + from.hash);

    btn.addEventListener('click', function (e) {
      /* Let modified clicks do what the reader asked — open in a new tab, save
         the link — rather than hijacking them into a history move. */
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      /* history.length is 1 only when this page is the whole session, in which
         case there is genuinely nothing behind us and the href should win. */
      if (history.length <= 1) return;
      e.preventDefault();
      history.back();
    });
  });
})();
