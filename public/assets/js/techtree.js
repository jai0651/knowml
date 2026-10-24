/* KnowML — reusable collapsible technique tree.
   Data shape: an array of domain nodes, each optionally recursive:
   { name, color, children: [ { name, children: [...] } | { name, desc, href } ] }
   Branches (nodes with children) render as nested <details>; leaves render as
   a small card, linked to the topic page that covers it when `href` is given. */
(function () {
  'use strict';

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function countLeaves(node) {
    if (!node.children || !node.children.length) return 1;
    return node.children.reduce(function (sum, c) { return sum + countLeaves(c); }, 0);
  }

  function renderNode(node, topicsBase) {
    if (node.children && node.children.length) {
      var details = document.createElement('details');
      details.className = 'tt-node';
      if (node.color) details.style.setProperty('--tt-color', node.color);
      var summary = document.createElement('summary');
      summary.innerHTML =
        '<span class="tt-swatch"></span>' +
        '<span class="tt-label">' + escapeHtml(node.name) + '</span>' +
        (node.stub ? '<span class="tt-stub-tag">Coming next</span>' : '') +
        '<span class="tt-count">' + countLeaves(node) + '</span>';
      details.appendChild(summary);
      var group = document.createElement('div');
      group.className = 'tt-children';
      node.children.forEach(function (child) { group.appendChild(renderNode(child, topicsBase)); });
      details.appendChild(group);
      return details;
    }
    var leaf = document.createElement(node.page ? 'a' : 'div');
    leaf.className = 'tt-leaf';
    if (node.page) leaf.href = topicsBase + node.page + '.html';
    var descHtml = node.desc
      ? '<span class="tt-leaf-desc">' + escapeHtml(node.desc) + '</span>'
      : '<span class="tt-leaf-desc tt-leaf-desc-stub">Full write-up coming next.</span>';
    leaf.innerHTML = '<span class="tt-leaf-name">' + escapeHtml(node.name) + '</span>' + descHtml;
    return leaf;
  }

  /* topicsBase: relative path prefix to the /topics/ directory from the calling page
     (e.g. "./" from another page inside /topics/, or "topics/" from the homepage) */
  function render(containerEl, data, topicsBase) {
    containerEl.innerHTML = '';
    containerEl.classList.add('techtree');
    data.forEach(function (domain) { containerEl.appendChild(renderNode(domain, topicsBase || './')); });
  }

  /* live text filter: hides non-matching leaves, auto-opens branches that contain a match */
  function attachFilter(containerEl, inputEl) {
    inputEl.addEventListener('input', function () {
      var q = inputEl.value.trim().toLowerCase();
      var leaves = containerEl.querySelectorAll('.tt-leaf');
      leaves.forEach(function (leaf) {
        var text = leaf.textContent.toLowerCase();
        leaf.classList.toggle('tt-hidden', !!q && text.indexOf(q) === -1);
      });
      containerEl.querySelectorAll('.tt-node').forEach(function (node) {
        var hasVisibleLeaf = !!node.querySelector('.tt-leaf:not(.tt-hidden)');
        node.classList.toggle('tt-hidden', !!q && !hasVisibleLeaf);
        if (q && hasVisibleLeaf) node.open = true;
        if (!q) node.open = false;
      });
    });
  }

  function expandAll(containerEl, open) {
    containerEl.querySelectorAll('.tt-node').forEach(function (n) { n.open = open; });
  }

  window.KMLTechTree = { render: render, attachFilter: attachFilter, expandAll: expandAll };
})();
