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

  /* Copy button. Added here rather than in the markup so every existing and
     future Try it block gets one for free, and so the source text is captured
     before tokenize() replaces it with spans. */
  function addCopy(pre, source) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tryit-copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.innerHTML = ICON_COPY + '<span class="tryit-copy-label">Copy</span>';

    var resetAt = 0;
    btn.addEventListener('click', function (e) {
      e.preventDefault();          /* the button lives inside <details>; do not toggle it */
      e.stopPropagation();
      write(source).then(function (ok) {
        btn.classList.toggle('is-done', ok);
        btn.classList.toggle('is-failed', !ok);
        btn.innerHTML = (ok ? ICON_DONE : ICON_COPY) +
          '<span class="tryit-copy-label">' + (ok ? 'Copied' : 'Press ⌘C') + '</span>';
        var mine = ++resetAt;
        setTimeout(function () {
          if (mine !== resetAt) return;   /* a later click owns the button now */
          btn.classList.remove('is-done', 'is-failed');
          btn.innerHTML = ICON_COPY + '<span class="tryit-copy-label">Copy</span>';
        }, 1800);
      });
    });

    /* wrap so the button can be positioned against the panel rather than the
       <pre>, which scrolls horizontally on narrow screens */
    var shell = document.createElement('div');
    shell.className = 'tryit-codewrap';
    pre.parentNode.insertBefore(shell, pre);
    shell.appendChild(pre);
    shell.appendChild(btn);
  }

  /* navigator.clipboard needs a secure context, so it is absent on plain http://
     during local development. Fall back to a selection + execCommand, and if
     even that fails, leave the text selected so ⌘C works. */
  function write(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; },
                                                      function () { return legacy(text); });
    }
    return Promise.resolve(legacy(text));
  }
  function legacy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var ICON_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  function run() {
    /* .tryit blocks are the curated, runnable ones. Plain <pre><code> in the
       prose (page 29's fine-tuning pipeline, for instance) gets the same
       treatment — highlighted and copyable — without needing new markup. */
    document.querySelectorAll('.tryit pre > code, .content > section pre > code').forEach(function (code) {
      if (code.dataset.hl) return;
      code.dataset.hl = '1';
      var source = code.textContent;      /* capture before tokenising */
      code.innerHTML = tokenize(source);
      addCopy(code.parentNode, source);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
