/* KnowML — syntax highlighting for the "Try it" blocks.

   Self-contained rather than a CDN highlighter: the blocks are all Python, the
   token set needed is small, and a third-party script would be one more render-
   blocking dependency on every page for four code blocks.

   Two constraints shaped this:

   1. It must run BEFORE notes.js paints stored highlights. notes.js anchors on
      character offsets into the DOM, and wrapping tokens in <span> changes the
      element structure. Both read the same text content, so offsets are stable,
      but the paint order matters — hence the explicit event below rather than
      racing on DOMContentLoaded.

   2. It only ever touches <pre><code> inside .tryit. Prose code spans, KaTeX
      output and the attention lab's own markup are left completely alone. */
(function () {
  'use strict';

  var KEYWORD = /^(?:import|from|as|def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|with|lambda|print|break|continue|pass|yield|try|except|finally|raise|global|assert|del)$/;
  var BUILTIN = /^(?:range|len|enumerate|zip|list|dict|set|tuple|int|float|str|bool|sum|min|max|abs|round|sorted|reversed|map|filter|open|super|isinstance)$/;

  /* Order matters: comments and strings win over everything, so they come first
     and their contents are never re-scanned. */
  function tokenize(src) {
    var out = '';
    var re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d+\.?\d*(?:e[-+]?\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)|(\s+)|([^\s])/g;
    var m;
    while ((m = re.exec(src)) !== null) {
      if (m[1]) out += '<span class="tok-com">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tok-str">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tok-num">' + esc(m[3]) + '</span>';
      else if (m[4]) {
        var w = m[4];
        /* a name directly followed by "(" is being called */
        var after = src.slice(re.lastIndex);
        if (KEYWORD.test(w)) out += '<span class="tok-kw">' + esc(w) + '</span>';
        else if (BUILTIN.test(w)) out += '<span class="tok-bi">' + esc(w) + '</span>';
        else if (/^\s*\(/.test(after)) out += '<span class="tok-fn">' + esc(w) + '</span>';
        else out += esc(w);
      }
      else if (m[5]) out += m[5];
      else out += esc(m[6]);
    }
    return out;
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function run() {
    document.querySelectorAll('.tryit pre > code').forEach(function (code) {
      if (code.dataset.hl) return;
      code.dataset.hl = '1';
      code.innerHTML = tokenize(code.textContent);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
