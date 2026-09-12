/* KnowML — Tokenizer Lab: training a byte-pair-encoding tokenizer one merge at a
   time, then using it. Every step is one primitive operation — one pair count,
   one argmax, one merge, one rule applied — never several folded together, so
   stepping through matches how you would trace the algorithm by hand.

   Unlike the Attention Lab this one is mostly strings rather than matrices. The
   one genuine matrix is the pair-count table (left symbol × right symbol), which
   is rendered with the shared matrixPanel; token sequences are chips built with
   KMLLabUI.el, following the tokenStrip() pattern from attention-lab-steps.js. */
(function () {
  'use strict';
  var M = window.KMLLabMath, Mo = window.TokenizerLabModel, UI = window.KMLLabUI, CFG = Mo.CFG;

  var TRAIN = Mo.TRAIN, CURVE = Mo.CURVE, CHECKS = Mo.CHECKS, LM = Mo.LETTERMAP;
  var STATS = Mo.CORPUS_STATS;

  /* per-tab step metadata, filled during build(), read back by dimFix() so the
     dimension chips can track what the reader has actually stepped through */
  var META = {};

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  /* the shared ledger is exposed by reference, so panels this file builds by
     hand can register themselves exactly like the built-in ones do */
  function noteLedger(name, shapeLabel, meaning) {
    var L = UI.getLedger();
    if (L) L.push({ name: name, shapeLabel: shapeLabel, meaning: meaning || '' });
  }

  // ---------- token chips ----------
  // colour is a direct read-out of how many characters a symbol swallowed:
  // grey = still a bare character, hotter = more merges deep.
  var LEN_COLORS = ['#94a3b8', '#60a5fa', '#4ade80', '#facc15', '#f472b6'];
  function symColor(sym) {
    if (!Mo.inVocab(sym)) return '#f87171';
    return LEN_COLORS[Math.min(sym.length, LEN_COLORS.length) - 1];
  }
  function defaultSub(sym) { return Mo.inVocab(sym) ? 'id ' + Mo.VOCAB_ID[sym] : 'no id'; }

  function tokenChips(tokens, opts) {
    opts = opts || {};
    var wrap = UI.el('div', 'lab-tokens');
    if (opts.maxWidth !== false) wrap.style.maxWidth = (opts.maxWidth || 640) + 'px';
    tokens.forEach(function (t, i) {
      var hot = opts.active && opts.active.indexOf(i) !== -1;
      var chip = UI.el('div', 'lab-token' + (hot ? ' lab-token--active' : ''));
      chip.style.setProperty('--tc', opts.color ? opts.color(t, i) : symColor(t));
      var sub = opts.sub === false ? '' : (opts.sub ? opts.sub(t, i) : defaultSub(t));
      chip.innerHTML = '<span class="lab-token-word">' + esc(t) + '</span>' +
        (sub ? '<span class="lab-token-id">' + esc(sub) + '</span>' : '');
      wrap.appendChild(chip);
    });
    return wrap;
  }

  // a lab-panel with an arbitrary body, matching the shared panels' chrome
  function panel(opts, body) {
    var wrap = UI.el('div', 'lab-panel' + (opts.dim ? ' lab-panel--dim' : '') + (opts.fresh ? ' lab-panel--new' : ''));
    var head = UI.el('div', 'lab-panel-head');
    head.appendChild(UI.el('span', 'lab-panel-title', opts.title));
    if (opts.shapeLabel) head.appendChild(UI.el('span', 'lab-panel-shape', opts.shapeLabel));
    wrap.appendChild(head);
    if (opts.badge) wrap.appendChild(UI.el('div', 'lab-panel-badge', opts.badge));
    wrap.appendChild(body);
    if (opts.meaning) wrap.appendChild(UI.el('div', 'lab-panel-meaning', opts.meaning));
    noteLedger(opts.title, opts.shapeLabel || '', opts.meaning || '');
    return wrap;
  }

  function tokenPanel(opts) { return panel(opts, tokenChips(opts.tokens, opts)); }

  function tablePanel(opts, head, rows) {
    var t = UI.el('table', 'lab-table');
    t.innerHTML = '<thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>';
    var tb = UI.el('tbody');
    rows.forEach(function (r) {
      var tr = UI.el('tr', r.highlight ? 'lab-row--highlight' : '');
      r.cells.forEach(function (c) {
        var td = UI.el('td');
        if (c instanceof Node) td.appendChild(c); else td.innerHTML = c;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return panel(opts, t);
  }

  // ---------- the one real matrix: adjacent-pair counts ----------
  // matrixPanel formats every cell as a 2-decimal float, which is the right call
  // for activations and the wrong one for integer counts, so the cell text is
  // rewritten in place afterwards. The numbers are untouched.
  function countPanel(opts) {
    var p = UI.matrixPanel({
      title: opts.title, shapeLabel: opts.shapeLabel, matrix: opts.matrix,
      rowLabels: opts.rowLabels, colLabels: opts.colLabels,
      colorMode: 'diverging', maxAbs: opts.maxAbs, meaning: opts.meaning,
      fresh: opts.fresh, dim: opts.dim
    });
    var cells = p.querySelectorAll('.lab-grid > .lab-cell:not(.lab-cell--head):not(.lab-cell--corner)');
    var cols = opts.matrix[0].length;
    for (var i = 0; i < cells.length; i++) {
      var r = Math.floor(i / cols), c = i % cols, v = opts.matrix[r][c];
      cells[i].textContent = v === 0 ? '·' : String(v);
      if (v === 0) { cells[i].style.background = 'var(--bg-card)'; cells[i].style.color = 'var(--text-faint)'; }
      if (opts.winner && opts.winner[0] === r && opts.winner[1] === c) cells[i].classList.add('lab-cell--fresh-row');
      if (opts.outline && opts.outline.some(function (p) { return p[0] === r && p[1] === c; })) cells[i].classList.add('lab-cell--fresh-row');
    }
    return p;
  }

  function pairCountPanel(round, opts) {
    opts = opts || {};
    var pc = round.pairs;
    var wi = pc.rows.indexOf(round.a), wj = pc.cols.indexOf(round.b);
    return countPanel({
      title: opts.title || 'pair counts',
      shapeLabel: pc.rows.length + ' left × ' + pc.cols.length + ' right symbols',
      matrix: pc.matrix, rowLabels: pc.rows, colLabels: pc.cols,
      maxAbs: pc.best.count, winner: opts.noWinner ? null : [wi, wj], fresh: opts.fresh,
      meaning: opts.meaning || ('Cell (a, b) = how often symbol b follows symbol a across the corpus, weighted by word frequency. ' +
        pc.nPairs + ' of the ' + (pc.rows.length * pc.cols.length) + ' cells are non-zero.')
    });
  }

  function rankPanel(round, n, opts) {
    opts = opts || {};
    var pc = round.pairs, top = pc.ranked.slice(0, n || 5);
    return tablePanel({
      title: opts.title || 'pairs, ranked by count',
      shapeLabel: 'top ' + top.length + ' of ' + pc.nPairs,
      meaning: opts.meaning || ''
    }, ['pair', 'merged', 'count', ''], top.map(function (r, i) {
      var tied = r.count === pc.best.count;
      return {
        highlight: i === 0,
        cells: [
          '(' + esc(r.a) + ', ' + esc(r.b) + ')', '<strong>' + esc(r.a + r.b) + '</strong>', String(r.count),
          i === 0 ? 'winner' : (tied ? 'tie — seen later' : '')
        ]
      };
    }));
  }

  // ---------- corpus splits, one row per word ----------
  function splitsPanel(splits, opts) {
    opts = opts || {};
    var rows = Mo.WORDS.map(function (w) {
      var seq = splits[w];
      return {
        cells: [
          '<strong>' + esc(w) + '</strong>', '×' + Mo.FREQ[w],
          tokenChips(seq, { active: opts.active ? opts.active[w] : null, sub: opts.sub === false ? false : function (s) { return String(s.length) + 'c'; }, maxWidth: 460 }),
          String(seq.length)
        ]
      };
    });
    return tablePanel({
      title: opts.title || 'corpus, split into symbols',
      shapeLabel: opts.shapeLabel || (Mo.WORDS.length + ' word types · ' + Mo.totalTokens(splits) + ' tokens of text'),
      dim: opts.dim, fresh: opts.fresh, meaning: opts.meaning
    }, ['word', 'freq', 'symbols', 'len'], rows);
  }

  function vocabPanel(vocab, opts) {
    opts = opts || {};
    return tokenPanel({
      title: opts.title || 'vocabulary',
      shapeLabel: '|V| = ' + vocab.length,
      tokens: vocab, active: opts.active, maxWidth: 560, fresh: opts.fresh, dim: opts.dim,
      sub: function (s) { return 'id ' + Mo.VOCAB_ID[s]; },
      meaning: opts.meaning
    });
  }

  function mergeListPanel(upto, highlight) {
    var rows = TRAIN.rounds.slice(0, upto).map(function (r) {
      return {
        highlight: r.k === highlight,
        cells: ['#' + (r.k + 1), '(' + esc(r.a) + ', ' + esc(r.b) + ')', '<strong>' + esc(r.sym) + '</strong>',
                String(r.count), 'id ' + Mo.VOCAB_ID[r.sym]]
      };
    });
    return tablePanel({
      title: 'the merge list', shapeLabel: rows.length + ' rules, in order',
      meaning: 'This ordered list plus the ' + Mo.baseVocab.length + ' base characters <em>is</em> the tokenizer. Nothing else is stored.'
    }, ['rank', 'pair', 'new symbol', 'count when learned', 'vocab'], rows);
  }

  // ============================================================ TAB 1 · TRAIN ============================================================
  function buildTrain() {
    var steps = [], meta = [];
    function push(step, mergesApplied) { steps.push(step); meta.push({ merges: mergesApplied }); }
    META.train = meta;

    push({
      title: 'The corpus: ' + STATS.tokensOfText + ' words, ' + STATS.types + ' of them distinct',
      formula: null,
      note: 'A tokenizer is <strong>trained</strong>, not designed. Every symbol this page ends up with is derived from the ' + STATS.chars + ' characters below and nothing else — no dictionary, no grammar, no list of English suffixes. The only signal BPE ever uses is <strong>how often things sit next to each other</strong>, so each word carries a frequency.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'training corpus', shapeLabel: STATS.types + ' types · ' + STATS.tokensOfText + ' occurrences · ' + STATS.chars + ' characters',
          meaning: 'Frequency is the whole input. A word that occurs ' + Mo.FREQ['berry'] + '× pulls ' + Mo.FREQ['berry'] + '× harder on every pair it contains.'
        }, ['word', 'occurrences', 'characters', 'contributes'], CFG.corpus.map(function (p) {
          return { cells: ['<strong>' + esc(p[0]) + '</strong>', '×' + p[1], String(p[0].length), (p[0].length * p[1]) + ' chars'] };
        })));
        stage.appendChild(UI.textCard('Deliberately berry-heavy, and deliberately missing the one word this lab is really about: <code>strawberry</code> never appears. Neither does <code>blueberries</code>. Both get encoded later anyway — that is the point of subword tokenization.', 'note'));
      }
    }, 0);

    push({
      title: 'Split every word into characters',
      formula: 's_w \\leftarrow (c_1, c_2, \\ldots, c_{|w|}) \\qquad V_0 = \\{\\text{distinct characters}\\}',
      note: 'The starting vocabulary is just the alphabet the corpus happens to contain — <strong>' + Mo.baseVocab.length + ' characters</strong>, each its own token. At this point the tokenizer is useless but lossless: it can represent anything spelled with these letters, and it needs ' + CURVE[0].totalTokens + ' tokens to represent ' + STATS.tokensOfText + ' words. Every merge from here trades vocabulary size for sequence length.',
      render: function (stage) {
        stage.appendChild(splitsPanel(TRAIN.rounds[0].before, {
          title: 'corpus at 0 merges', meaning: 'Every symbol is one character, so token count = character count exactly: ' + CURVE[0].totalTokens + '.'
        }));
        stage.appendChild(vocabPanel(Mo.baseVocab, {
          title: 'V₀ — base vocabulary',
          meaning: 'Sorted, deduplicated characters. Note what is <em>not</em> here: no <code>c</code>, no <code>n</code>. The corpus never used them, so this tokenizer has no id for them at all.'
        }));
      }
    }, 0);

    var r0 = TRAIN.rounds[0];
    push({
      title: 'Count every adjacent pair',
      formula: '\\text{count}(a,b) \\;=\\; \\sum_{w \\in \\text{corpus}} \\text{freq}(w) \\cdot \\#\\{\\, i : s_i = a,\\ s_{i+1} = b \\,\\}',
      note: 'One pass over the corpus, counting adjacent symbol pairs — weighted by word frequency, so <code>berry</code> at ×' + Mo.FREQ['berry'] + ' adds ' + Mo.FREQ['berry'] + ' to each of its ' + (r0.before['berry'].length - 1) + ' pairs. This is the only measurement BPE ever makes. Below it is laid out as a genuine matrix: row = left symbol, column = right symbol.',
      render: function (stage) {
        stage.appendChild(pairCountPanel(r0, { noWinner: true, fresh: true }));
        stage.appendChild(rankPanel(r0, 6, {
          title: 'the same counts, ranked',
          meaning: 'Only ' + r0.pairs.nPairs + ' distinct pairs exist in a corpus this small. A real corpus has millions, and the count pass is by far the expensive part of training a tokenizer.'
        }));
      }
    }, 0);

    push({
      title: 'Take the argmax — and notice the tie',
      formula: '(a^\\*, b^\\*) = \\arg\\max_{(a,b)} \\text{count}(a,b)',
      note: '<strong>' + r0.tiedCount + ' pairs</strong> are tied at ' + r0.count + ': ' + r0.tiedWith.map(function (t) { return '<code>(' + esc(t.a) + ', ' + esc(t.b) + ')</code>'; }).join(', ') + '. That is not a bug in the corpus — in <code>berry</code>, every <code>b</code>+<code>e</code> is followed by <code>e</code>+<code>r</code> and then <code>r</code>+<code>r</code>, so all three pairs must have identical counts. Real implementations break the tie by a fixed rule (first pair encountered, or lexicographic order); this lab takes the <strong>first one seen scanning the corpus left to right</strong>. Change the rule and you get a different merge list, a different vocabulary, and a genuinely different tokenizer from the same data.',
      render: function (stage) {
        stage.appendChild(rankPanel(r0, 6, { title: 'ranked pairs · winner highlighted' }));
        stage.appendChild(UI.textCard('Winner: <code>(' + esc(r0.a) + ', ' + esc(r0.b) + ')</code> at ' + r0.count + ' occurrences → the new symbol <strong>' + esc(r0.sym) + '</strong>. It is about to become vocabulary id ' + Mo.VOCAB_ID[r0.sym] + ', the first token in this vocabulary that is not a single character.', 'note'));
      }
    }, 0);

    var STORY = {};
    STORY[2] = 'Watch what just happened to <code>berry</code>: the two <code>r</code>s are now inside a single symbol <code>berr</code>. No later merge can put a boundary back between them — merges only ever glue, never split. The last tab of this lab is entirely about the consequences of this one step.';
    STORY[3] = '<code>berry</code> is now <strong>one token</strong>, learned in four merges from nothing but counts. The corpus\'s most frequent word shape has collapsed to a single id.';
    STORY[7] = '<code>straw</code> is a token too. Between this merge and merge 4, the vocabulary now contains everything needed to spell a word the corpus has never once seen.';
    STORY[11] = 'Two whole-word tokens merge into one: <code>blueberry</code> is now a single id. This is exactly how <code>the</code>, <code>ing</code> and <code> of</code> end up as single tokens in a production vocabulary — frequency, not linguistics.';

    TRAIN.rounds.forEach(function (r, idx) {
      var first = idx === 0;
      var activeMap = {};
      Mo.WORDS.forEach(function (w) { activeMap[w] = r.hits[w]; });
      push({
        title: 'Merge ' + (r.k + 1) + ': (' + r.a + ', ' + r.b + ') → ' + r.sym,
        formula: '\\text{replace every }(' + texEsc(r.a) + ',\\ ' + texEsc(r.b) + ')\\text{ with } ' + texEsc(r.sym) + ' \\qquad |V| : ' + r.vocabBefore.length + ' \\rightarrow ' + r.vocabAfter.length,
        note: (first
          ? 'One scan over the corpus replaces all ' + r.occurrencesMerged + ' occurrences of the winning pair with one new symbol, and that symbol is appended to the vocabulary. Nothing else changes: no counts are re-used, no probabilities are updated. '
          : 'Same three operations as the previous step, done once more: count every pair in the <em>current</em> splits, take the argmax' + (r.tiedCount > 1 ? ' (' + r.tiedCount + ' pairs tie at ' + r.count + ' here, broken by first appearance)' : ' (a clear winner at ' + r.count + ' this time)') + ', replace it everywhere. ') +
          'Token count across the corpus drops from <strong>' + r.tokensBefore + '</strong> to <strong>' + r.tokensAfter + '</strong> — exactly ' + r.occurrencesMerged + ' fewer, one per occurrence merged.' +
          (STORY[r.k] ? ' ' + STORY[r.k] : ''),
        render: function (stage) {
          stage.appendChild(pairCountPanel(r, { title: 'pair counts before merge ' + (r.k + 1) }));
          stage.appendChild(UI.arrow('⊕', 'merge (' + r.a + ',' + r.b + ')'));
          stage.appendChild(splitsPanel(r.after, {
            title: 'corpus after merge ' + (r.k + 1), active: activeMap, fresh: true,
            meaning: 'Highlighted chips are the ' + r.occurrencesMerged + ' positions (frequency-weighted) this merge just collapsed.'
          }));
          stage.appendChild(vocabPanel(r.vocabAfter, {
            title: 'vocabulary after merge ' + (r.k + 1), active: [r.vocabAfter.length - 1], fresh: true,
            meaning: 'One new symbol, appended: <code>' + esc(r.sym) + '</code> at id ' + Mo.VOCAB_ID[r.sym] + '. The vocabulary only ever grows, and only ever by one per merge.'
          }));
        }
      }, r.k + 1);
    });

    var tv = CHECKS.trainVsEncode;
    push({
      title: 'Self-check: the merge list alone reproduces the training splits',
      formula: '\\text{encode}(w \\mid \\text{merges}) \\;=\\; s_w^{\\text{(training)}} \\quad \\forall\\, w \\in \\text{corpus}',
      note: 'Two independent routes to the same answer. <strong>Route A</strong> is the state the training loop left behind: splits that were mutated in place, merge after merge. <strong>Route B</strong> throws that state away and re-derives each word from scratch with a fresh encoder that only ever sees the ordered merge list. If BPE is really "just replay the merges in order", these must agree on every word — and on the total token count.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'route A vs route B', shapeLabel: tv.words + ' words compared',
          meaning: 'Route A total: ' + tv.trainedTokens + ' tokens. Route B total: ' + tv.encodedTokens + ' tokens.'
        }, ['word', 'A · training loop', 'B · encoder replay', 'match'], Mo.WORDS.map(function (w) {
          var a = TRAIN.splits[w], b = Mo.encode(w, TRAIN.merges);
          return {
            cells: ['<strong>' + esc(w) + '</strong>', esc(a.join(' | ')), esc(b.join(' | ')),
                    a.join('|') === b.join('|') ? '✓' : '✕']
          };
        })));
        stage.appendChild(UI.checkBadge(tv.ok, tv.words + '/' + tv.words + ' words identical · ' + tv.trainedTokens + ' = ' + tv.encodedTokens + ' tokens · ' + tv.mismatches.length + ' mismatches'));
      }
    }, CFG.nMerges);

    push({
      title: 'What was learned: ' + Mo.VOCAB.length + ' symbols',
      formula: '|V| = |V_0| + M = ' + Mo.baseVocab.length + ' + ' + CFG.nMerges + ' = ' + Mo.VOCAB.length,
      note: 'The finished vocabulary is ' + Mo.baseVocab.length + ' characters plus ' + CFG.nMerges + ' merged symbols. Reading it top to bottom is reading the corpus\'s statistics: the pieces that occur together most often became tokens first, and the longest tokens are the most frequent word shapes. Nobody chose <code>berry</code> or <code>straw</code> — counting did. That is the sense in which a tokenizer is <em>learned</em>.',
      render: function (stage) {
        stage.appendChild(vocabPanel(Mo.VOCAB, {
          title: 'final vocabulary', active: Mo.VOCAB.map(function (s, i) { return i >= Mo.baseVocab.length ? i : -1; }).filter(function (i) { return i >= 0; }),
          meaning: 'Ids ' + Mo.baseVocab.length + '–' + (Mo.VOCAB.length - 1) + ' are the learned ones, in the order they were learned.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Tokens needed for the whole corpus', unit: ' tokens',
          items: [
            { label: 'characters only (0 merges)', value: CURVE[0].totalTokens, colorVar: 'var(--know-cold)' },
            { label: 'after ' + CFG.nMerges + ' merges', value: CURVE[CFG.nMerges].totalTokens, colorVar: 'var(--c-nlp)' }
          ],
          meaning: 'Same ' + STATS.chars + ' characters of text, ' + M.round(CURVE[0].totalTokens / CURVE[CFG.nMerges].totalTokens, 2) + '× fewer tokens — bought with ' + CFG.nMerges + ' extra vocabulary rows.'
        }));
      }
    }, CFG.nMerges);

    return steps;
  }

  function texEsc(s) { return '\\texttt{' + s.replace(/([#$%&_{}])/g, '\\$1') + '}'; }

  // ============================================================ TAB 2 · ENCODE ============================================================
  function buildEncode() {
    var steps = [], meta = [];
    var P = Mo.PROBE, word = CFG.probeWord;
    function push(step, len) { steps.push(step); meta.push({ len: len }); }
    META.encode = meta;

    push({
      title: 'The merge list is the entire tokenizer',
      formula: null,
      note: 'Training is over. What survives is this ordered list of ' + CFG.nMerges + ' rules plus the ' + Mo.baseVocab.length + ' base characters — a few hundred bytes here, a few megabytes for a real tokenizer. Encoding any string, seen or unseen, is nothing more than applying these rules <strong>in the order they were learned</strong>.',
      render: function (stage) {
        stage.appendChild(mergeListPanel(CFG.nMerges, -1));
        stage.appendChild(UI.textCard('Order matters and cannot be rearranged: rule ' + CFG.nMerges + ' merges <code>' + esc(TRAIN.rounds[CFG.nMerges - 1].a) + '</code> with <code>' + esc(TRAIN.rounds[CFG.nMerges - 1].b) + '</code>, symbols that only exist <em>because</em> earlier rules created them. Applying the list in order is equivalent to repeatedly merging whichever pair has the lowest rank — a merge can never create a pair that an earlier rule would have caught.', 'note'));
      }
    }, null);

    push({
      title: 'Encode a word the corpus never contained: "' + word + '"',
      formula: 's \\leftarrow (c_1, \\ldots, c_{' + word.length + '})',
      note: 'The corpus contains <code>blueberry</code> ×' + Mo.FREQ['blueberry'] + ' and <code>berries</code> ×' + Mo.FREQ['berries'] + ', but never <code>' + word + '</code>. Encoding starts exactly where training started: one symbol per character, <strong>' + word.length + ' tokens</strong>. Every merge below is tried in order; most will not fire.',
      render: function (stage) {
        stage.appendChild(tokenPanel({
          title: 'start · characters', shapeLabel: word.length + ' tokens', tokens: word.split(''),
          meaning: 'Same starting point as training. Nothing about this word is known to the tokenizer yet.'
        }));
        stage.appendChild(UI.textCard('For comparison, the singular <code>blueberry</code> <em>is</em> in the corpus and encodes to <strong>' + Mo.encode('blueberry', TRAIN.merges).length + ' token</strong>. Watch how far the plural gets.', 'note'));
      }
    }, word.length);

    var prevRank = -1;
    P.firing.forEach(function (t) {
      var skipped = [];
      for (var k = prevRank + 1; k < t.k; k++) skipped.push(k + 1);
      prevRank = t.k;
      var before = t.before, after = t.seq;
      push({
        title: 'Rule ' + (t.k + 1) + ' fires: (' + t.merge.a + ', ' + t.merge.b + ') → ' + t.merge.sym,
        formula: null,
        note: (skipped.length
          ? '<strong>' + plural(skipped.length, 'Rule', 'Rules') + ' ' + skipped.join(', ') + ' ' + plural(skipped.length, 'does', 'do') + ' not fire</strong> — ' + word + ' contains no such pair at this point — so the sequence passes through them unchanged. '
          : '') +
          'Rule ' + (t.k + 1) + ' fires in ' + t.hits.length + ' ' + plural(t.hits.length, 'place') + ', and the sequence shrinks from <strong>' + before.length + '</strong> to <strong>' + after.length + '</strong> tokens.',
        render: function (stage) {
          stage.appendChild(tokenPanel({
            title: 'before rule ' + (t.k + 1), shapeLabel: before.length + ' tokens', tokens: before, dim: true, sub: false
          }));
          stage.appendChild(UI.arrow('⊕', '(' + t.merge.a + ',' + t.merge.b + ')'));
          stage.appendChild(tokenPanel({
            title: 'after rule ' + (t.k + 1), shapeLabel: after.length + ' tokens', tokens: after, active: t.hits, fresh: true,
            meaning: 'The highlighted symbol is the one this rule just created.'
          }));
        }
      }, after.length);
    });

    var single = Mo.encode('blueberry', TRAIN.merges);
    push({
      title: 'Done: ' + P.tokens.length + ' tokens — for the plural of a 1-token word',
      formula: null,
      note: 'All ' + CFG.nMerges + ' rules have been applied. <code>blueberry</code>, which the corpus saw ' + Mo.FREQ['blueberry'] + ' times, is a single token; <code>' + word + '</code>, which it never saw, costs ' + P.tokens.length + '. Three extra letters, ' + (P.tokens.length - single.length) + ' extra tokens. This asymmetry is real and it is everywhere in production tokenizers: plurals, inflections, non-English scripts and rare names all fragment, and every fragment costs context window, compute and money.',
      render: function (stage) {
        stage.appendChild(tokenPanel({
          title: 'blueberry — in the corpus', shapeLabel: single.length + ' ' + plural(single.length, 'token'), tokens: single,
          meaning: 'Seen ' + Mo.FREQ['blueberry'] + '× during training, so it earned its own id.'
        }));
        stage.appendChild(tokenPanel({
          title: word + ' — never seen', shapeLabel: P.tokens.length + ' tokens', tokens: P.tokens, fresh: true,
          meaning: 'Still perfectly representable — that is subword tokenization\'s whole promise — just not cheaply.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Tokens for the same stem', unit: ' tokens',
          items: [
            { label: 'blueberry (' + 'blueberry'.length + ' chars, seen)', value: single.length, colorVar: 'var(--c-nlp)' },
            { label: word + ' (' + word.length + ' chars, unseen)', value: P.tokens.length, colorVar: 'var(--know-cold)' }
          ]
        }));
      }
    }, P.tokens.length);

    push({
      title: 'The same rules on every other word',
      formula: null,
      note: 'Nothing special happened above. Every string goes through the identical ' + CFG.nMerges + ' rules, and how many tokens it costs depends entirely on how much of it the corpus happened to contain. <code>' + CFG.targetWord + '</code> was never seen either, yet it costs only ' + Mo.TARGET.tokens.length + ' tokens — both of its halves were frequent enough to become symbols. <code>cranberry</code> costs more, and worse: <code>' + Mo.OOV_CHARS.join('</code> and <code>') + '</code> never occur in the corpus, so this character-level tokenizer has <strong>no id for them at all</strong>. Real tokenizers avoid that hole by starting from the 256 byte values instead of from characters, which makes out-of-vocabulary impossible by construction.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'encoding assorted words', shapeLabel: Mo.SAMPLES.length + ' words · same ' + CFG.nMerges + ' rules',
          meaning: 'Compression is not a property of the word. It is a property of the overlap between the word and the training corpus.'
        }, ['word', 'in corpus?', 'chars', 'tokens', 'encoding'], Mo.SAMPLES.map(function (s) {
          return {
            highlight: s.word === CFG.targetWord,
            cells: ['<strong>' + esc(s.word) + '</strong>', s.seen ? 'yes ×' + Mo.FREQ[s.word] : 'no',
                    String(s.chars), String(s.tokens.length),
                    tokenChips(s.tokens, { sub: false, maxWidth: 380 })]
          };
        })));
        if (Mo.OOV_CHARS.length) {
          stage.appendChild(UI.textCard('<strong>Out of vocabulary:</strong> ' + Mo.OOV_CHARS.map(function (c) { return '<code>' + esc(c) + '</code>'; }).join(', ') + ' appear in <code>cranberry</code> but never in the training corpus, so they carry no id. A byte-level BPE would still encode them — as raw bytes — which is why every modern tokenizer is byte-level.', 'warn'));
        }
      }
    }, null);

    var rt = CHECKS.roundTrip;
    push({
      title: 'Self-check: encode ∘ decode is the identity',
      formula: '\\text{encode}(\\text{decode}(t)) = t \\quad\\text{and}\\quad \\text{decode}(\\text{encode}(w)) = w',
      note: 'Decoding is just concatenation — a token <em>is</em> its string, so no information can be lost on the way back. The stronger claim, and the one worth checking, is that re-encoding a decoded sequence lands on the <strong>exact same token sequence</strong>, not merely the same text. Both directions are checked below on all ' + rt.tested + ' words this lab uses, corpus words and unseen words alike.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'round-trip', shapeLabel: rt.tested + ' words tested',
          meaning: 'Failures: ' + rt.fails.length + '.'
        }, ['word', 'encode →', 'decode →', 're-encode matches?'], rt.words.map(function (w) {
          var t = Mo.encode(w, TRAIN.merges), back = Mo.decode(t), again = Mo.encode(back, TRAIN.merges);
          return {
            cells: ['<strong>' + esc(w) + '</strong>', esc(t.join(' | ')), esc(back),
                    (back === w && again.join('|') === t.join('|')) ? '✓' : '✕']
          };
        })));
        stage.appendChild(UI.checkBadge(rt.ok, (rt.tested - rt.fails.length) + '/' + rt.tested + ' words round-trip exactly · ' + rt.fails.length + ' failures'));
      }
    }, null);

    return steps;
  }

  // ============================================================ TAB 3 · STRAWBERRY ============================================================
  function buildStrawberry() {
    var steps = [];
    var word = LM.word, L = CFG.targetLetter;
    var charColor = function (t, i) { return LM.letterIdx.indexOf(i) !== -1 ? '#f87171' : '#94a3b8'; };

    steps.push({
      title: 'The question: how many ' + L + '’s in "' + word + '"?',
      formula: null,
      note: 'To a reader this is trivial — the letters are right there, and counting them takes a second. There are <strong>' + LM.trueCount + '</strong>, at positions ' + LM.letterIdx.join(', ') + ' of ' + word.length + '. The model is not looking at this. The model never receives a single one of these ' + word.length + ' characters.',
      render: function (stage) {
        stage.appendChild(tokenPanel({
          title: 'the string, as you see it', shapeLabel: word.length + ' characters',
          tokens: word.split(''), color: charColor, active: LM.letterIdx,
          sub: function (t, i) { return 'pos ' + i; },
          meaning: 'The ' + LM.trueCount + ' highlighted characters are the answer. Counting them is a character-level operation.'
        }));
      }
    });

    steps.push({
      title: 'What the model actually receives',
      formula: '\\text{encode}(\\texttt{' + word + '}) = (' + LM.ids.join(',\\ ') + ')',
      note: 'Run <code>' + word + '</code> through the ' + CFG.nMerges + ' merge rules from the first tab and it comes out as <strong>' + LM.tokens.length + ' tokens</strong>: <code>' + LM.tokens.join('</code> + <code>') + '</code>. The model\'s input is then two integers — ids ' + LM.ids.join(' and ') + ' — each of which is nothing but a row index into an embedding table. The characters are gone before the first layer runs.',
      render: function (stage) {
        stage.appendChild(tokenPanel({
          title: 'tokens', shapeLabel: LM.tokens.length + ' tokens', tokens: LM.tokens, fresh: true,
          meaning: 'Both were learned on the first tab: <code>berry</code> at merge 4, <code>straw</code> at merge 8.'
        }));
        stage.appendChild(UI.arrow('→', 'embedding lookup'));
        stage.appendChild(countPanel({
          title: 'token id per character position', shapeLabel: '1 × ' + word.length + ' characters',
          matrix: [LM.owner.map(function (ti) { return LM.ids[ti]; })],
          rowLabels: ['id'], colLabels: word.split(''), maxAbs: Math.max.apply(null, LM.ids),
          outline: LM.letterIdx.map(function (i) { return [0, i]; }),
          meaning: word.length + ' characters, ' + LM.tokens.length + ' distinct integers. The boundary falls between position ' + LM.spans[0].end + ' and ' + LM.spans[1].start + ' — everywhere else the letters share an id, and the outlined ' + L + ' positions are indistinguishable from their neighbours as far as the input layer is concerned.'
        }));
      }
    });

    steps.push({
      title: 'The letters are inside the tokens, not in the input',
      formula: null,
      note: 'The ' + LM.trueCount + ' <code>' + L + '</code>s did not vanish — they are spread across the two tokens, ' + LM.perToken.join(' and ') + ' of them. But recovering that split requires knowing <em>how each token is spelled</em>, and spelling is not part of what the model receives. Id ' + LM.ids[1] + ' is not "the word berry, which has two r’s"; it is row ' + LM.ids[1] + ' of a table, sitting between rows ' + (LM.ids[1] - 1) + ' and ' + (LM.ids[1] + 1) + ' for no reason other than the order merges happened to be learned.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'where the ' + L + '’s live', shapeLabel: LM.tokens.length + ' tokens · ' + LM.trueCount + ' letters',
          meaning: 'Column 3 is knowledge the model has to learn from text about spelling, not knowledge it can read off its input.'
        }, ['token', 'id', L + '’s inside', 'character span'], LM.spans.map(function (sp, i) {
          return { cells: ['<strong>' + esc(sp.token) + '</strong>', String(sp.id), String(LM.perToken[i]), sp.start + '–' + sp.end] };
        })));
        stage.appendChild(UI.checkBadge(LM.recovered === LM.trueCount,
          LM.perToken.join(' + ') + ' = ' + LM.recovered + ' ' + L + '’s — recoverable only by spelling out ids ' + LM.ids.join(' and ')));
      }
    });

    steps.push({
      title: 'The boundary was destroyed at merge 3',
      formula: null,
      note: 'Follow the two adjacent <code>' + L + '</code> characters at positions ' + LM.letterIdx[1] + ' and ' + LM.letterIdx[2] + ' back through the first tab. They were separate tokens for exactly three merges. Merge 3 glued them into <code>' + TRAIN.rounds[2].sym + '</code> because that pair was the most frequent thing in the corpus, and merges only ever glue — there is no operation in BPE that splits a symbol back apart. From merge 3 onward, no tokenization of any word containing <code>berry</code> can place a boundary between those two letters.',
      render: function (stage) {
        var T = Mo.TARGET;
        var rows = T.firing.map(function (t) {
          return { highlight: t.k === 2, cells: ['#' + (t.k + 1), '(' + esc(t.merge.a) + ', ' + esc(t.merge.b) + ')',
            tokenChips(t.seq, { sub: false, maxWidth: 540 }), String(t.seq.length)] };
        });
        rows.unshift({ cells: ['—', 'characters', tokenChips(word.split(''), { sub: false, color: charColor, maxWidth: 540 }), String(word.length)] });
        stage.appendChild(tablePanel({
          title: 'how "' + word + '" collapsed', shapeLabel: T.firing.length + ' of ' + CFG.nMerges + ' rules fired',
          meaning: 'Every step glues. Nothing ever splits. The information loss is one-directional.'
        }, ['rule', 'pair', 'sequence', 'len'], rows));
      }
    });

    steps.push({
      title: 'What seeing the letters would cost',
      formula: '\\text{attention cost} \\propto T^2 \\;\\Rightarrow\\; \\left(\\tfrac{' + LM.charTokens + '}{' + LM.tokens.length + '}\\right)^2 = ' + M.round(Math.pow(LM.charTokens / LM.tokens.length, 2), 0) + '\\times',
      note: 'A character-level model has no letter-counting problem at all: every letter is its own token, with its own embedding and its own position. It pays for that with sequence length. For this one word the sequence is ' + M.round(LM.charTokens / LM.tokens.length, 1) + '× longer, and since attention cost grows with the square of sequence length, that single word costs about ' + M.round(Math.pow(LM.charTokens / LM.tokens.length, 2), 0) + '× more attention compute. Across a whole corpus the same ratio applies: this lab\'s corpus needs ' + CURVE[0].totalTokens + ' character tokens versus ' + CURVE[CFG.nMerges].totalTokens + ' BPE tokens.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Sequence length for "' + word + '"', unit: ' tokens',
          items: [
            { label: 'character-level (letters visible)', value: LM.charTokens, colorVar: 'var(--c-attention)' },
            { label: 'BPE (letters hidden)', value: LM.tokens.length, colorVar: 'var(--c-nlp)' }
          ]
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Attention work for that sequence (∝ T²)', unit: ' cell scores',
          items: [
            { label: 'character-level: ' + LM.charTokens + '²', value: LM.charTokens * LM.charTokens, colorVar: 'var(--c-attention)' },
            { label: 'BPE: ' + LM.tokens.length + '²', value: LM.tokens.length * LM.tokens.length, colorVar: 'var(--c-nlp)' }
          ],
          meaning: 'The letter-counting failure is not an oversight. It is the price paid, deliberately, for sequences short enough to be affordable.'
        }));
      }
    });

    steps.push({
      title: 'So: why LLMs miscount letters',
      formula: null,
      note: 'Nothing in the pipeline above is broken. The tokenizer is lossless, the round-trip is exact, and the merges are the frequency-optimal ones for the corpus. The model still cannot see that <code>' + word + '</code> contains ' + LM.trueCount + ' <code>' + L + '</code>s, because that fact was never in its input — it has to have <em>learned the spelling of each token from text</em>, then done arithmetic on it. Models do get better at this with scale and with chain-of-thought spelling the word out one character at a time, which works precisely because it forces the letters back into the token stream.',
      render: function (stage) {
        stage.appendChild(UI.textCard('<strong>The chain, in one line:</strong> the vocabulary is learned from frequency → frequent letter groups become single ids → the id is the model\'s smallest observable unit → a question about letters is a question about something below that unit.', 'note'));
        stage.appendChild(UI.checkBadge(LM.splitAcrossTokens && LM.tokens.length < LM.charTokens,
          'the ' + LM.trueCount + ' ' + L + '’s of "' + word + '" arrive as ' + LM.tokens.length + ' integers: ' + LM.ids.join(', ')));
      }
    });

    return steps;
  }

  // ============================================================ TAB 4 · TRADEOFF ============================================================
  function buildTradeoff() {
    var steps = [];
    var last = CURVE[CFG.nMerges], first = CURVE[0];

    steps.push({
      title: 'One knob: how many merges to run',
      formula: '|V| = |V_0| + M',
      note: 'Stopping the training loop early is the entire vocabulary-size decision. Every row below is a real retokenization of this lab\'s corpus with the first <span>$M$</span> merges only — not an extrapolation, the encoder was run ' + (CFG.nMerges + 1) + ' times.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'the whole curve', shapeLabel: (CFG.nMerges + 1) + ' vocabulary sizes',
          meaning: 'Characters per token is the compression ratio: how much text one embedding row buys you.'
        }, ['merges M', '|V|', 'corpus tokens', 'tokens / word', 'chars / token', '"' + CFG.targetWord + '"'],
          CURVE.map(function (c) {
            return {
              highlight: c.merges === CFG.nMerges,
              cells: [String(c.merges), String(c.vocabSize), String(c.totalTokens), c.tokensPerWord.toFixed(2),
                      c.charsPerToken.toFixed(2), c.targetTokens + ' tok']
            };
          })));
      }
    });

    steps.push({
      title: 'More merges → shorter sequences',
      formula: null,
      note: 'From ' + first.totalTokens + ' tokens down to ' + last.totalTokens + ' for the same ' + STATS.chars + ' characters, a ' + M.round(first.totalTokens / last.totalTokens, 2) + '× compression bought with ' + CFG.nMerges + ' extra vocabulary rows. Shorter sequences are cheaper at every stage: fewer embedding lookups, fewer attention rows, fewer decode steps, and more text inside a fixed context window.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Corpus tokens as merges accumulate', unit: ' tokens',
          items: [0, 3, 6, 9, 12].map(function (m) {
            return { label: 'M = ' + m + ' (|V| = ' + CURVE[m].vocabSize + ')', value: CURVE[m].totalTokens,
                     colorVar: m === CFG.nMerges ? 'var(--c-nlp)' : 'var(--c-efficient)' };
          }),
          meaning: 'Same text, same tokenizer family, four different vocabulary budgets.'
        }));
        stage.appendChild(UI.barsPanel({
          title: 'Characters carried per token', unit: ' chars/token',
          items: [0, 3, 6, 9, 12].map(function (m) {
            return { label: 'M = ' + m, value: CURVE[m].charsPerToken, colorVar: 'var(--c-nlp)' };
          }),
          meaning: 'This is the number that decides how much of a document fits in a context window.'
        }));
      }
    });

    steps.push({
      title: 'And the returns diminish',
      formula: '\\Delta_M = \\text{tokens}(M-1) - \\text{tokens}(M)',
      note: 'Each merge removes exactly one token per occurrence of the pair it collapses, so the saving from merge <span>$M$</span> is that pair\'s count. Since counts only ever decrease as the frequent pairs get used up, the curve flattens: merge 1 saved ' + (CURVE[0].totalTokens - CURVE[1].totalTokens) + ' tokens, merge ' + CFG.nMerges + ' saved ' + (CURVE[CFG.nMerges - 1].totalTokens - CURVE[CFG.nMerges].totalTokens) + '. Real tokenizers sit at the knee of this curve, which is why vocabulary sizes cluster in the tens of thousands rather than the millions.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Tokens saved by each individual merge', unit: ' tokens',
          items: TRAIN.rounds.map(function (r) {
            return { label: 'merge ' + (r.k + 1) + ' · (' + r.a + ',' + r.b + ')',
                     value: CURVE[r.k].totalTokens - CURVE[r.k + 1].totalTokens,
                     colorVar: 'var(--c-efficient)' };
          }),
          meaning: 'Exactly the winning pair\'s count at each step — the same numbers the first tab showed in its ranked tables.'
        }));
      }
    });

    steps.push({
      title: 'The cost side: the embedding table',
      formula: '\\text{params}_{\\text{embed}} = |V| \\times d_{model}',
      note: 'Every vocabulary row is a full <span>$d_{model}$</span>-dimensional vector to store, and usually a second one in the output projection. At <span>$d_{model} = ' + CFG.dModel + '$</span> the numbers below are what a vocabulary <em>costs</em> before a single layer exists. That is the trade: bigger vocabulary buys shorter sequences and pays in parameters, memory bandwidth, and a softmax over more classes at every generated token.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Embedding parameters at d_model = ' + CFG.dModel, unit: 'M params',
          items: Mo.SCALE.rows.map(function (r) {
            return { label: r.label + ' (|V| = ' + r.vocab.toLocaleString() + ')', value: r.millions,
                     colorVar: r.vocab === Mo.VOCAB.length ? 'var(--c-nlp)' : 'var(--know-cold)' };
          }),
          meaning: 'A ' + (128000 / 32000) + '× larger vocabulary costs ' + M.round(Mo.SCALE.rows[2].params / Mo.SCALE.rows[1].params, 1) + '× the embedding parameters — and that is before the tied or untied output head.'
        }));
        stage.appendChild(UI.textCard('The counterweight is real too: a tokenizer that fragments your language badly makes every request longer, so a bigger multilingual vocabulary can be cheaper overall despite the extra parameters. Page <a href="./topics/10-llm-architecture-training.html">10</a> works through where the balance lands in practice.', 'note'));
      }
    });

    var ci = CHECKS.charInvariant;
    steps.push({
      title: 'Self-check: the M = 0 end of the curve',
      formula: '\\text{tokens}(M{=}0) \\;=\\; \\text{characters in the corpus}',
      note: 'The curve has one point whose value is knowable without running the encoder at all: with zero merges every token is a single character, so the corpus token count must equal its character count exactly. If the encoder, the training loop and the corpus statistics disagree by even one, something is wrong with all three. They are computed by separate code paths — the encoder replays merges, the statistic just multiplies word lengths by frequencies.',
      render: function (stage) {
        stage.appendChild(tablePanel({
          title: 'both routes to the M = 0 count', shapeLabel: '2 independent computations',
          meaning: 'And at the other end: ' + last.totalTokens + ' tokens for ' + STATS.chars + ' characters, a ' + last.charsPerToken.toFixed(2) + '× compression.'
        }, ['route', 'value'], [
          { cells: ['encoder run with 0 merges, summed over the corpus', String(ci.tokens)] },
          { cells: ['Σ word length × frequency, straight from the corpus', String(ci.chars)] }
        ]));
        stage.appendChild(UI.checkBadge(ci.ok, 'M = 0 · ' + ci.tokens + ' tokens = ' + ci.chars + ' characters · difference ' + Math.abs(ci.tokens - ci.chars)));
      }
    });

    return steps;
  }

  // ============================================================ wiring ============================================================
  var TABS = [
    { id: 'train', label: 'Train BPE from a corpus', short: 'Train BPE', color: 'var(--c-nlp)', build: buildTrain },
    { id: 'encode', label: 'Encode with the learned merges', short: 'Encode', color: 'var(--c-llm)', build: buildEncode },
    { id: 'strawberry', label: 'Why "strawberry" is hard', short: 'Why "strawberry" is hard', color: 'var(--c-frontier)', build: buildStrawberry },
    { id: 'tradeoff', label: 'Vocabulary size tradeoff', short: 'Vocab tradeoff', color: 'var(--c-efficient)', build: buildTradeoff }
  ];

  window.KMLTokenizerLabSteps = { TABS: TABS, META: META };

  /* The contract the shared controller (lab-app.js) reads. */
  window.KML_LAB = {
    tabs: TABS,
    dims: [
      { sym: 'corpus', val: STATS.tokensOfText + ' words', def: 'The training corpus: ' + STATS.types + ' distinct words, ' + STATS.tokensOfText + ' occurrences, ' + STATS.chars + ' characters in total. Everything on this page — every merge, every token, every id — is derived from exactly this and nothing else.' },
      { sym: 'chars', val: String(STATS.chars), def: 'Total characters in the corpus. Also the token count before any merge runs, since the tokenizer starts with one token per character.' },
      { sym: '|V₀|', val: String(Mo.baseVocab.length), def: 'Base vocabulary: the distinct characters that occur in the corpus (' + Mo.baseVocab.join(' ') + '). A real tokenizer uses the 256 byte values here instead, so that nothing can ever be out of vocabulary.' },
      { sym: 'M', val: String(CFG.nMerges), def: 'Merge rules learned. This is the only knob in BPE: run the loop longer, get a bigger vocabulary and shorter sequences. On the Train tab it counts up as you step.' },
      { sym: '|V|', val: String(Mo.VOCAB.length), def: 'Final vocabulary size = |V₀| + M. One new symbol per merge, never more, never fewer — which is why vocabulary size and merge count are the same decision.' }
    ],
    dimsFor: {
      encode: [{ sym: 'len', val: String(CFG.probeWord.length), def: 'Tokens in "' + CFG.probeWord + '" at this step of the encoder. It starts at one token per character and shrinks each time a merge rule fires.' }],
      strawberry: [
        { sym: 'tok', val: String(LM.tokens.length), def: 'Tokens in "' + CFG.targetWord + '" under this lab\'s learned vocabulary — the entire input the model gets for that word.' },
        { sym: CFG.targetLetter + '’s', val: String(LM.trueCount), def: 'How many "' + CFG.targetLetter + '" characters are actually in "' + CFG.targetWord + '". Visible to you, not to the model\'s input layer.' }
      ],
      tradeoff: [{ sym: 'd_model', val: String(CFG.dModel), def: 'Embedding width assumed for the parameter-cost arithmetic on this tab. The vocabulary costs |V| × d_model parameters in the embedding table alone.' }]
    },
    /* M and |V| grow as you step through the Train tab; the encoder tab tracks
       the length of the sequence being encoded. Both read the metadata each
       build() records alongside its steps. */
    dimFix: function (tabId, stepIndex, list) {
      function find(sym) { return list.filter(function (d) { return d.sym === sym; })[0]; }
      if (tabId === 'train') {
        var meta = (META.train || [])[stepIndex];
        if (!meta) return;
        var mChip = find('M'), vChip = find('|V|');
        if (mChip) mChip.val = meta.merges + ' / ' + CFG.nMerges;
        if (vChip) vChip.val = String(Mo.baseVocab.length + meta.merges);
      } else if (tabId === 'encode') {
        var em = (META.encode || [])[stepIndex];
        var lenChip = find('len');
        if (lenChip) lenChip.val = (em && em.len != null) ? String(em.len) : '—';
      }
    }
  };
})();
