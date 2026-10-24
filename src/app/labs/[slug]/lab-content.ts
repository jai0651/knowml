/* Generated once from the old static lab pages. Prose is trusted, first-party HTML. */
export interface LabContent { title:string; description:string; dek:string; prereq:string; howto:string; simplifies:string; scripts:string[]; related:{href:string;color:string;sec:string;title:string;hook:string}[] }
export const LABS: Record<string, LabContent> = {
 "attention-lab": {
  "title": "Attention Lab",
  "description": "Step through Multi-Head Attention, KV caching, MQA, GQA, Multi-Head Latent Attention, PagedAttention and FlashAttention on one small worked example, small enough to check every matrix and every shape by hand.",
  "dek": "One four-word sentence, run through seven different attention mechanisms. Every matrix comes from one seeded example — step through and watch the actual numbers, not a diagram of them.",
  "prereq": "Step through at your own pace · prerequisites: Attention & Transformers (08)",
  "howto": "<p>Pick a tab — <strong>MHA</strong> first if you're new to this, since every other tab reuses its vocabulary and its epilogue (concat, then one output projection). Every number below is computed by real matrix arithmetic in your browser from one seeded example (four tokens: \"<strong>The cat sat down</strong>\"), not hand-typed — the FlashAttention tab even checks its own answer against the plain-softmax result and shows you the difference.</p>",
  "simplifies": "<li><strong>No RoPE rotation is animated.</strong> Positions still matter — the causal mask depends on them — but the actual sinusoidal rotation of Q/K is left to page <a href=\"/topics/08-attention-transformers\">08</a>, so the numbers here stay focused on attention itself.</li>\n      <li><strong>MLA's decoupled rotary key is described, not computed.</strong> The compression trick that saves memory is fully accurate; the small extra cached key component is mentioned in its own step rather than added to the arithmetic.</li>\n      <li><strong>Batch is fixed at 1.</strong> Every tensor shown is for one sequence. Add a batch dimension and every shape below just gains an outer <code>B ×</code> — nothing about the math inside changes.</li>\n      <li><strong>Every dimension is tiny.</strong> Real models use <code>d_model</code> in the thousands and dozens of heads. The mechanisms are identical at that scale — only the grids would no longer fit on a screen.</li>",
  "scripts": [
   "lab-engine.js",
   "attention-lab-model.js",
   "lab-ui.js",
   "attention-lab-steps.js",
   "lab-app.js"
  ],
  "related": [
   {
    "href": "/topics/08-attention-transformers",
    "color": "var(--c-attention)",
    "sec": "08 · Where this starts",
    "title": "Attention & Transformers",
    "hook": "The Q/K/V derivation, the √d_k scaling proof, and multi-head attention explained in prose."
   },
   {
    "href": "/topics/23-efficient-ai-systems",
    "color": "var(--c-efficient)",
    "sec": "23 · The systems view",
    "title": "Efficient AI & Systems",
    "hook": "Why FlashAttention and PagedAttention exist: the memory-bandwidth argument in full."
   },
   {
    "href": "/topics/31-llm-inference-serving",
    "color": "var(--c-practice)",
    "sec": "31 · Serving depth",
    "title": "LLM Inference & Serving",
    "hook": "What the KV cache costs at serving scale, and the engines built around managing it."
   },
   {
    "href": "/topics/33-model-atlas-language",
    "color": "var(--c-atlas)",
    "sec": "33 · Which models use what",
    "title": "Model Atlas: Language Models",
    "hook": "GQA, MLA and dense vs. mixture-of-experts, across the 2026 model landscape."
   }
  ]
 },
 "backprop-lab": {
  "title": "Backprop Lab",
  "description": "Backpropagation through a 3→4→2 network: the forward pass, the chain rule backward one derivative at a time, every gradient checked against central differences, and one step of descent that actually lowers the loss.",
  "dek": "One tiny network — 3 inputs, 4 tanh hidden units, 2 outputs — and one training example. Step through the forward pass, then walk the chain rule backward one derivative at a time, then watch all 29 of those derivatives get re-measured numerically and compared against the analytic ones.",
  "prereq": "Step through at your own pace · prerequisites: Neural Network Fundamentals (04)",
  "howto": "<p>Take the tabs in order — <strong>Forward</strong> first, since every gradient on the later tabs is a derivative of the loss it computes. Each backward step shows three things side by side: the <strong>local derivative</strong> of that one operation, the <strong>incoming gradient</strong> from the step above it, and their <strong>product</strong>. That is the chain rule made visible rather than asserted.</p>\n    <p>The tab that matters most is <strong>Gradient check</strong>. It throws the whole derivation away and re-measures every partial derivative the slow way — nudge one parameter by <code>h</code>, re-run the entire network, see how much the loss moved — then prints the largest disagreement between the two methods. Every number on this page, including that verdict, is computed by real arithmetic in your browser from one seeded example. Nothing is hand-typed.</p>",
  "simplifies": "<li><strong>One hidden layer, not many.</strong> The backward pass here is nine steps long. A deep network repeats steps 5–8 once per layer and changes nothing else — the gradient of the input, <code>∂L/∂x</code>, is precisely the tensor the layer below would receive as its incoming gradient.</li>\n      <li><strong>The loss is half sum-of-squares, not cross-entropy.</strong> Squared error keeps the first gradient equal to the residual, so the chain is easy to follow all the way down. Softmax with cross-entropy produces the same \"gradient equals residual\" shortcut one layer later; everything behind that point is identical to what is shown here.</li>\n      <li><strong>Plain gradient descent, no optimiser.</strong> The descent tab subtracts <code>η · ∇L</code> and stops. Momentum, Adam's per-parameter scaling, weight decay and learning-rate schedules all change what is done <em>with</em> the gradients, not how the gradients are computed.</li>\n      <li><strong>No regularisation, no dropout, no normalisation layers.</strong> Each would add its own local derivative to the chain. None would change the structure of the chain.</li>\n      <li><strong>Batch is 2, and only on the last tab.</strong> Big enough to show where the batch axis gets summed away and where it survives , small enough that every row still fits on screen.</li>\n      <li><strong>Every dimension is tiny.</strong> Real networks have millions of parameters and would never print their gradients. They are also never gradient-checked at full size — the check is run on a small case exactly like this one, and that is the honest reason this page can run it at all.</li>",
  "scripts": [
   "lab-engine.js",
   "backprop-lab-model.js",
   "lab-ui.js",
   "backprop-lab-steps.js",
   "lab-app.js"
  ],
  "related": [
   {
    "href": "/topics/04-neural-network-fundamentals",
    "color": "var(--c-nn)",
    "sec": "04 · Where this starts",
    "title": "Neural Network Fundamentals",
    "hook": "Backprop, activations, initialisation and the vanishing-gradient problem, explained in prose."
   },
   {
    "href": "/topics/01-math-foundations",
    "color": "var(--c-math)",
    "sec": "01 · Prerequisite",
    "title": "Math & Stats Foundations",
    "hook": "The chain rule, Jacobians and gradient descent — the two ideas this whole lab runs on."
   },
   {
    "href": "/labs/attention-lab",
    "color": "var(--accent-text)",
    "sec": "Interactive",
    "title": "Attention Lab",
    "hook": "The same treatment for attention: seven mechanisms on one worked example, FlashAttention checked against the naive result."
   },
   {
    "href": "/topics/23-efficient-ai-systems",
    "color": "var(--c-efficient)",
    "sec": "23 · Why training costs what it does",
    "title": "Efficient AI & Systems",
    "hook": "Activation checkpointing, mixed precision and gradient accumulation — all consequences of the tape this lab builds."
   }
  ]
 },
 "tokenizer-lab": {
  "title": "Tokenizer Lab",
  "description": "Train a byte-pair-encoding tokenizer from scratch on a seven-word corpus, one merge at a time, following every pair count, every merge and every token, then see exactly why a model that reads tokens cannot count the letters in strawberry.",
  "dek": "Seven words, twelve merges, one vocabulary — built in front of you. Every pair count, every merge decision and every token on this page comes from running byte-pair encoding, not drawn as a diagram of it. By the last tab you will know precisely why a model that reads tokens cannot count the letters in \"strawberry\".",
  "prereq": "Step through at your own pace · prerequisites: NLP Evolution (09)",
  "howto": "<p>Start on <strong>Train BPE</strong> — the other three tabs all use the vocabulary it builds. There is no random seed anywhere on this page: given the corpus and the tie-break rule, byte-pair encoding is deterministic, so every count you see is reproducible with a pencil. The <strong>Train</strong> and <strong>Encode</strong> tabs each end with a self-check that recomputes their result by a second, independent route and prints whether the two agree.</p>",
  "simplifies": "<li><strong>The base vocabulary is characters, not bytes.</strong> Real tokenizers start from the 256 byte values, which makes out-of-vocabulary impossible — any text at all, in any script, is <em>some</em> sequence of bytes. Starting from the characters this corpus happens to contain leaves a visible hole: the Encode tab shows <code>cranberry</code> needing letters the vocabulary has no id for. That hole is exactly what byte-level BPE closes.</li>\n      <li><strong>No word-boundary marker.</strong> Production tokenizers attach the preceding space to the token (<code>\" berry\"</code> and <code>\"berry\"</code> are different ids) or append an end-of-word symbol, so merges can never cross a word boundary and word-final pieces stay distinct. Here each word is merged independently with no marker, which keeps the chips readable at the cost of that distinction.</li>\n      <li><strong>Ties are broken by first appearance.</strong> In a corpus this small several pairs routinely tie for most frequent. Different libraries break ties differently, and a different rule gives a different — equally valid — merge list. The Train tab flags every tie as it happens.</li>\n      <li><strong>No special tokens, no normalization, no pre-tokenization regex.</strong> A real pipeline lowercases or not, splits punctuation and digits by an explicit regex, and reserves ids for <code>&lt;|endoftext|&gt;</code> and friends before the first merge is ever applied. All of that sits <em>around</em> the algorithm shown here, not inside it.</li>\n      <li><strong>Twelve merges, not fifty thousand.</strong> The loop is identical at production scale; only the size of the counting problem changes. The final tab's curve is the same curve real tokenizer designers read, computed on a corpus small enough to check by hand.</li>",
  "scripts": [
   "lab-engine.js",
   "tokenizer-lab-model.js",
   "lab-ui.js",
   "tokenizer-lab-steps.js",
   "lab-app.js"
  ],
  "related": [
   {
    "href": "/topics/09-nlp-evolution",
    "color": "var(--c-nlp)",
    "sec": "09 · Where this starts",
    "title": "NLP Evolution",
    "hook": "Why subword tokenization replaced word vocabularies, and where BPE, WordPiece and SentencePiece differ."
   },
   {
    "href": "/topics/10-llm-architecture-training",
    "color": "var(--c-llm)",
    "sec": "10 · The design decision",
    "title": "LLM Architecture & Training",
    "hook": "Vocabulary size as a real tradeoff: embedding parameters against sequence length, in production terms."
   },
   {
    "href": "/labs/attention-lab",
    "color": "var(--c-attention)",
    "sec": "Lab · What happens next",
    "title": "Attention Lab",
    "hook": "The token ids this page produces, picked up at the embedding table and run through seven attention mechanisms."
   },
   {
    "href": "/topics/31-llm-inference-serving",
    "color": "var(--c-practice)",
    "sec": "31 · What tokens cost",
    "title": "LLM Inference & Serving",
    "hook": "Why every extra token is billed twice — once in the context window, once in decode latency."
   }
  ]
 },
 "sampling-lab": {
  "title": "Sampling Lab",
  "description": "Step through how a next-token distribution becomes an actual token: the softmax and why it subtracts the max, temperature, top-k, top-p/nucleus and the draw itself — every logit, every probability and every count, on a vocabulary small enough to check by hand.",
  "dek": "A model does not pick a word. It produces one row of numbers, and everything that decides which token you see happens afterwards. Step through that afterwards — softmax, temperature, top-k, top-p, and the draw itself — on one seeded example you can follow end to end.",
  "prereq": "Step through at your own pace · prerequisites: none beyond knowing what a logit is",
  "howto": "<p>Start with <strong>Softmax</strong> — every later tab operates on the distribution it builds. Two prompts run throughout: a <em>focused</em> one (\"The cat sat on the ___\"), where the model is nearly certain, and an <em>open</em> one (\"On Saturday I went down to the ___\"), where a dozen continuations are about equally good. That pairing is the point: the <strong>Top-p</strong> tab shows a case where top-k and top-p choose genuinely different candidate sets, in opposite directions on the two rows, which is the whole argument for nucleus sampling. The Softmax tab also checks its own arithmetic — that the row sums to 1, that subtracting the max changes nothing, and that skipping it returns <code>NaN</code>.</p>",
  "simplifies": "<li><strong>The vocabulary is 12 tokens, not 50,000.</strong> Every operation here — the softmax, the sort, the cumulative sum, the renormalisation — is exactly what runs over a real vocabulary; only the row width changes. What a real vocabulary adds is a very long, very flat tail, which is precisely what top-k and top-p exist to cut off, so the arguments on this page get <em>stronger</em> at scale, not weaker.</li>\n      <li><strong>The words are labels; the numbers are computed.</strong> The hidden states and the unembedding matrix are drawn from one seeded random stream, so the logits are whatever the arithmetic says. The candidate words are then attached in plausibility order — highest logit to the most plausible continuation — and displayed alphabetically so no row on the page arrives pre-sorted. Nothing numeric is hand-chosen.</li>\n      <li><strong>Two hidden states were selected, not invented.</strong> Each context picks its hidden state from a pool of 48 candidates drawn from the same seeded stream: the one landing closest to 85% top-1 confidence for the focused context, and the flattest of all 48 for the open one. That selection is the only editorial choice on the page — everything downstream of it is plain arithmetic.</li>\n      <li><strong>One position, one step.</strong> Real generation repeats all of this once per token, feeding each drawn token back in, which is where repetition penalties, beam search and speculative decoding live. This page stops at the first draw.</li>\n      <li><strong>Only the three settings everyone actually ships are covered.</strong> Temperature, top-k and top-p. Min-p, typical sampling, epsilon/eta sampling, Mirostat and contrastive search are all variations on the same two moves shown here: reshape the row, then truncate it before drawing.</li>\n      <li><strong>Sampling is done with a seeded PRNG.</strong> <code>mulberry32</code> is not a cryptographic generator and a real server's RNG is not either — but \"uniform on [0,1)\" is all the inverse-CDF draw needs, and seeding it is what makes the counts on the last tab identical on every reload.</li>",
  "scripts": [
   "lab-engine.js",
   "sampling-lab-model.js",
   "lab-ui.js",
   "sampling-lab-steps.js",
   "lab-app.js"
  ],
  "related": [
   {
    "href": "/labs/attention-lab",
    "color": "var(--c-attention)",
    "sec": "Lab · The sibling page",
    "title": "Attention Lab",
    "hook": "The same treatment for the other end of the model: MHA, KV caching, MQA, GQA, MLA, PagedAttention and FlashAttention on one worked example."
   },
   {
    "href": "/topics/10-llm-architecture-training",
    "color": "var(--c-llm)",
    "sec": "10 · Where logits come from",
    "title": "LLM Architecture & Training",
    "hook": "The unembedding head and the cross-entropy objective that trains these logits in the first place."
   },
   {
    "href": "/topics/08-attention-transformers",
    "color": "var(--c-attention)",
    "sec": "08 · The same softmax",
    "title": "Attention & Transformers",
    "hook": "Attention weights are this page's softmax applied to a different row — including why the scores get divided by √d_k first."
   },
   {
    "href": "/topics/31-llm-inference-serving",
    "color": "var(--c-practice)",
    "sec": "31 · Where the knobs live",
    "title": "LLM Inference & Serving",
    "hook": "What temperature, top-k and top-p cost in a real serving stack, alongside batching, the KV cache and speculative decoding."
   }
  ]
 },
 "quantization-lab": {
  "title": "Quantization Lab",
  "description": "Quantize one small weight matrix to INT8 and INT4 and watch exactly what is lost — scales, integer codes, dequantized weights and the error matrix, plus the outlier that wastes 87% of the integer range and the per-channel fix that recovers it.",
  "dek": "One small weight matrix, squeezed into 8-bit and 4-bit integers four different ways. Every scale, every integer code and every last decimal of error, including the single outlier that quietly costs the other weights most of their precision, and the one-line change that gives it back.",
  "prereq": "Step through at your own pace · prerequisites: Efficient AI & Systems (23)",
  "howto": "<p>Start with <strong>INT8</strong> — the other three tabs reuse its vocabulary (α, the scale <em>s</em>, the integer codes <em>q</em>, the error matrix <em>E</em>) and its numbers as the baseline they are measured against. Every figure you read is arithmetic done in the page from one seeded 4×8 weight block, not a hand-typed illustration: the INT8 tab checks its own dequantized values against <code>code × scale</code> computed by hand, proves quantizing twice changes nothing, and confirms that no weight was moved by more than half a grid step. The <strong>Outlier</strong> tab is the one that explains why quantization is a research area rather than a utility function.</p>",
  "simplifies": "<li><strong>Only weights are quantized, never activations.</strong> Weight-only quantization is the easy half: weights are fixed, known offline, and can be measured exactly. Activations change with every input, so their scale has to be estimated from calibration data or computed on the fly — and they are where the really vicious outliers live. Everything on this page applies to activations too, but the scale would be a guess rather than a measurement.</li>\n      <li><strong>Symmetric only — no zero-point.</strong> The scheme here maps 0 to code 0 and uses a single multiplier. Asymmetric (affine) quantization adds an integer offset <code>z</code> so the grid can be shifted, which fits skewed distributions better and costs one more stored number per scale. The error analysis is structurally identical; only <code>W′ = (q − z)·s</code> replaces <code>W′ = q·s</code>.</li>\n      <li><strong>Round-to-nearest, with no error compensation.</strong> Every rounding decision here is made independently. GPTQ, AdaRound and friends deliberately round some weights the \"wrong\" way so that the error they introduce cancels against errors elsewhere in the same layer. That changes which codes get chosen; it does not change what a code means.</li>\n      <li><strong>The block is tiny.</strong> Four output channels and eight input dimensions, so every grid fits on a screen and every cell can be checked by hand. A real layer is 4096×4096. Nothing in the arithmetic changes — but note that the per-channel scale overhead, which looks expensive at 8 weights per row, is 0.1% at 4096 weights per row.</li>\n      <li><strong>No kernel, no hardware.</strong> This page shows what the numbers become, not how an INT8 matmul is actually executed, how 4-bit weights are packed two-to-a-byte, or which instructions accumulate in INT32. That side of the story is on page <a href=\"/topics/28-gpu-architecture-cuda-distributed\">28</a>.</li>",
  "scripts": [
   "lab-engine.js",
   "quantization-lab-model.js",
   "lab-ui.js",
   "quantization-lab-steps.js",
   "lab-app.js"
  ],
  "related": [
   {
    "href": "/topics/23-efficient-ai-systems",
    "color": "var(--c-efficient)",
    "sec": "23 · Where this starts",
    "title": "Efficient AI & Systems",
    "hook": "Quantization, pruning and distillation in prose: why memory, not FLOPs, is the binding constraint."
   },
   {
    "href": "/topics/31-llm-inference-serving",
    "color": "var(--c-practice)",
    "sec": "31 · Serving depth",
    "title": "LLM Inference & Serving",
    "hook": "What weight and KV-cache precision cost at serving scale, and the engines built around them."
   },
   {
    "href": "/topics/30-running-models-locally",
    "color": "var(--c-practice)",
    "sec": "30 · In practice",
    "title": "Running Models Locally",
    "hook": "GGUF quantization levels, group sizes, and which 4-bit variant to actually download."
   },
   {
    "href": "/labs/attention-lab",
    "color": "var(--c-attention)",
    "sec": "Lab · The other one",
    "title": "Attention Lab",
    "hook": "Seven attention mechanisms on one four-word sentence."
   }
  ]
 }
};
