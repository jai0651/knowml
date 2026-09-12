/* home-scroll.js — scroll-driven motion for the homepage.

   Two mechanisms, both progressive enhancement:

     1. REVEAL. Elements marked [data-reveal] fade and lift in when they first
        enter the viewport. The hidden starting state lives behind
        html.js-reveal, which this file adds. If the file never loads, the class
        is never added, the rule never matches, and everything is simply
        visible — the no-JS state is the finished page, not a blank one.

     2. SCRUB. Containers marked [data-scrub] get a --p custom property holding
        their progress through the viewport, 0 to 1. CSS decides what to do with
        it. The era rail translates horizontally; the hero deck rotates and
        recedes. Nothing here reads or writes .style.transform directly, so it
        cannot fight the pointer parallax in app.js, which writes a different
        set of properties into the same composed transform.

   Both are skipped entirely under prefers-reduced-motion. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Added before first paint so revealed elements never flash in at full
     opacity and then hide. Skipped under reduced motion so the starting state
     is never applied at all. */
  if (!reduced) doc.classList.add('js-reveal');

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var revealTargets = document.querySelectorAll('[data-reveal]');
    var scrubTargets = document.querySelectorAll('[data-scrub]');
    if (!revealTargets.length && !scrubTargets.length) return;

    /* ---------- 1 · reveal ---------- */
    if (reduced) {
      /* Belt and braces: the CSS already no-ops, but if anything else ever
         keys off .in, give it the truthful answer. */
      Array.prototype.forEach.call(revealTargets, function (el) { el.classList.add('in'); });
    } else if (!('IntersectionObserver' in window)) {
      doc.classList.remove('js-reveal');
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          io.unobserve(entry.target);          /* reveal once, not on every pass */
        });
      }, {
        /* Fire a little before the element is fully on screen, and require a
           sliver of it rather than a fraction of its height — tall elements
           would otherwise never hit a percentage threshold. */
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.01
      });
      Array.prototype.forEach.call(revealTargets, function (el) { io.observe(el); });

      /* Anything already in view at load reveals immediately: the observer
         fires for those too, but this avoids a frame of blank hero. */
      requestAnimationFrame(function () {
        Array.prototype.forEach.call(revealTargets, function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
        });
      });
    }

    /* ---------- 2 · scrub ---------- */
    if (reduced || !scrubTargets.length) return;

    var heroDeck = document.getElementById('hvDeck');
    var raf = null;

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    function measure() {
      raf = null;
      var vh = window.innerHeight;

      Array.prototype.forEach.call(scrubTargets, function (el) {
        var r = el.getBoundingClientRect();
        /* 0 when the top edge is at the bottom of the viewport, 1 when the
           bottom edge has passed the top. Denominator is the total distance
           travelled, so the ramp is the same speed for short and tall acts. */
        var travelled = vh - r.top;
        var total = vh + r.height;
        var p = clamp01(travelled / total);
        el.style.setProperty('--p', p.toFixed(4));

        /* The hero deck gets its own treatment: as the hero scrolls away the
           deck tips back and recedes, so leaving the hero feels like stepping
           through it rather than past it. Only the downward half of the range
           is used — the hero starts at the top of the page, so p starts near
           .5 and only ever increases. */
        if (heroDeck && el.getAttribute('data-scrub') === 'hero') {
          var out = clamp01((p - 0.5) * 2);        /* 0 at rest → 1 fully gone */
          heroDeck.style.setProperty('--sr', (out * 9).toFixed(2) + 'deg');
          heroDeck.style.setProperty('--sz', (-out * 120).toFixed(1) + 'px');
        }
      });
    }

    function onScroll() { if (!raf) raf = requestAnimationFrame(measure); }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    measure();
  });
})();
