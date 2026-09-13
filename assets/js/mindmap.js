/* mindmap.js — the whole site as one navigable graph.
 *
 * Nodes come from assets/js/map-data.js, which is generated from
 * content/manifest.json. Adding a topic means adding it to the manifest and
 * rebuilding; this file never needs touching, which is the point — the map has
 * to stay correct as the site grows rather than drifting into a lie.
 *
 * Rendering is Cytoscape rather than hand-rolled SVG. Pan, zoom, drag, edge
 * routing and hit-testing are all things a graph library has already solved
 * properly, and the 425KB only ever loads on this page.
 *
 * Layout is `preset` with positions computed below rather than a force
 * simulation. A force layout would rearrange itself on every visit, and a map
 * you cannot build a memory of is not much of a map.
 */
(function () {
  'use strict';

  var DATA = window.KML_MAP;
  var host = document.getElementById('map');
  if (!DATA || !host || typeof cytoscape === 'undefined') return;

  var css = getComputedStyle(document.documentElement);
  function tok(name, fallback) {
    var v = css.getPropertyValue(name).trim();
    return v || fallback || '#888';
  }

  /* ---------- positions ----------
     One column per group, pages stacked beneath it, and the columns wrap into
     rows. Eleven groups in a single row is ~3000px wide against a ~1240px
     stage, so fitting it shrank everything to unreadable. Wrapping at PER_ROW
     keeps the drawing's aspect near the stage's, which is what makes `fit`
     land at a legible zoom.

     Positions are computed, not simulated. A force layout rearranges itself on
     every visit, and a map you cannot build a memory of is not much of a map. */
  var COL = 268, ROW = 74, GAP_Y = 150, PER_ROW = 6;
  var nodes = [], edges = [], rowTop = 0, rowMax = 0;

  DATA.groups.forEach(function (g, gi) {
    var col = gi % PER_ROW;
    if (col === 0 && gi > 0) { rowTop += rowMax * ROW + GAP_Y; rowMax = 0; }
    rowMax = Math.max(rowMax, g.pages.length);

    var gid = 'g' + gi;
    nodes.push({
      data: { id: gid, label: g.name, kind: 'group', colour: tok(g.colour) },
      position: { x: col * COL, y: rowTop }
    });
    g.pages.forEach(function (p, pi) {
      nodes.push({
        data: {
          id: p.id, label: p.title, kind: p.kind, href: p.href,
          hook: p.hook, num: p.num || '', colour: tok(p.colour)
        },
        position: { x: col * COL, y: rowTop + 92 + pi * ROW }
      });
      edges.push({ data: { id: gid + '-' + p.id, source: gid, target: p.id, colour: tok(g.colour) } });
    });
    /* the spine threads the groups in reading order, including across a wrap */
    if (gi > 0) edges.push({ data: { id: 'sp' + gi, source: 'g' + (gi - 1), target: gid, kind: 'spine' } });
  });

  var cy = cytoscape({
    container: host,
    elements: { nodes: nodes, edges: edges },
    layout: { name: 'preset', fit: true, padding: 60 },
    minZoom: 0.25,
    maxZoom: 2.2,
    wheelSensitivity: 0.2,
    style: [
      { selector: 'node', style: {
          'label': 'data(label)', 'font-family': 'Inter, system-ui, sans-serif',
          'font-size': 11, 'font-weight': 600, 'color': tok('--text'),
          'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap',
          'text-max-width': 176, 'width': 204, 'height': 48, 'shape': 'round-rectangle',
          'background-color': tok('--bg-card'), 'border-width': 1.5,
          'border-color': tok('--border-hover'), 'transition-property': 'border-color background-color',
          'transition-duration': 140
      }},
      { selector: 'node[kind = "group"]', style: {
          'font-size': 12.5, 'font-weight': 800, 'color': tok('--bg'),
          'background-color': 'data(colour)', 'border-color': 'data(colour)',
          'width': 212, 'height': 42, 'shape': 'round-rectangle'
      }},
      { selector: 'node[kind = "lab"]', style: {
          'border-color': 'data(colour)', 'border-width': 2, 'shape': 'round-diamond',
          'width': 200, 'height': 58
      }},
      { selector: 'node[kind = "topic"]', style: { 'border-left-color': 'data(colour)' } },
      { selector: 'node:selected', style: {
          'border-color': 'data(colour)', 'border-width': 3,
          'background-color': tok('--bg-2')
      }},
      { selector: 'edge', style: {
          'width': 1.4, 'line-color': 'data(colour)', 'opacity': 0.35,
          'curve-style': 'taxi', 'taxi-direction': 'downward', 'taxi-turn': 30,
          'target-arrow-shape': 'none'
      }},
      { selector: 'edge[kind = "spine"]', style: {
          'width': 1.8, 'line-color': tok('--border-hover'), 'opacity': 0.5,
          'curve-style': 'unbundled-bezier', 'control-point-distances': [-26],
          'control-point-weights': [0.5], 'target-arrow-shape': 'triangle',
          'target-arrow-color': tok('--border-hover'), 'arrow-scale': 0.9
      }},
      { selector: '.faded', style: { 'opacity': 0.12 } },
      { selector: '.lit', style: { 'opacity': 1 } }
    ]
  });

  /* ---------- hover card ---------- */
  var tip = document.getElementById('mapTip');
  function showTip(n, pos) {
    if (!tip) return;
    var d = n.data();
    if (d.kind === 'group') {
      tip.innerHTML = '<div class="mt-kind">Group</div><div class="mt-title">' + d.label + '</div>' +
                      '<div class="mt-hook">' + n.outgoers('node').length + ' pages</div>';
    } else {
      tip.innerHTML = '<div class="mt-kind">' + (d.num || (d.kind === 'lab' ? 'Interactive' : '')) + '</div>' +
                      '<div class="mt-title">' + d.label + '</div>' +
                      '<div class="mt-hook">' + (d.hook || '') + '</div>' +
                      '<div class="mt-cta">Click to open</div>';
    }
    var r = host.getBoundingClientRect();
    tip.style.left = Math.min(pos.x, r.width - 280) + 'px';
    tip.style.top = Math.min(pos.y + 16, r.height - 130) + 'px';
    tip.classList.add('is-on');
  }

  cy.on('mouseover', 'node', function (e) {
    var n = e.target;
    cy.elements().addClass('faded');
    n.removeClass('faded');
    n.neighborhood().removeClass('faded');
    n.connectedEdges().removeClass('faded');
    showTip(n, e.renderedPosition || { x: 0, y: 0 });
    host.style.cursor = n.data('href') ? 'pointer' : 'default';
  });
  cy.on('mouseout', 'node', function () {
    cy.elements().removeClass('faded');
    if (tip) tip.classList.remove('is-on');
    host.style.cursor = '';
  });
  cy.on('tap', 'node', function (e) {
    var href = e.target.data('href');
    if (href) location.href = href;
  });

  /* ---------- controls ---------- */
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  on('mapFit', function () { cy.animate({ fit: { padding: 60 }, duration: 260 }); });
  on('mapIn', function () { cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: host.clientWidth / 2, y: host.clientHeight / 2 } }); });
  on('mapOut', function () { cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: host.clientWidth / 2, y: host.clientHeight / 2 } }); });

  var search = document.getElementById('mapSearch');
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      if (!q) { cy.elements().removeClass('faded lit'); return; }
      cy.elements().addClass('faded');
      var hits = cy.nodes().filter(function (n) {
        return (n.data('label') || '').toLowerCase().indexOf(q) !== -1 ||
               (n.data('hook') || '').toLowerCase().indexOf(q) !== -1;
      });
      hits.removeClass('faded').addClass('lit');
      if (hits.length === 1) cy.animate({ center: { eles: hits }, duration: 220 });
    });
  }

  /* Theme can change under us; re-read the tokens rather than keeping the
     colours we sampled at construction time. */
  new MutationObserver(function () {
    css = getComputedStyle(document.documentElement);
    cy.style().update();
    cy.nodes().forEach(function (n) {
      var g = DATA.groups.find(function (gr) { return gr.name === n.data('label'); });
      if (g) n.data('colour', tok(g.colour));
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
