/* KnowML — shared text-anchoring utilities.
   Locates and wraps the Nth occurrence of a text snippet within a root element.
   Used by both personal highlights (notes.js) and shared inline comments (community.js)
   so a repeated phrase on the page always resolves to the exact occurrence that was
   originally selected, not just the first match. */
(function () {
  'use strict';

  function walker(root) {
    return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.parentElement && n.parentElement.closest('script,style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
  }

  /* how many matches of `text` occur strictly before `range`'s start position */
  function computeOccurrence(root, range, text) {
    var w = walker(root);
    var node, count = 0;
    while ((node = w.nextNode())) {
      var isTarget = node === range.startContainer;
      var limit = isTarget ? range.startOffset : node.nodeValue.length;
      var idx = node.nodeValue.indexOf(text);
      while (idx > -1 && idx < limit) { count++; idx = node.nodeValue.indexOf(text, idx + 1); }
      if (isTarget) break;
    }
    return count;
  }

  /* find the `occurrence`-th match of `text` and wrap it using makeWrapper(); returns the wrapper or null */
  function wrapOccurrence(root, text, occurrence, makeWrapper) {
    if (!text || text.length < 2) return null;
    var w = walker(root);
    var node, count = 0;
    var target = occurrence || 0;
    while ((node = w.nextNode())) {
      var idx = node.nodeValue.indexOf(text);
      while (idx > -1) {
        if (count === target) {
          var range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + text.length);
          var wrapper = makeWrapper();
          try { range.surroundContents(wrapper); }
          catch (e) { return null; }
          return wrapper;
        }
        count++;
        idx = node.nodeValue.indexOf(text, idx + 1);
      }
    }
    return null;
  }

  window.KMLAnchor = { computeOccurrence: computeOccurrence, wrapOccurrence: wrapOccurrence };
})();
