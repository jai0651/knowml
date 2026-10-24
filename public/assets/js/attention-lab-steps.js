/* KnowML — Attention Lab: the seven mechanism walkthroughs. Every step is one
   primitive operation — one matmul, one mask, one softmax — never several
   folded together, so stepping through matches how you'd trace it by hand. */
(function () {
  'use strict';
  var M = window.KMLLabMath, Mo = window.KMLLabModel, UI = window.KMLLabUI, CFG = Mo.CFG;
  var R2 = function (m) { return m.map(function (r) { return r.map(function (v) { return M.round(v, 2); }); }); };
  var headLabel = function (h) { return 'head ' + h; };
  var colHeadsRange = function (n) { var a = []; for (var i = 0; i < n; i++) a.push('d' + i); return a; };
  var rowTokRange = function (n, offset) { var a = []; for (var i = 0; i < n; i++) a.push('t' + ((offset || 0) + i)); return a; };

  // computed once, shared by every tab
  var PRE = Mo.prefill();
  var DEC = Mo.decodeStep(PRE);
  var MQA = Mo.mqaPass();
  var GQA = Mo.gqaPass();
  var MLA = Mo.mlaPass();
  var FLASH = Mo.flashPass(PRE);
  var PAGED = Mo.pagedLayout(DEC);

  var TOK_COLORS = ['#f472b6', '#4ade80', '#facc15', '#60a5fa', '#c084fc'];

  function tokenStrip(words, ids, highlightIdx) {
    var wrap = UI.el('div', 'lab-tokens');
    words.forEach(function (w, i) {
      var chip = UI.el('div', 'lab-token' + (highlightIdx === i ? ' lab-token--active' : ''));
      chip.style.setProperty('--tc', TOK_COLORS[ids[i] % TOK_COLORS.length]);
      chip.innerHTML = '<span class="lab-token-word">' + w + '</span><span class="lab-token-id">id ' + ids[i] + '</span>';
      wrap.appendChild(chip);
    });
    return wrap;
  }

  // ============================================================ MHA ============================================================
  function buildMHA() {
    var steps = [];
    steps.push({
      title: 'The four tokens, as words',
      formula: null,
      note: 'Everything in this walkthrough is one short sentence: <strong>' + CFG.vocab.slice(0, CFG.prefillLen).join(' ') + '</strong>. Each word becomes one row everywhere below — the tensors never lose track of which row belongs to which token.',
      render: function (stage) {
        stage.appendChild(tokenStrip(CFG.vocab.slice(0, CFG.prefillLen), PRE.ids));
      }
    });
    steps.push({
      title: 'Tokens → integer ids → embedding lookup',
      formula: 'X = E[\\text{ids}] \\qquad E \\in \\mathbb{R}^{|V|\\times d_{model}},\\ X \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'The embedding table <code>E</code> has one learned row per vocabulary word. Looking a token up is nothing more than reading its row out of that table — no arithmetic yet, just a lookup.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({
          title: 'E — embedding table', shapeLabel: '|V|=' + CFG.vocab.length + ' × d_model=' + CFG.dModel,
          matrix: R2(Mo.E), rowLabels: CFG.vocab, colLabels: colHeadsRange(CFG.dModel),
          meaning: 'One row per vocabulary word. Rows for "' + CFG.vocab.slice(0, CFG.prefillLen).join('", "') + '" are the ones this sentence uses.'
        }));
        stage.appendChild(UI.arrow('↓', 'look up 4 rows'));
        stage.appendChild(UI.matrixPanel({
          title: 'X — token embeddings', shapeLabel: 'T=' + CFG.prefillLen + ' × d_model=' + CFG.dModel, fresh: true,
          matrix: R2(PRE.X), rowLabels: rowTokRange(CFG.prefillLen), colLabels: colHeadsRange(CFG.dModel),
          meaning: 'Row t is token t\'s vector. This is the only tensor that ever touches the vocabulary — every later tensor is derived purely from these 4 rows.'
        }));
      }
    });
    steps.push({
      title: 'Positional information (briefly)',
      formula: null,
      note: 'Attention itself has no notion of order — swap two rows of <code>X</code> and every dot product below is unchanged. Real models fix this by rotating each Q/K vector by an angle that depends on its position (<strong>RoPE</strong>), or by adding a position vector to <code>X</code> before projecting. This walkthrough keeps the numbers focused on attention itself, so it skips the rotation — page <a href="./topics/08-attention-transformers.html">08</a> derives it in full. Everything below still assumes positions exist, because the causal mask a few steps from now depends on knowing which token comes before which.',
      render: function (stage) {
        stage.appendChild(UI.textCard('<strong>Simplified here:</strong> no rotation is applied to Q/K below. The causal mask still enforces "no looking at the future" using each token\'s position — that part is not simplified, only the RoPE rotation itself is set aside.', 'note'));
      }
    });
    steps.push({
      title: 'Project to queries: Q = X·W_Q',
      formula: 'Q = XW_Q \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'One learned linear layer, shared by every token and every position. Row t of <code>Q</code> is "what token t is looking for."',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'X', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.X), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_Q (8×8)'));
        stage.appendChild(UI.matrixPanel({ title: 'Q', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.Q), fresh: true, meaning: 'Row t: what token t is looking for.' }));
      }
    });
    steps.push({
      title: 'Project to keys: K = X·W_K',
      formula: 'K = XW_K \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'A second, independent linear layer. Row t of <code>K</code> is "what token t offers to be found by."',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'X', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.X), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_K (8×8)'));
        stage.appendChild(UI.matrixPanel({ title: 'K', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.K), fresh: true, meaning: 'Row t: what token t offers to be matched against.' }));
      }
    });
    steps.push({
      title: 'Project to values: V = X·W_V',
      formula: 'V = XW_V \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'A third linear layer. Row t of <code>V</code> is "what token t actually hands over" once it has been matched.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'X', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.X), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_V (8×8)'));
        stage.appendChild(UI.matrixPanel({ title: 'V', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.V), fresh: true, meaning: 'Row t: the content token t contributes once selected.' }));
      }
    });
    steps.push({
      title: 'Split every 8-wide row into 4 heads of width 2',
      formula: '\\text{reshape}:\\ (T, H{\\cdot}d_h) \\rightarrow H \\times (T, d_h) \\qquad H{=}4,\\ d_h{=}2',
      note: 'No arithmetic happens here — this is a <em>reshape</em>. Columns 0–1 of <code>Q</code> become head 0\'s query, columns 2–3 become head 1\'s, and so on. Each head now works in its own private 2-dimensional subspace, independently of the other three.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'Q (before split)', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.Q), dim: true }));
        stage.appendChild(UI.arrow('✂︎', 'split into 4 × d_h=2'));
        stage.appendChild(UI.headsPanel({
          title: 'Q, split by head', groupMeaning: 'Head h owns columns [2h, 2h+1) of the original Q. K and V are split identically.',
          heads: PRE.Qh.map(function (q, h) { return { title: headLabel(h), shapeLabel: 'T=4 × d_h=2', matrix: R2(q), colLabels: ['d0', 'd1'] }; })
        }));
      }
    });
    steps.push({
      title: 'Raw similarity per head: scores = Q_h·K_hᵀ / √d_h',
      formula: '\\text{scores}_h = \\frac{Q_h K_h^{\\top}}{\\sqrt{d_h}} \\in \\mathbb{R}^{T\\times T}',
      note: 'Every head computes its own <code>T×T</code> grid: row i, column j is how strongly token i\'s query matches token j\'s key, scaled by <span>$1/\\sqrt{d_h}$</span> for the variance reason derived on page <a href="./topics/08-attention-transformers.html">08</a>.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Raw scores per head', groupMeaning: 'Each of the 4 heads produces its own independent 4×4 grid — nothing is shared between heads yet.',
          heads: PRE.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '4×4', matrix: R2(hh.scores), rowLabels: rowTokRange(4), colLabels: rowTokRange(4), fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Causal mask: no token may look at the future',
      formula: '\\text{scores}_h[i,j] \\leftarrow -\\infty \\ \\text{ if } j > i',
      note: 'A decoder generates left to right, so token i is only allowed to attend to tokens <span>$0..i$</span>. Every cell above the diagonal is forced to <span>$-\\infty$</span>, which softmax will turn into exactly 0 next step.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Masked scores', groupMeaning: 'Dotted cells are the ones set to −∞ — token i can never see token j when j > i.',
          heads: PRE.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '4×4', matrix: R2(hh.scores), rowLabels: rowTokRange(4), colLabels: rowTokRange(4), mask: hh.mask }; })
        }));
      }
    });
    steps.push({
      title: 'Softmax turns each row into weights that sum to 1',
      formula: '\\text{weights}_h = \\text{softmax}(\\text{scores}_h) \\quad \\text{row-wise}',
      note: 'Row i becomes a probability distribution over tokens <span>$0..i$</span> — how much of each past token\'s value token i will blend in.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Attention weights', groupMeaning: 'Every visible row sums to 1.00 — check any row by hand, the masked cells contribute exactly 0.',
          heads: PRE.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '4×4', matrix: R2(hh.weights), rowLabels: rowTokRange(4), colLabels: rowTokRange(4), mask: hh.mask, colorMode: 'prob', fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Blend the values: out_h = weights_h·V_h',
      formula: '\\text{out}_h = \\text{weights}_h\\, V_h \\in \\mathbb{R}^{T\\times d_h}',
      note: 'Row i of the output is a weighted average of the value rows token i attends to — the weights from the previous step, the content from <code>V</code>.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Per-head output', groupMeaning: 'Back to d_h=2 wide, one row per token, one grid per head.',
          heads: PRE.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: 'T=4 × d_h=2', matrix: R2(hh.out), rowLabels: rowTokRange(4), colLabels: ['d0', 'd1'], fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Concatenate the 4 heads back into one row',
      formula: '\\text{concat} = [\\text{out}_0 \\Vert \\text{out}_1 \\Vert \\text{out}_2 \\Vert \\text{out}_3] \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'The reshape from the split-heads step runs in reverse: each head\'s 2 columns slot back into its original position, rebuilding one 8-wide row per token.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Per-head output (before concat)', groupMeaning: '',
          heads: PRE.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: 'T=4 × d_h=2', matrix: R2(hh.out), dim: true }; })
        }));
        stage.appendChild(UI.arrow('⋈', 'concat columns'));
        stage.appendChild(UI.matrixPanel({ title: 'concat', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.concat), fresh: true }));
      }
    });
    steps.push({
      title: 'Output projection: Y = concat·W_O',
      formula: 'Y = \\text{concat}\\, W_O \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'One last learned mixing layer lets the heads exchange information before this layer\'s output moves on — to the residual stream, then the next layer.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'concat', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.concat), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_O (8×8)'));
        stage.appendChild(UI.matrixPanel({ title: 'Y — layer output', shapeLabel: 'T=4 × d_model=8', matrix: R2(PRE.Y), fresh: true, meaning: 'Same shape X arrived with. This is the one invariant of every attention layer: it mixes information across tokens, but never changes the shape.' }));
      }
    });
    return steps;
  }

  // ============================================================ KV CACHE ============================================================
  function buildKVCache() {
    var steps = [];
    steps.push({
      title: 'Where we left off: 4 tokens already cached',
      formula: null,
      note: 'After the prefill pass on the previous tab, every head\'s <code>K</code> and <code>V</code> for tokens 0–3 already exist. A real server keeps exactly these numbers in GPU memory instead of recomputing them — that memory is the <strong>KV cache</strong>.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Cached K (from prefill)', groupMeaning: 'Nothing new here — this is literally head 0–3\'s K from the MHA tab, just relabeled as "cache."',
          heads: PRE.Kh.map(function (k, h) { return { title: headLabel(h), shapeLabel: 'T=4 × d_h=2', matrix: R2(k), rowLabels: rowTokRange(4), dim: true }; })
        }));
      }
    });
    steps.push({
      title: 'A new token arrives: "."',
      formula: null,
      note: 'Generation produces one token at a time. Token 4 needs an embedding just like tokens 0–3 did — looked up from the same table <code>E</code>.',
      render: function (stage) {
        stage.appendChild(tokenStrip(CFG.vocab.slice(0, CFG.prefillLen).concat(['.']), PRE.ids.concat([DEC.id5]), 4));
        stage.appendChild(UI.matrixPanel({ title: 'x₅ — new token\'s embedding', shapeLabel: '1 × d_model=8', matrix: R2(DEC.x5), fresh: true }));
      }
    });
    steps.push({
      title: 'Project only the new row: q₅, k₅, v₅',
      formula: 'q_5 = x_5 W_Q,\\quad k_5 = x_5 W_K,\\quad v_5 = x_5 W_V \\in \\mathbb{R}^{1\\times d_{model}}',
      note: 'This is the entire computational saving of caching, stated exactly: tokens 0–3 are <strong>not</strong> re-projected. Only the one new row goes through <code>W_Q</code>, <code>W_K</code>, <code>W_V</code>.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'q₅', shapeLabel: '1×8', matrix: R2(DEC.q5), fresh: true }));
        stage.appendChild(UI.matrixPanel({ title: 'k₅', shapeLabel: '1×8', matrix: R2(DEC.k5), fresh: true }));
        stage.appendChild(UI.matrixPanel({ title: 'v₅', shapeLabel: '1×8', matrix: R2(DEC.v5), fresh: true }));
      }
    });
    steps.push({
      title: 'Append k₅, v₅ to the cache — per head',
      formula: 'K_h^{(5)} = [K_h^{(4)} \\Vert k_{5,h}] \\in \\mathbb{R}^{5\\times d_h}',
      note: 'The cache grows by exactly one row per head, for K and for V. Tokens 0–3\'s rows are untouched — only appended to, never rewritten.',
      render: function (stage) {
        var wrap = UI.el('div', 'lab-heads-group');
        wrap.appendChild(UI.el('div', 'lab-heads-group-title', 'K cache, after append'));
        var row = UI.el('div', 'lab-heads-row');
        DEC.heads.forEach(function (hh, h) {
          row.appendChild(UI.cachePanel({ title: headLabel(h), shapeLabel: '5×2', matrix: R2(hh.Kcache), newFrom: 4 }));
        });
        wrap.appendChild(row);
        wrap.appendChild(UI.el('div', 'lab-panel-meaning', 'Row 4 (outlined) is the only new row in every head\'s cache — rows 0–3 are exactly what the MHA tab computed, untouched.'));
        stage.appendChild(wrap);
      }
    });
    steps.push({
      title: 'Score the new query against all 5 cached keys',
      formula: '\\text{scores}_h = \\frac{q_{5,h}\\, K_h^{(5)\\top}}{\\sqrt{d_h}} \\in \\mathbb{R}^{1\\times 5}',
      note: 'Only <strong>one</strong> row of scores is computed this step — not the 5×5 grid a from-scratch recomputation would produce. Token 4 is allowed to see everyone (including itself), so nothing here needs masking.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'New query vs. all 5 keys', groupMeaning: '',
          heads: DEC.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '1×5', matrix: R2(hh.core.scores), colLabels: rowTokRange(5), fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Softmax → weights over the 5 cached tokens',
      formula: '\\text{weights}_h = \\text{softmax}(\\text{scores}_h)',
      note: 'One row, summing to 1, spread across all 5 tokens the new token can see.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Weights (new token vs. cache)', groupMeaning: '',
          heads: DEC.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '1×5', matrix: R2(hh.core.weights), colLabels: rowTokRange(5), colorMode: 'prob', fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Blend all 5 cached values → this step\'s output',
      formula: '\\text{out}_h = \\text{weights}_h\\, V_h^{(5)} \\in \\mathbb{R}^{1\\times d_h}',
      note: 'Same weighted-sum operation as the MHA tab — the only difference is the shape: <code>1×5</code> weights against a <code>5×d_h</code> cache, instead of <code>4×4</code> against <code>4×d_h</code>.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Per-head output for token 4 only', groupMeaning: '',
          heads: DEC.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '1×2', matrix: R2(hh.core.out), fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Concat + output projection → Y for the new token',
      formula: 'Y_5 = [\\text{out}_0\\Vert\\dots\\Vert\\text{out}_3]\\, W_O \\in \\mathbb{R}^{1\\times d_{model}}',
      note: 'Exactly the epilogue from the MHA tab, run on one row instead of four.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'concat', shapeLabel: '1×8', matrix: R2(DEC.concat), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_O'));
        stage.appendChild(UI.matrixPanel({ title: 'Y₅', shapeLabel: '1×8', matrix: R2(DEC.Y), fresh: true }));
      }
    });
    steps.push({
      title: 'What caching actually bought you',
      formula: null,
      note: 'Without a cache, generating token 4 in context of tokens 0–3 would mean re-running the full prefill: projecting all 5 tokens and computing a 5×5 score grid per head. With the cache, this step touched exactly 1 new row through the projections and a 1×5 score grid per head.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Scores computed this step, per head', unit: ' cells',
          items: [
            { label: 'recompute from scratch (5×5)', value: 25, colorVar: 'var(--know-cold)' },
            { label: 'with KV cache (1×5)', value: 5, colorVar: 'var(--c-practice)' }
          ],
          meaning: 'The saving grows with sequence length: at token 500, it is a 1×500 row against a 500×500 grid.'
        }));
      }
    });
    return steps;
  }

  // ============================================================ MQA ============================================================
  function buildMQA() {
    var steps = [];
    steps.push({
      title: 'One shared key/value head instead of four',
      formula: null,
      note: '<strong>Multi-Query Attention</strong> (Shazeer, 2019) keeps all <span>$H{=}4$</span> query heads exactly as in MHA. The change is entirely on the K/V side: instead of 4 independent K/V heads, there is exactly <strong>one</strong>, shared by every query head.',
      render: function (stage) {
        stage.appendChild(UI.textCard('Query side: unchanged, 4 heads. Key/Value side: 4 heads → <strong>1</strong> shared head. That single change is the entire mechanism.', 'note'));
      }
    });
    steps.push({
      title: 'Project the one shared K and V',
      formula: 'K_{\\text{shared}} = XW_K^{mqa},\\quad V_{\\text{shared}} = XW_V^{mqa} \\in \\mathbb{R}^{T\\times d_h}',
      note: '<code>W_K^{mqa}</code> and <code>W_V^{mqa}</code> project directly down to width <span>$d_h{=}2$</span> — there is no per-head split afterward, because there is only one head to begin with.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'X', shapeLabel: 'T=4 × d_model=8', matrix: R2(MQA.X), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_K^{mqa} (8×2)'));
        stage.appendChild(UI.matrixPanel({ title: 'K_shared', shapeLabel: 'T=4 × d_h=2', matrix: R2(MQA.Kshared), fresh: true, meaning: 'Every one of the 4 query heads will read this same matrix.' }));
        stage.appendChild(UI.matrixPanel({ title: 'V_shared', shapeLabel: 'T=4 × d_h=2', matrix: R2(MQA.Vshared), fresh: true }));
      }
    });
    steps.push({
      title: 'All 4 query heads attend against the same K, V',
      formula: '\\text{scores}_h = \\frac{Q_h K_{\\text{shared}}^{\\top}}{\\sqrt{d_h}},\\qquad h = 0,1,2,3',
      note: 'Four different <code>Q_h</code> matrices, but every one of them multiplies against the identical <code>K_shared</code>. The 4 score grids below differ only because the queries differ.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Scores per query head vs. the one shared K', groupMeaning: 'Same K_shared reused 4 times — it is not recomputed per head.',
          heads: MQA.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '4×4', matrix: R2(hh.scores), mask: hh.mask, fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Softmax → weighted sum with the shared V',
      formula: '\\text{out}_h = \\text{softmax}(\\text{scores}_h)\\, V_{\\text{shared}}',
      note: 'Same mechanics as MHA from here on — only the source of K and V changed, three steps ago.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Per-head output', groupMeaning: '',
          heads: MQA.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '4×2', matrix: R2(hh.out), fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Concat + output projection',
      formula: 'Y = [\\text{out}_0\\Vert \\dots \\Vert \\text{out}_3]\\, W_O',
      note: 'Identical epilogue to MHA.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'concat', shapeLabel: '4×8', matrix: R2(MQA.concat), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_O'));
        stage.appendChild(UI.matrixPanel({ title: 'Y', shapeLabel: '4×8', matrix: R2(MQA.Y), fresh: true }));
      }
    });
    steps.push({
      title: 'The entire point: cache size per token',
      formula: '\\text{MHA cache/token} = 2Hd_h \\quad\\text{vs.}\\quad \\text{MQA cache/token} = 2d_h',
      note: 'The KV cache stores K and V for every head. MHA stores 4 heads\' worth; MQA stores 1. Quality drops a little — every head is now forced to share one description of "what\'s available" — but the cache shrinks in direct proportion to the head count.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'KV cache size, per token, per layer', unit: ' numbers',
          items: [
            { label: 'MHA (4 KV heads)', value: 2 * CFG.H * CFG.dH, colorVar: 'var(--know-cold)' },
            { label: 'MQA (1 KV head)', value: 2 * CFG.mqaHeads * CFG.dH, colorVar: 'var(--c-practice)' }
          ],
          meaning: '4× smaller here because H=4. At a real model\'s H=32–96, the ratio is the same story, just bigger.'
        }));
      }
    });
    return steps;
  }

  // ============================================================ GQA ============================================================
  function buildGQA() {
    var steps = [];
    var groupSize = CFG.H / CFG.gqaGroups;
    steps.push({
      title: 'A middle ground: 2 shared key/value heads',
      formula: null,
      note: '<strong>Grouped-Query Attention</strong> (Ainslie et al., 2023) sits between MHA (every query head has its own K/V) and MQA (every query head shares one K/V). Here, <span>$H{=}4$</span> query heads are split into <span>$G{=}2$</span> groups of ' + groupSize + '; each group shares one K/V head.',
      render: function (stage) {
        stage.appendChild(UI.textCard('G=1 is MQA. G=H is MHA. G=2 (here) is a dial in between — the more groups, the closer to MHA\'s quality and MHA\'s cache size.', 'note'));
      }
    });
    steps.push({
      title: 'Project 2 kv-heads\' worth of K and V',
      formula: 'K_g = XW_K^{gqa} \\in \\mathbb{R}^{T \\times (G\\cdot d_h)},\\quad G{=}2',
      note: 'The projection outputs width <span>$G\\cdot d_h = 4$</span>, then splits into <span>$G{=}2$</span> heads of width <span>$d_h{=}2$</span> — exactly the same split-by-reshape idea as MHA, just with fewer resulting heads.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'X', shapeLabel: '4×8', matrix: R2(GQA.X), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_K^{gqa} (8×4)'));
        stage.appendChild(UI.matrixPanel({ title: 'K_g (before split)', shapeLabel: '4×4', matrix: R2(GQA.Kg), fresh: true }));
        stage.appendChild(UI.arrow('✂︎', 'split into 2 heads'));
        stage.appendChild(UI.headsPanel({
          title: 'K, split into 2 kv-heads', groupMeaning: 'V is projected and split the same way, from its own W_V^{gqa}.',
          heads: GQA.Kgh.map(function (k, g) { return { title: 'kv-head ' + g, shapeLabel: '4×2', matrix: R2(k), fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'The grouping map: which query heads share which kv-head',
      formula: '\\text{kv-head}(h) = \\left\\lfloor \\dfrac{h}{H/G} \\right\\rfloor',
      note: 'With <span>$H{=}4$</span> and <span>$G{=}2$</span>, query heads 0 and 1 both route to kv-head 0; query heads 2 and 3 both route to kv-head 1. This mapping is fixed at training time — it is architecture, not something learned per-token.',
      render: function (stage) {
        var wrap = UI.el('div', 'lab-groupmap');
        [0, 1, 2, 3].forEach(function (h) {
          var row = UI.el('div', 'lab-groupmap-row');
          row.innerHTML = '<span class="lab-groupmap-q">query head ' + h + '</span><span class="lab-groupmap-arrow">→</span><span class="lab-groupmap-kv">kv-head ' + GQA.groupOf(h) + '</span>';
          wrap.appendChild(row);
        });
        stage.appendChild(wrap);
      }
    });
    steps.push({
      title: 'Each query head attends against its assigned kv-head',
      formula: '\\text{scores}_h = \\frac{Q_h\\, K_{g(h)}^{\\top}}{\\sqrt{d_h}}',
      note: 'Heads 0 and 1 use kv-head 0\'s K; heads 2 and 3 use kv-head 1\'s K. Only 2 distinct K matrices exist, reused across 4 query heads.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Scores per query head', groupMeaning: 'Heads 0,1 share one K; heads 2,3 share the other.',
          heads: GQA.heads.map(function (hh, h) { return { title: headLabel(h) + ' (kv ' + GQA.groupOf(h) + ')', shapeLabel: '4×4', matrix: R2(hh.scores), mask: hh.mask, fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Softmax → weighted sum → concat → output projection',
      formula: 'Y = [\\text{out}_0\\Vert\\dots\\Vert\\text{out}_3]\\, W_O',
      note: 'The rest of the pipeline is identical to MHA and MQA — this is the pattern every attention variant on this page shares: only how K and V are produced changes; what happens to them once they exist does not.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'concat', shapeLabel: '4×8', matrix: R2(GQA.concat), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_O'));
        stage.appendChild(UI.matrixPanel({ title: 'Y', shapeLabel: '4×8', matrix: R2(GQA.Y), fresh: true }));
      }
    });
    steps.push({
      title: 'Cache size: the whole spectrum, side by side',
      formula: null,
      note: 'GQA\'s cache size scales with <span>$G$</span>, the number of groups — a genuine dial between MHA\'s quality and MQA\'s memory footprint, which is exactly why it is the default in most 2026 serving stacks rather than either extreme.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'KV cache size, per token, per layer', unit: ' numbers',
          items: [
            { label: 'MHA (4 kv heads)', value: 2 * CFG.H * CFG.dH, colorVar: 'var(--know-cold)' },
            { label: 'GQA (2 kv heads)', value: 2 * CFG.gqaGroups * CFG.dH, colorVar: 'var(--c-gpu)' },
            { label: 'MQA (1 kv head)', value: 2 * CFG.mqaHeads * CFG.dH, colorVar: 'var(--c-practice)' }
          ],
          meaning: 'Pick G anywhere from 1 to H — this example uses G=2, exactly halfway.'
        }));
      }
    });
    return steps;
  }

  // ============================================================ MLA ============================================================
  function buildMLA() {
    var steps = [];
    steps.push({
      title: 'Cache a compressed summary instead of K and V',
      formula: null,
      note: '<strong>Multi-Head Latent Attention</strong> (DeepSeek-V2, 2024) asks a different question than GQA/MQA. Instead of sharing K/V across heads, it compresses each token\'s K and V into one small <em>latent</em> vector, caches only that, and reconstructs full-width, per-head K/V from it at attention time.',
      render: function (stage) {
        stage.appendChild(UI.textCard('GQA/MQA shrink the cache by having <em>fewer heads</em>. MLA shrinks it by caching a <em>smaller vector</em> per token and expanding it back out on demand.', 'note'));
      }
    });
    steps.push({
      title: 'Down-project: c = X·W_DKV — this is the only thing cached',
      formula: 'C = XW_{DKV} \\in \\mathbb{R}^{T\\times d_c},\\qquad d_c{=}4 \\ (\\text{vs. } d_{model}{=}8)',
      note: 'Every token\'s 8-wide vector is compressed to a 4-wide <em>latent</em>. Nothing else from this step is stored — not a per-head K, not a per-head V, just this one small row per token.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'X', shapeLabel: '4×8', matrix: R2(MLA.X), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_DKV (8×4)'));
        stage.appendChild(UI.matrixPanel({ title: 'C — latent (cached)', shapeLabel: 'T=4 × d_c=4', matrix: R2(MLA.C), fresh: true, meaning: 'Half the width of X. This row is what actually lives in GPU memory between generation steps.' }));
      }
    });
    steps.push({
      title: 'Up-project on the fly: K reconstructed from the latent',
      formula: 'K^{C} = C\\,W_{UK} \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'At attention time — not before — the cached latent is expanded back to full width. <code>K^C</code> is never itself written to the cache; it is recomputed from <code>C</code> every time it is needed, which costs a small matmul in exchange for a much smaller resident cache.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'C (from cache)', shapeLabel: '4×4', matrix: R2(MLA.C), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_UK (4×8)'));
        stage.appendChild(UI.matrixPanel({ title: 'K^C', shapeLabel: '4×8', matrix: R2(MLA.Kc), fresh: true }));
      }
    });
    steps.push({
      title: 'Up-project V the same way',
      formula: 'V^{C} = C\\,W_{UV} \\in \\mathbb{R}^{T\\times d_{model}}',
      note: 'A second, independent up-projection, from the same cached latent.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'C (from cache)', shapeLabel: '4×4', matrix: R2(MLA.C), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_UV (4×8)'));
        stage.appendChild(UI.matrixPanel({ title: 'V^C', shapeLabel: '4×8', matrix: R2(MLA.Vc), fresh: true }));
      }
    });
    steps.push({
      title: 'Simplification, stated plainly',
      formula: null,
      note: 'The real MLA design carries one more piece this walkthrough leaves out: a small extra key component, rotated by RoPE for position, computed once and cached <em>alongside</em> the latent (not reconstructed from it, since rotation and the up-projection do not commute cleanly). It is shared across heads and adds only a few dimensions per token. The compression above — the actual memory-saving trick — is complete and accurate; this is the part the animation omits for numeric clarity.',
      render: function (stage) {
        stage.appendChild(UI.textCard('Left out of the numbers above, present in the real design: a shared, RoPE-rotated key component <span>$k^{R}$</span>, cached next to <span>$C$</span>. See the DeepSeek-V2 paper (linked below) for the exact formulation.', 'warn'));
      }
    });
    steps.push({
      title: 'Split into heads, then standard scaled dot-product attention',
      formula: '\\text{out}_h = \\text{softmax}\\!\\left(\\frac{Q_h K^{C\\top}_h}{\\sqrt{d_h}}\\right) V^{C}_h',
      note: 'From here the mechanism is identical to MHA — same masking, same softmax, same weighted sum — operating on the reconstructed <code>K^C</code>, <code>V^C</code> instead of a directly-cached K, V.',
      render: function (stage) {
        stage.appendChild(UI.headsPanel({
          title: 'Attention output per head', groupMeaning: '',
          heads: MLA.heads.map(function (hh, h) { return { title: headLabel(h), shapeLabel: '4×2', matrix: R2(hh.out), fresh: true }; })
        }));
      }
    });
    steps.push({
      title: 'Concat + output projection',
      formula: 'Y = [\\text{out}_0\\Vert\\dots\\Vert\\text{out}_3]\\, W_O',
      note: 'Same epilogue as every other tab.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'concat', shapeLabel: '4×8', matrix: R2(MLA.concat), dim: true }));
        stage.appendChild(UI.arrow('⊗', '× W_O'));
        stage.appendChild(UI.matrixPanel({ title: 'Y', shapeLabel: '4×8', matrix: R2(MLA.Y), fresh: true }));
      }
    });
    steps.push({
      title: 'Cache size: compress the vector, not the head count',
      formula: null,
      note: 'In this toy example the latent is 4-wide against MHA\'s 16-wide K+V per token — a 4× reduction, for the same reason GQA achieved one, but via an entirely different mechanism. DeepSeek-V2\'s published numbers use a far more aggressive compression ratio at full model scale; see the paper for the exact figures rather than scaling this toy example up naively.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'KV cache size, per token, per layer', unit: ' numbers',
          items: [
            { label: 'MHA (K+V, 4 heads)', value: 2 * CFG.H * CFG.dH, colorVar: 'var(--know-cold)' },
            { label: 'MLA (latent only)', value: CFG.dC, colorVar: 'var(--accent)' }
          ],
          meaning: 'MLA\'s ratio improves further at real model scale, where d_c is chosen much smaller relative to H·d_h than this demo uses.'
        }));
      }
    });
    return steps;
  }

  // ============================================================ PAGED ATTENTION ============================================================
  function buildPaged() {
    var steps = [];
    steps.push({
      title: 'After the decode step: 5 tokens\' worth of cache',
      formula: null,
      note: 'The KV-cache tab left every head holding K, V for 5 tokens. This tab asks a different question: <em>where does that memory physically live</em>, and what happens as it keeps growing?',
      render: function (stage) {
        stage.appendChild(UI.textCard('This tab is about memory layout, not the attention arithmetic — the scores/softmax/weighted-sum steps are exactly the ones you already saw.', 'note'));
      }
    });
    steps.push({
      title: 'The naive approach: reserve a contiguous buffer up front',
      formula: null,
      note: 'A simple implementation reserves one contiguous block per request, sized for the longest sequence it might ever reach — say ' + PAGED.naiveBlocksReserved * CFG.blockSize + ' tokens. This request only ever uses ' + PAGED.T + '.',
      render: function (stage) {
        stage.appendChild(UI.stripPanel({
          title: 'Naive contiguous reservation', total: PAGED.naiveBlocksReserved * CFG.blockSize, filled: PAGED.T,
          meaning: (PAGED.naiveBlocksReserved * CFG.blockSize - PAGED.T) + ' slots reserved and sitting empty — for this request alone. Multiply by every concurrent request on the GPU.'
        }));
      }
    });
    steps.push({
      title: 'The fix: fixed-size blocks, allocated on demand',
      formula: null,
      note: 'PagedAttention (Kwon et al., 2023 — the vLLM paper) borrows OS-style virtual memory paging. The cache is divided into fixed-size <strong>blocks</strong> of ' + CFG.blockSize + ' tokens each. A request gets new blocks only as it actually needs them.',
      render: function (stage) {
        stage.appendChild(UI.textCard(PAGED.T + ' tokens ÷ ' + CFG.blockSize + ' per block = ' + PAGED.nLogicalBlocks + ' blocks needed — allocated one at a time as tokens 0–1, then 2–3, then 4 arrive.', 'note'));
      }
    });
    steps.push({
      title: 'Blocks come from a shared pool — and land anywhere',
      formula: null,
      note: 'The ' + PAGED.nLogicalBlocks + ' blocks this request needs are handed out from a shared pool of ' + PAGED.physicalPoolSize + ' physical blocks. Nothing requires them to be adjacent — and in this example, they deliberately are not.',
      render: function (stage) {
        stage.appendChild(UI.poolPanel({
          size: PAGED.physicalPoolSize, allocated: PAGED.blockTable.map(function (r) { return r.physical; }),
          meaning: 'Highlighted blocks are this request\'s 3 blocks — physical ids ' + PAGED.blockTable.map(function (r) { return '#' + r.physical; }).join(', ') + ', scattered on purpose.'
        }));
      }
    });
    steps.push({
      title: 'The block table: logical position → physical block',
      formula: null,
      note: 'Attention math still thinks in logical order — "token 4 is right after token 3." A small table translates that logical position into wherever the block actually sits in physical memory.',
      render: function (stage) {
        stage.appendChild(UI.blockTablePanel({ rows: PAGED.blockTable, meaning: 'One row per logical block this request has allocated so far.' }));
      }
    });
    steps.push({
      title: 'A lookup, traced through the table',
      formula: null,
      note: 'To gather K, V for token 4 (the 5th token, 0-indexed), the engine computes logical block <span>$\\lfloor 4/' + CFG.blockSize + '\\rfloor = ' + PAGED.blockTable[PAGED.blockTable.length - 1].logical + '$</span>, looks it up in the table, and follows it to physical block <strong>#' + PAGED.blockTable[PAGED.blockTable.length - 1].physical + '</strong>.',
      render: function (stage) {
        stage.appendChild(UI.blockTablePanel({ rows: PAGED.blockTable, highlightLogical: PAGED.blockTable[PAGED.blockTable.length - 1].logical, meaning: 'Highlighted row: the lookup for token 4.' }));
      }
    });
    steps.push({
      title: 'The payoff: identical prefixes can share a block',
      formula: null,
      note: 'If a second request starts with the same first ' + CFG.blockSize + ' tokens (a shared system prompt, for instance), its block table can point logical block 0 at the <strong>same physical block</strong> as the first request — no copy, no recomputation, and a cache hit on the prefill for that whole block.',
      render: function (stage) {
        var wrap = UI.el('div', 'lab-groupmap');
        var row1 = UI.el('div', 'lab-groupmap-row');
        row1.innerHTML = '<span class="lab-groupmap-q">request A · logical block 0</span><span class="lab-groupmap-arrow">→</span><span class="lab-groupmap-kv">physical #' + PAGED.blockTable[0].physical + '</span>';
        var row2 = UI.el('div', 'lab-groupmap-row');
        row2.innerHTML = '<span class="lab-groupmap-q">request B · logical block 0</span><span class="lab-groupmap-arrow">→</span><span class="lab-groupmap-kv">physical #' + PAGED.blockTable[0].physical + ' (same block)</span>';
        wrap.appendChild(row1); wrap.appendChild(row2);
        stage.appendChild(wrap);
        stage.appendChild(UI.checkBadge(true, 'one physical block, two requests reading it'));
      }
    });
    return steps;
  }

  // ============================================================ FLASH ATTENTION ============================================================
  function buildFlash() {
    var steps = [];
    var B = FLASH.B;
    steps.push({
      title: 'Same Q, K, V as MHA head 0 — computed a different way',
      formula: null,
      note: 'FlashAttention (Dao et al., 2022) changes <em>how</em> attention is computed, not the result. It never materializes the full <span>$T\\times T$</span> score matrix in memory — instead it streams ' + B + '×' + B + ' <strong>tiles</strong> through fast on-chip memory, one at a time, keeping a small running summary instead of the whole grid.',
      render: function (stage) {
        stage.appendChild(UI.textCard('Everything below is head 0 of the MHA tab, tiled into ' + FLASH.nTiles + '×' + FLASH.nTiles + ' blocks of ' + B + '×' + B + '. The final numbers must come out identical to that tab\'s output — this walkthrough checks that, at the end, by direct comparison.', 'note'));
      }
    });

    FLASH.tiles.forEach(function (tile, i) {
      steps.push({
        title: 'Query tile ' + i + ' begins (tokens ' + tile.qi0 + '–' + (tile.qi1 - 1) + ')',
        formula: 'm \\leftarrow -\\infty,\\quad l \\leftarrow 0,\\quad O \\leftarrow \\mathbf{0}',
        note: 'Three small running values per row are initialized: <span>$m$</span> (the largest score seen so far, for numerically stable softmax), <span>$l$</span> (the softmax denominator accumulated so far), and <span>$O$</span> (the weighted-value accumulator). These replace the entire row of a full score matrix — <span>$O(1)$</span> numbers per row instead of <span>$O(T)$</span>.',
        render: function (stage) {
          stage.appendChild(UI.textCard('Query tile ' + i + ': rows ' + tile.qi0 + '–' + (tile.qi1 - 1) + '. Key/value tiles it will visit: j = 0..' + i + ' (never j > ' + i + ' — those hold only future tokens).', 'note'));
        }
      });
      tile.jTrace.forEach(function (jt, jIdx) {
        var isDiag = jt.j === tile.i;
        steps.push({
          title: 'Tile (i=' + i + ', j=' + jt.j + '): compute S = Q_i·K_jᵀ/√d_h',
          formula: 'S_{ij} = \\frac{Q_i K_j^{\\top}}{\\sqrt{d_h}} \\in \\mathbb{R}^{' + B + '\\times' + (jt.kj1 - jt.kj0) + '}',
          note: isDiag
            ? 'This tile sits on the diagonal, so it needs an element-level causal mask: within these ' + B + '×' + (jt.kj1 - jt.kj0) + ' cells, some entries still refer to a future token relative to their row.'
            : 'Every key in this tile is strictly in the past for every query row in this tile — no masking needed.',
          render: function (stage) {
            stage.appendChild(UI.matrixPanel({
              title: 'S(' + i + ',' + jt.j + ')', shapeLabel: B + '×' + (jt.kj1 - jt.kj0), matrix: R2(jt.Sij),
              rowLabels: rowTokRange(B, tile.qi0), colLabels: rowTokRange(jt.kj1 - jt.kj0, jt.kj0),
              mask: jt.maskij, fresh: true
            }));
          }
        });
        steps.push({
          title: 'Update running max, sum, and output (tile ' + jt.j + ')',
          formula: 'm_{\\text{new}}=\\max(m,\\text{rowmax}(S)),\\ \\ l_{\\text{new}}=e^{m-m_{\\text{new}}}l + \\text{rowsum}(P),\\ \\ O_{\\text{new}}=e^{m-m_{\\text{new}}}O + PV',
          note: jIdx === 0
            ? 'First tile for this query row, so the old accumulator is empty: <span>$e^{m-m_{new}}=e^{-\\infty}=0$</span>, and the update reduces to simply reading off this tile\'s own contribution.'
            : 'This is the step that makes tiling possible at all: the <em>old</em> running total gets rescaled by <span>$e^{m_{old}-m_{new}}</span> = ' + jt.alpha.map(function (a) { return M.round(a, 3); }).join(', ') + '$ before the new tile\'s contribution is added — correcting for the fact that the running max just changed.',
          render: function (stage) {
            stage.appendChild(UI.matrixPanel({ title: 'm (running max)', shapeLabel: B + '×1', matrix: jt.mNew.map(function (v) { return [v]; }), fresh: true }));
            stage.appendChild(UI.matrixPanel({ title: 'l (running sum)', shapeLabel: B + '×1', matrix: R2(jt.lNew.map(function (v) { return [v]; })), fresh: true }));
            stage.appendChild(UI.matrixPanel({ title: 'O (running output, unnormalized)', shapeLabel: B + '×' + CFG.dH, matrix: R2(jt.Onew), fresh: true }));
          }
        });
      });
      steps.push({
        title: 'Finalize query tile ' + i + ': divide by l',
        formula: 'O_i^{\\text{final}} = O / l',
        note: 'One division per row turns the unnormalized running total into the real softmax-weighted average — the same division every softmax implicitly does, just deferred to the very end instead of upfront.',
        render: function (stage) {
          stage.appendChild(UI.matrixPanel({
            title: 'Output, tile ' + i + ' (tokens ' + tile.qi0 + '–' + (tile.qi1 - 1) + ')', shapeLabel: B + '×' + CFG.dH,
            matrix: R2(tile.Ofinal), fresh: true,
            meaning: 'These rows should already match the MHA tab\'s head-0 output for the same tokens — verified on the last step of this tab.'
          }));
        }
      });
    });
    steps.push({
      title: 'Combine every tile\'s output — and check it against MHA',
      formula: '\\max_{i,j}\\left|O^{\\text{flash}}_{ij} - O^{\\text{softmax}}_{ij}\\right| = ' + FLASH.maxAbsDiff.toExponential(2),
      note: 'Stitch the ' + FLASH.nTiles + ' finalized tiles back into one <span>$T\\times d_h$</span> matrix and compare it, cell by cell, against head 0\'s output from the plain softmax computation on the MHA tab.',
      render: function (stage) {
        stage.appendChild(UI.matrixPanel({ title: 'FlashAttention output', shapeLabel: '4×2', matrix: R2(FLASH.Ofull), fresh: true }));
        stage.appendChild(UI.matrixPanel({ title: 'MHA tab, head 0 (reference)', shapeLabel: '4×2', matrix: R2(FLASH.reference), dim: true }));
        stage.appendChild(UI.checkBadge(FLASH.maxAbsDiff < 1e-6, 'identical, up to floating-point noise (max |Δ| = ' + FLASH.maxAbsDiff.toExponential(1) + ')'));
      }
    });
    steps.push({
      title: 'What was actually saved',
      formula: null,
      note: 'At no point did a full ' + CFG.prefillLen + '×' + CFG.prefillLen + ' score matrix exist in memory — only ' + B + '×' + B + ' tiles, one at a time, plus two length-' + CFG.prefillLen + ' running vectors (<span>$m$</span>, <span>$l$</span>). That is <span>$O(T)$</span> extra memory instead of <span>$O(T^2)$</span> — the entire reason FlashAttention is a memory-traffic optimization, not a FLOPs one. Page <a href="./topics/23-efficient-ai-systems.html">23</a> covers why memory traffic, not raw compute, is the actual bottleneck at these sizes.',
      render: function (stage) {
        stage.appendChild(UI.barsPanel({
          title: 'Extra memory beyond Q, K, V, O', unit: ' numbers (this example)',
          items: [
            { label: 'naive: full T×T score matrix', value: CFG.prefillLen * CFG.prefillLen, colorVar: 'var(--know-cold)' },
            { label: 'flash: running m, l (2×T)', value: 2 * CFG.prefillLen, colorVar: 'var(--c-practice)' }
          ],
          meaning: 'The gap widens quadratically as T grows — at T=4,000 it is 16,000,000 vs. 8,000.'
        }));
      }
    });
    return steps;
  }

  var TABS = [
      { id: 'mha', label: 'Multi-Head Attention', short: 'MHA', color: 'var(--c-attention)', build: buildMHA },
      { id: 'kvcache', label: 'KV Cache', short: 'Cache', color: 'var(--c-practice)', build: buildKVCache },
      { id: 'mqa', label: 'Multi-Query Attention', short: 'MQA', color: 'var(--accent-2)', build: buildMQA },
      { id: 'gqa', label: 'Grouped-Query Attention', short: 'GQA', color: 'var(--c-gpu)', build: buildGQA },
      { id: 'mla', label: 'Multi-Head Latent Attention', short: 'MLA', color: 'var(--accent)', build: buildMLA },
      { id: 'paged', label: 'PagedAttention', short: 'Paged', color: 'var(--c-efficient)', build: buildPaged },
      { id: 'flash', label: 'FlashAttention', short: 'Flash', color: 'var(--c-frontier)', build: buildFlash }
  ];

  window.KMLLabSteps = { PRE: PRE, DEC: DEC, MQA: MQA, GQA: GQA, MLA: MLA, FLASH: FLASH, PAGED: PAGED, TABS: TABS };

  /* The contract the shared controller (lab-app.js) reads. */
  window.KML_LAB = {
    tabs: TABS,
    dims: [
      { sym: 'B', val: '1', def: 'Batch — how many independent sequences run side by side. Fixed to 1 throughout: batch just stacks an extra, fully independent copy of everything below. Nothing in this page interacts across the batch axis.' },
      { sym: 'T', val: '4', def: 'Sequence length — how many tokens exist so far. Starts at 4 (the prefill), grows to 5 once a token is generated.' },
      { sym: 'd_model', val: String(CFG.dModel), def: 'Model / embedding dimension — the width of every token\'s vector. The one number that stays constant through an entire layer.' },
      { sym: 'H', val: String(CFG.H), def: 'Query heads — how many independent attention "subspaces" the model splits d_model into.' },
      { sym: 'd_h', val: String(CFG.dH), def: 'Per-head dimension = d_model / H. Each head\'s Q, K, V rows live in this many dimensions.' }
    ],
    dimsFor: {
      gqa: [{ sym: 'G', val: String(CFG.gqaGroups), def: 'GQA groups — how many distinct key/value heads exist. Query heads are split evenly across them.' }],
      mqa: [{ sym: 'G', val: '1', def: 'MQA is GQA with exactly one group — every query head shares the same single key/value head.' }],
      mla: [{ sym: 'd_c', val: String(CFG.dC), def: 'MLA latent dimension — the width of the compressed vector that gets cached, instead of full-width K and V.' }],
      paged: [{ sym: 'blk', val: String(CFG.blockSize), def: 'Block size — how many tokens\' worth of K/V live in one fixed-size physical block.' }],
      flash: [{ sym: 'blk', val: String(CFG.blockSize), def: 'Tile size — how many rows/columns of the score matrix are computed together in one pass through fast memory.' }]
    },
    /* T grows as you step through the decode tab, so it is rewritten live */
    dimFix: function (tabId, stepIndex, list) {
      var T = list.filter(function (d) { return d.sym === 'T'; })[0];
      if (!T) return;
      if (tabId === 'paged') T.val = '5';
      else if (tabId === 'kvcache') T.val = stepIndex >= 1 ? '4→5' : '4';
      else T.val = '4';
    }
  };
})();
