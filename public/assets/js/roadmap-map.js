/* roadmap-map.js — turns each roadmap into a node graph.

   The page ships every stage as ordinary prose inside a .rm-track. This file
   reads those stages and builds a navigable map above them: one node per stage,
   joined by a rail (one connector per gap, drawn in CSS), with a hover card summarising what the stage buys you and
   a click that opens the stage itself.

   Progressive enhancement throughout. The collapsing is gated on
   html.js-roadmap, which this file adds, so with no JS every stage is simply
   visible and the page reads exactly as it did before — the no-JS state is the
   finished document, not a stack of empty headings.

   Each .rm-stage carries the two attributes the map needs:
     data-node  short label under the node
     data-goal  one line on what you can do once the stage is done
   Everything else — the stage number, the time estimate, the page count — is
   read back out of the stage's own markup, so there is one source of truth. */
(function () {
  'use strict';

  var doc = document.documentElement;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var tracks = document.querySelectorAll('.rm-track');
    if (!tracks.length) return;

    doc.classList.add('js-roadmap');

    Array.prototype.forEach.call(tracks, function (track) {
      var stages = track.querySelectorAll('.rm-stage');
      if (!stages.length) return;

      var map = document.createElement('div');
      map.className = 'rm-map';
      /* Not a tablist: these are disclosure buttons, each owning the stage it
         expands via aria-controls/aria-expanded. Claiming a tablist role would
         promise arrow-key tab semantics and a tabpanel that is not there. */
      map.setAttribute('role', 'group');
      map.setAttribute('aria-label', 'Stages in this roadmap');

      var nodes = [];

      Array.prototype.forEach.call(stages, function (stage, i) {
        var num = stage.querySelector('.rm-num');
        var time = stage.querySelector('.rm-time');
        var pages = stage.querySelectorAll('.order-strip a').length;

        /* Stage numbering is authored, not derived: roadmap D starts at
           "Stage 0" on purpose, because its first step is a self-assessment
           rather than reading. Take whatever the markup says. */
        var numText = num ? num.textContent.trim() : 'Stage ' + (i + 1);
        var shortNum = numText.replace(/^Stage\s*/i, '');

        var id = (track.getAttribute('data-track') || 't') + '-' + i;
        stage.id = stage.id || 'rm-stage-' + id;

        var wrap = document.createElement('div');
        wrap.className = 'rm-node-wrap';

        var btn = document.createElement('button');
        btn.className = 'rm-node';
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', stage.id);
        btn.innerHTML =
          '<span class="rm-dot">' + shortNum + '</span>' +
          '<span class="rm-node-label">' + (stage.getAttribute('data-node') || numText) + '</span>' +
          '<span class="rm-node-help" aria-hidden="true">?</span>';

        var pop = document.createElement('span');
        pop.className = 'rm-pop';
        pop.setAttribute('role', 'note');
        pop.innerHTML =
          '<span class="rm-pop-title">' + numText + '</span>' +
          '<span class="rm-pop-goal">' + (stage.getAttribute('data-goal') || '') + '</span>' +
          '<span class="rm-pop-meta">' +
            (pages ? pages + (pages === 1 ? ' page' : ' pages') : 'no reading') +
            (time ? ' · ' + time.textContent.trim() : '') +
          '</span>' +
          '<span class="rm-pop-cta">click to open this stage</span>';

        wrap.appendChild(btn);
        wrap.appendChild(pop);
        map.appendChild(wrap);

        nodes.push({ btn: btn, stage: stage });

        btn.addEventListener('click', function () { toggle(i); });
        btn.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          nodes[(i + d + nodes.length) % nodes.length].btn.focus();
        });
      });

      track.insertBefore(map, track.firstChild);

      function toggle(i) {
        var opening = !nodes[i].stage.classList.contains('is-open');
        /* One stage open per track. Two open at once turns the map back into
           the wall of text it replaced. */
        nodes.forEach(function (n, j) {
          var on = opening && j === i;
          n.stage.classList.toggle('is-open', on);
          n.btn.classList.toggle('is-active', on);
          n.btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        });
        if (opening) revealTrack(nodes[i].stage);
      }
    });

    /* ---------- map / full-text switch ---------- */
    var host = document.querySelector('.rm-modebar');
    if (host) {
      host.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-rm-mode]');
        if (!btn) return;
        var text = btn.getAttribute('data-rm-mode') === 'text';
        doc.classList.toggle('rm-text-mode', text);
        host.querySelectorAll('[data-rm-mode]').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        /* Leaving full-text mode would otherwise strand every stage open, so
           the map would claim nothing is selected while everything was. */
        if (!text) {
          document.querySelectorAll('.rm-stage.is-open').forEach(function (s) {
            s.classList.remove('is-open');
          });
          document.querySelectorAll('.rm-node.is-active').forEach(function (b) {
            b.classList.remove('is-active');
            b.setAttribute('aria-expanded', 'false');
          });
        }
      });
    }

    /* A deep link to a stage should open it rather than scroll to a collapsed
       shell. Same for the browser's own find-on-page landing inside one. */
    if (location.hash) openFromHash();
    window.addEventListener('hashchange', openFromHash);

    function openFromHash() {
      var el = document.querySelector(location.hash.replace(/[^#\w-]/g, ''));
      if (!el) return;
      var stage = el.closest ? el.closest('.rm-stage') : null;
      if (!stage) return;
      var btn = document.querySelector('[aria-controls="' + stage.id + '"]');
      if (btn && !stage.classList.contains('is-open')) btn.click();
    }
  });

  /* Scroll the whole track, not the opened stage. Bringing the stage to the top
     pushes the map off screen, and the map is how you get to the next stage —
     losing it after every click makes the graph feel like a one-shot menu. If
     the map is already comfortably in view, don't move at all. */
  function revealTrack(stage) {
    var track = stage.closest('.rm-track');
    if (!track) return;
    var map = track.querySelector('.rm-map');
    var navH = 62;                       /* the sticky top bar */
    var r = (map || track).getBoundingClientRect();
    if (r.top >= navH && r.top <= window.innerHeight * 0.45) return;
    window.scrollTo({ top: window.scrollY + r.top - navH - 14, behavior: 'smooth' });
  }
})();
