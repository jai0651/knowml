/* KnowML — technique taxonomy data, powering the Technique Map page and the
   embedded mini-trees on individual topic pages. Every entry is grounded in
   the prose of the linked page — nothing here is invented; stub-sourced
   entries (from pages not yet fully written) are marked as such instead of
   given a fabricated description. */
window.KML_TECHTREE = [
  {
    name: 'Foundations', color: 'var(--c-math)', children: [
      { name: 'Iterative loss minimization', children: [
        { name: 'Gradient descent', desc: 'Iteratively steps parameters opposite the loss gradient to reach a minimum.', page: '01-math-foundations' },
        { name: 'Stochastic gradient descent (SGD)', desc: 'Estimates the gradient from a random minibatch instead of the full dataset.', page: '01-math-foundations' },
        { name: 'Momentum', desc: 'Keeps a running average of past gradients to dampen zigzag on bad surfaces.', page: '01-math-foundations' },
        { name: 'Adam', desc: 'Combines a momentum-like average with a per-parameter adaptive step size.', page: '01-math-foundations' },
        { name: 'AdamW', desc: "Decouples weight decay, subtracting it directly from parameters.", page: '01-math-foundations' }
      ]},
      { name: 'Computing gradients through a network', children: [
        { name: 'Backpropagation', desc: "Applies the chain rule layer by layer to compute every weight's gradient.", page: '01-math-foundations' }
      ]},
      { name: 'Probabilistic parameter estimation', children: [
        { name: "Bayes' theorem", desc: 'Converts a prior belief plus evidence into an updated posterior belief.', page: '01-math-foundations' },
        { name: 'Maximum likelihood estimation (MLE)', desc: 'Maximizes the probability of observed data given parameters.', page: '01-math-foundations' },
        { name: 'Maximum a posteriori (MAP)', desc: 'Maximizes likelihood times a prior; L2/L1 regularization are special cases.', page: '01-math-foundations' },
        { name: 'Full Bayesian inference', desc: 'Keeps the entire posterior distribution instead of one point estimate.', page: '01-math-foundations' }
      ]},
      { name: 'Distribution-mismatch loss functions', children: [
        { name: 'Cross-entropy loss', desc: "Scores a model's predicted distribution against the true one.", page: '01-math-foundations' },
        { name: 'KL divergence', desc: 'Measures the gap between two distributions.', page: '01-math-foundations' }
      ]},
      { name: 'Model confidence calibration', children: [
        { name: 'Temperature scaling', desc: 'Divides logits by a learned scalar to fix overconfidence.', page: '01-math-foundations' }
      ]},
      { name: 'Compressing a model', children: [
        { name: 'Knowledge distillation', desc: "Trains a small model to match a large model's output distribution.", page: '01-math-foundations' }
      ]},
      { name: 'Linear dimensionality reduction', children: [
        { name: 'PCA', desc: 'Projects data onto top eigenvectors of the covariance matrix.', page: '01-math-foundations' },
        { name: 'SVD', desc: 'Factors any matrix into a rotation, a scaling, and another rotation.', page: '01-math-foundations' },
        { name: 'ICA', desc: 'Finds statistically independent, non-Gaussian components.', page: '03-unsupervised-self-supervised' },
        { name: 'NMF', desc: 'Constrains factors to be non-negative, yielding parts-based components.', page: '03-unsupervised-self-supervised' }
      ]},
      { name: 'Non-convex clustering via graph embedding', children: [
        { name: 'Spectral clustering', desc: "Runs k-means on eigenvectors of a similarity graph's Laplacian.", page: '03-unsupervised-self-supervised' }
      ]},
      { name: 'Interpretable linear regression', children: [
        { name: 'Linear regression', desc: 'Fits a line or hyperplane minimizing squared distance to every point.', page: '02-classical-ml' },
        { name: 'Polynomial regression', desc: 'Adds polynomial/interaction terms so linear regression fits curves.', page: '02-classical-ml' },
        { name: 'Ridge (L2) regression', desc: 'Adds a squared-coefficient penalty, shrinking coefficients toward zero.', page: '02-classical-ml' },
        { name: 'Lasso (L1) regression', desc: 'Adds an absolute-value penalty that can zero coefficients out entirely.', page: '02-classical-ml' }
      ]},
      { name: 'Linear classification', children: [
        { name: 'Logistic regression', desc: 'Squashes a linear output through a sigmoid, fit with cross-entropy.', page: '02-classical-ml' },
        { name: 'Perceptron', desc: 'A single linear classifier trained by nudging weights toward misclassified points.', page: '02-classical-ml' }
      ]},
      { name: 'Tree-based models', children: [
        { name: 'Decision trees (CART/ID3)', desc: 'Repeatedly splits data on the single best yes/no feature question.', page: '02-classical-ml' },
        { name: 'Bagging', desc: 'Averages many trees, each on a different bootstrap resample.', page: '02-classical-ml' },
        { name: 'Random forests', desc: 'Bagging plus random feature subsampling per split.', page: '02-classical-ml' },
        { name: 'Gradient boosting', desc: "Fits each new tree to the ensemble's current residual error.", page: '02-classical-ml' },
        { name: 'XGBoost', desc: 'Regularized, systems-optimized gradient boosting for speed at scale.', page: '02-classical-ml' },
        { name: 'LightGBM', desc: 'Gradient boosting optimized for very large datasets via histogram splitting.', page: '02-classical-ml' },
        { name: 'CatBoost', desc: 'Gradient boosting optimized for datasets with many categorical features.', page: '02-classical-ml' }
      ]},
      { name: 'Margin-based & instance-based classification', children: [
        { name: 'Support vector machine (SVM)', desc: 'Picks the linear boundary maximizing margin to the nearest points.', page: '02-classical-ml' },
        { name: 'Kernel trick', desc: 'Substitutes a similarity function for dot products for nonlinear boundaries.', page: '02-classical-ml' },
        { name: 'k-nearest neighbors (k-NN)', desc: 'Classifies a point by majority vote among its k closest neighbors.', page: '02-classical-ml' },
        { name: 'Naive Bayes', desc: 'Applies Bayes’ theorem assuming features are conditionally independent.', page: '02-classical-ml' }
      ]},
      { name: 'Clustering', children: [
        { name: 'k-means', desc: 'Alternates assigning points to nearest centroid and recomputing centroids.', page: '03-unsupervised-self-supervised' },
        { name: 'k-means++', desc: 'A smarter centroid initialization that spreads out starting points.', page: '03-unsupervised-self-supervised' },
        { name: 'Hierarchical (agglomerative) clustering', desc: 'Merges the two closest clusters repeatedly, building a dendrogram.', page: '03-unsupervised-self-supervised' },
        { name: 'DBSCAN', desc: 'Grows clusters by chaining dense points, labeling sparse points as noise.', page: '03-unsupervised-self-supervised' },
        { name: 'Gaussian Mixture Model (GMM)', desc: 'Assumes data comes from k Gaussians, giving soft cluster membership.', page: '03-unsupervised-self-supervised' },
        { name: 'Expectation-Maximization (EM)', desc: 'Alternates computing soft responsibilities and refitting parameters.', page: '03-unsupervised-self-supervised' }
      ]},
      { name: 'Reconstruction-based representation learning', children: [
        { name: 'Autoencoder', desc: 'Compresses input through a bottleneck and reconstructs it.', page: '03-unsupervised-self-supervised' },
        { name: 'Denoising autoencoder', desc: 'Reconstructs a clean input from a corrupted version.', page: '03-unsupervised-self-supervised' },
        { name: 'Variational Autoencoder (VAE)', desc: 'Encodes to a distribution, regularized toward a prior for generation.', page: '03-unsupervised-self-supervised' }
      ]},
      { name: 'Contrastive & joint-embedding self-supervision', children: [
        { name: 'SimCLR', desc: "Pulls two augmented views' embeddings together, pushes others apart.", page: '03-unsupervised-self-supervised' },
        { name: 'MoCo', desc: 'Gets many negatives via a queue from a momentum-updated encoder.', page: '03-unsupervised-self-supervised' },
        { name: 'BYOL', desc: 'Avoids negative pairs using an online/target asymmetry with stop-gradient.', page: '03-unsupervised-self-supervised' },
        { name: 'SimSiam', desc: 'Simplifies BYOL by dropping the momentum encoder.', page: '03-unsupervised-self-supervised' },
        { name: 'CLIP', desc: 'Contrasts matched image-text pairs against mismatched ones.', page: '03-unsupervised-self-supervised' }
      ]},
      { name: 'Masked & autoregressive pretraining', children: [
        { name: 'BERT masked language modeling', desc: 'Hides ~15% of tokens, trains bidirectional prediction of them.', page: '03-unsupervised-self-supervised' },
        { name: 'MAE masked image modeling', desc: 'Masks ~75% of image patches, reconstructs missing pixels.', page: '03-unsupervised-self-supervised' },
        { name: 'GPT-style next-token prediction', desc: 'Pretrains by predicting the next token at massive scale.', page: '03-unsupervised-self-supervised' }
      ]},
      { name: 'High-dimensional data visualization', children: [
        { name: 't-SNE', desc: 'Preserves local neighborhood structure when projecting to 2D/3D.', page: '03-unsupervised-self-supervised' },
        { name: 'UMAP', desc: 'Like t-SNE, preserves local structure via a neighbor-count hyperparameter.', page: '03-unsupervised-self-supervised' }
      ]}
    ]
  },
  {
    name: 'Neural Nets & Vision', color: 'var(--c-nn)', children: [
      { name: 'Activation functions', children: [
        { name: 'ReLU', desc: 'max(0,z); derivative is exactly 1 for positive inputs.', page: '04-neural-network-fundamentals' },
        { name: 'LeakyReLU', desc: 'Adds a small non-zero slope for negative inputs to fix dying units.', page: '04-neural-network-fundamentals' },
        { name: 'GELU', desc: 'A smooth gate giving better-behaved gradients than ReLU in transformers.', page: '04-neural-network-fundamentals' },
        { name: 'SiLU (Swish)', desc: 'A smooth, non-zero-gradient activation used in transformer FFN blocks.', page: '04-neural-network-fundamentals' },
        { name: 'SwiGLU', desc: 'A gated SiLU variant used in modern LLM feed-forward blocks.', page: '04-neural-network-fundamentals' }
      ]},
      { name: 'Normalizing activations', children: [
        { name: 'BatchNorm', desc: "Normalizes each feature's statistics across the batch.", page: '04-neural-network-fundamentals' },
        { name: 'LayerNorm', desc: 'Normalizes all features within one example, independent of batch size.', page: '04-neural-network-fundamentals' },
        { name: 'RMSNorm', desc: 'Normalizes only by root-mean-square magnitude; default in modern LLMs.', page: '04-neural-network-fundamentals' },
        { name: 'GroupNorm', desc: 'Normalizes a group of channels within one example.', page: '04-neural-network-fundamentals' }
      ]},
      { name: 'Training very deep networks', children: [
        { name: 'Residual connections', desc: 'Computes f(x)+x instead of f(x), so identity is the default path.', page: '04-neural-network-fundamentals' },
        { name: 'ResNet', desc: 'Took ImageNet networks from ~19 layers to 152 layers via residual blocks.', page: '05-cnn-vision-foundations' },
        { name: 'Mixed precision training', desc: 'Stores computation in FP16/BF16 with an FP32 master weight copy.', page: '04-neural-network-fundamentals' }
      ]},
      { name: 'Image feature extraction & classification (CNNs)', children: [
        { name: 'Convolution', desc: 'A small learned filter slid across every image position via weight sharing.', page: '05-cnn-vision-foundations' },
        { name: 'LeNet', desc: 'Established the conv-pool-classifier template on small images.', page: '05-cnn-vision-foundations' },
        { name: 'AlexNet', desc: 'Trained a deep CNN end-to-end on GPUs, beating hand-engineered features.', page: '05-cnn-vision-foundations' },
        { name: 'VGG', desc: 'Stacks small 3×3 convolutions repeatedly.', page: '05-cnn-vision-foundations' },
        { name: 'Inception / GoogLeNet', desc: 'Runs multiple filter sizes in parallel within one layer.', page: '05-cnn-vision-foundations' },
        { name: 'DenseNet', desc: 'Connects each layer to every previous layer via concatenation.', page: '05-cnn-vision-foundations' },
        { name: 'EfficientNet', desc: 'Scales depth, width, and resolution together via compound scaling.', page: '05-cnn-vision-foundations' },
        { name: 'MobileNet', desc: 'Built from depthwise separable convolutions for on-device inference.', page: '05-cnn-vision-foundations' },
        { name: 'ConvNeXt', desc: "Modernized ResNet's recipe to match ViT-era accuracy as a pure CNN.", page: '05-cnn-vision-foundations' }
      ]},
      { name: 'Object detection & segmentation', children: [
        { name: 'R-CNN family (two-stage)', desc: 'Proposes candidate regions first, then classifies and refines each.', page: '05-cnn-vision-foundations' },
        { name: 'YOLO / SSD (one-stage)', desc: 'Predict every box and class directly in a single forward pass.', page: '05-cnn-vision-foundations' },
        { name: 'Mask R-CNN', desc: 'Extends Faster R-CNN with a branch predicting a pixel mask per region.', page: '05-cnn-vision-foundations' },
        { name: 'U-Net', desc: 'An encoder-decoder with skip connections carrying fine spatial detail.', page: '05-cnn-vision-foundations' }
      ]},
      { name: 'Attention-based vision backbones', children: [
        { name: 'Vision Transformer (ViT)', desc: 'Splits an image into patches, treats them as tokens for a transformer.', page: '06-modern-vision-foundation-models' }
      ]},
      { name: 'Vision-language alignment', children: [
        { name: 'CLIP', desc: 'Trains paired image/text encoders so matching pairs land close together.', page: '06-modern-vision-foundation-models' }
      ]},
      { name: 'Promptable segmentation', children: [
        { name: 'Segment Anything (SAM)', desc: 'A promptable model producing a mask from a point, box, or mask hint.', page: '06-modern-vision-foundation-models' }
      ]},
      { name: '3D scene representation', children: [
        { name: 'NeRF', desc: 'A neural network mapping a 3D point and view direction to color/density.', page: '06-modern-vision-foundation-models' },
        { name: 'Gaussian Splatting', desc: 'Represents a scene as 3D Gaussian blobs rendered by direct projection.', page: '06-modern-vision-foundation-models' }
      ]}
    ]
  },
  {
    name: 'Sequence, Attention & LLMs', color: 'var(--c-attention)', children: [
      { name: 'Sequential memory & long-range dependencies', children: [
        { name: 'Recurrent Neural Network (RNN)', desc: 'Updates a fixed-size hidden state each timestep using shared weights.', page: '07-sequence-modeling-pre-transformer' },
        { name: 'LSTM', desc: 'Uses a gated, additive cell state so gradients pass through almost unchanged.', page: '07-sequence-modeling-pre-transformer' },
        { name: 'GRU', desc: 'Merges the cell and hidden state, using two gates instead of three.', page: '07-sequence-modeling-pre-transformer' }
      ]},
      { name: 'Sequence-to-sequence translation', children: [
        { name: 'Seq2seq', desc: 'Chains an encoder and decoder RNN through one fixed-size context vector.', page: '07-sequence-modeling-pre-transformer' },
        { name: 'Bahdanau attention', desc: 'Lets the decoder look back at every encoder hidden state, weighted.', page: '07-sequence-modeling-pre-transformer' }
      ]},
      { name: 'Parallel long-range token mixing', children: [
        { name: 'Scaled dot-product attention', desc: 'Weighted average of value vectors using softmaxed query-key similarity.', page: '08-attention-transformers' },
        { name: 'Multi-head attention', desc: 'Runs several smaller attention operations in parallel.', page: '08-attention-transformers' },
        { name: 'Transformer', desc: 'Stacks attention and feed-forward blocks with residuals, no recurrence.', page: '08-attention-transformers' },
        { name: 'Mamba-style state-space models', desc: 'Research alternative to quadratic attention for very long context.', page: '08-attention-transformers' }
      ]},
      { name: 'Positional encoding', children: [
        { name: 'Sinusoidal position embeddings', desc: 'Adds fixed sine-wave vectors to input embeddings.', page: '08-attention-transformers' },
        { name: 'RoPE (Rotary Position Embedding)', desc: 'Rotates query/key vectors so dot products depend on relative position.', page: '08-attention-transformers' }
      ]},
      { name: 'Pretrained language representations', children: [
        { name: 'BERT', desc: 'Bidirectional Transformer encoder where every token attends to the whole input.', page: '08-attention-transformers' },
        { name: 'GPT', desc: 'Causal Transformer decoder pretrained with next-token prediction.', page: '10-llm-architecture-training' }
      ]},
      { name: 'Efficient attention & serving', children: [
        { name: 'FlashAttention', desc: 'Restructures attention to avoid writing the full matrix to slow memory.', page: '08-attention-transformers' },
        { name: 'KV cache', desc: 'Caches past key/value vectors instead of recomputing them.', page: '08-attention-transformers' },
        { name: 'Grouped-query / multi-query attention', desc: 'Multiple query heads share one key/value set to save memory.', page: '08-attention-transformers' },
        { name: 'Paged attention', desc: 'Manages the KV cache in fixed-size, non-contiguous blocks.', page: '08-attention-transformers' }
      ]},
      { name: 'Subword tokenization', children: [
        { name: 'BPE (Byte-Pair Encoding)', desc: 'Repeatedly merges the most frequent adjacent character pair.', page: '10-llm-architecture-training' }
      ]},
      { name: 'Turning a completer into an assistant', children: [
        { name: 'SFT (Supervised Fine-Tuning)', desc: 'Trains on curated instruction-response pairs with next-token loss.', page: '10-llm-architecture-training' },
        { name: 'RLHF', desc: 'Trains a reward model on human comparisons, then optimizes via PPO.', page: '10-llm-architecture-training' },
        { name: 'DPO (Direct Preference Optimization)', desc: 'Optimizes preference pairs directly, skipping the reward model/RL loop.', page: '10-llm-architecture-training' }
      ]},
      { name: 'Compute-optimal scaling', children: [
        { name: 'Chinchilla', desc: 'Found loss is minimized by scaling parameters and tokens together.', page: '10-llm-architecture-training' },
        { name: 'GPT-3', desc: 'At 175B parameters, performed tasks via few-shot prompting.', page: '10-llm-architecture-training' }
      ]},
      { name: 'Parameter-efficient fine-tuning', children: [
        { name: 'LoRA', desc: 'Freezes base weights, learns a small low-rank update matrix pair.', page: '10-llm-architecture-training' },
        { name: 'QLoRA', desc: 'Combines 4-bit quantization of the frozen base with LoRA on top.', page: '10-llm-architecture-training' }
      ]},
      { name: 'Sparse scaling & compression', children: [
        { name: 'Mixture-of-Experts (MoE)', desc: 'A router selects top-k expert FFNs per token.', page: '10-llm-architecture-training' },
        { name: 'Distillation', desc: 'Trains a smaller student to match a larger teacher.', page: '10-llm-architecture-training' },
        { name: 'Model merging', desc: 'Averages or interpolates weights of multiple fine-tuned variants.', page: '10-llm-architecture-training' }
      ]},
      { name: 'Classical & pre-transformer text representation', children: [
        { name: 'Bag-of-words / TF-IDF', desc: 'Represents a document as word counts weighted by how rare that word is across all documents.', page: '09-nlp-evolution' },
        { name: 'Word2Vec (CBOW / skip-gram)', desc: 'Learns a dense vector per word by predicting its context, or vice versa.', page: '09-nlp-evolution' },
        { name: 'GloVe', desc: 'Learns word vectors by factoring a global word co-occurrence matrix.', page: '09-nlp-evolution' },
        { name: 'ELMo', desc: 'Produces a different embedding per word depending on its sentence context, via a bidirectional LSTM.', page: '09-nlp-evolution' },
        { name: 'T5', desc: 'Casts every NLP task — classification included — as text-to-text generation.', page: '09-nlp-evolution' }
      ]}
    ]
  },
  {
    name: 'Generative & Multimodal', color: 'var(--c-genai)', children: [
      { name: 'Retrieval-augmented generation', children: [
        { name: 'RAG', desc: 'Grounds generation in documents retrieved at inference time.', page: '11-rag-agents-reasoning' },
        { name: 'Dense retrieval (bi-encoder)', desc: 'Embeds query and chunks independently, ranks by cosine similarity.', page: '11-rag-agents-reasoning' },
        { name: 'Sparse retrieval (BM25)', desc: 'Weighted keyword-overlap scoring for exact terms and rare tokens.', page: '11-rag-agents-reasoning' },
        { name: 'Hybrid search', desc: 'Combines dense and sparse scores via reciprocal rank fusion.', page: '11-rag-agents-reasoning' },
        { name: 'Cross-encoder reranker', desc: 'Jointly encodes query and one candidate document to score relevance.', page: '11-rag-agents-reasoning' },
        { name: 'HyDE', desc: 'Embeds an LLM-generated hypothetical answer instead of the raw question.', page: '11-rag-agents-reasoning' },
        { name: 'Graph RAG', desc: 'Retrieves over a knowledge graph for multi-hop question answering.', page: '11-rag-agents-reasoning' }
      ]},
      { name: 'Agentic reasoning loops', children: [
        { name: 'ReAct', desc: 'Interleaves reasoning, a tool-call action, and an observation in a loop.', page: '11-rag-agents-reasoning' },
        { name: 'Tool use / function calling', desc: 'Model emits structured calls the app executes and returns as observation.', page: '11-rag-agents-reasoning' },
        { name: 'Reflection / self-critique', desc: 'Model critiques its own output against evidence before finalizing.', page: '11-rag-agents-reasoning' },
        { name: 'Multi-agent systems', desc: 'Splits a task across specialized agents with different tools/contexts.', page: '11-rag-agents-reasoning' }
      ]},
      { name: 'Image / distribution generation', children: [
        { name: 'VAE', desc: 'Regularizes the latent distribution toward a prior so sampling works.', page: '12-generative-models' },
        { name: 'GAN', desc: 'Trains a generator and discriminator against each other.', page: '12-generative-models' },
        { name: 'DDPM (diffusion)', desc: 'Learns to reverse a fixed noising process, step by step.', page: '12-generative-models' },
        { name: 'Normalizing flows', desc: 'Invertible transformations giving an exact log-likelihood.', page: '12-generative-models' },
        { name: 'Latent diffusion (Stable Diffusion)', desc: 'Runs diffusion inside a compressed VAE latent space.', page: '12-generative-models' },
        { name: 'Diffusion Transformer (DiT)', desc: 'Runs transformer blocks over image patches instead of a U-Net.', page: '12-generative-models' },
        { name: 'ControlNet', desc: 'Trains a parallel branch reading extra conditioning signals.', page: '12-generative-models' },
        { name: 'Classifier-free guidance', desc: 'Extrapolates toward the conditional prediction to sharpen adherence.', page: '12-generative-models' }
      ]},
      { name: 'Automatic speech recognition', children: [
        { name: 'CTC', desc: 'Sums probability over every frame-alignment matching the transcript.', page: '13-speech-audio' },
        { name: 'RNN-T (Transducer)', desc: 'Combines an audio encoder, prediction network, and joint network.', page: '13-speech-audio' },
        { name: 'Conformer', desc: 'Combines convolution for local patterns with self-attention for global context.', page: '13-speech-audio' },
        { name: 'Whisper', desc: 'Encoder-decoder transformer trained on ~680k hours of weakly-labeled audio.', page: '13-speech-audio' },
        { name: 'wav2vec 2.0', desc: 'Masks quantized latent audio, trains via contrastive loss.', page: '13-speech-audio' },
        { name: 'HuBERT', desc: 'Clusters audio features into pseudo-labels, trains masked prediction.', page: '13-speech-audio' }
      ]},
      { name: 'Text-to-speech & vocoding', children: [
        { name: 'Tacotron', desc: 'Autoregressively predicts a mel-spectrogram from text.', page: '13-speech-audio' },
        { name: 'FastSpeech', desc: 'Predicts phoneme durations upfront, generates the spectrogram in parallel.', page: '13-speech-audio' },
        { name: 'VITS', desc: 'Single end-to-end model doing acoustic modeling and vocoding at once.', page: '13-speech-audio' },
        { name: 'WaveNet', desc: 'Generates raw audio autoregressively via dilated causal convolutions.', page: '13-speech-audio' },
        { name: 'HiFi-GAN', desc: 'Generates the whole waveform in one parallel GAN-based pass.', page: '13-speech-audio' }
      ]},
      { name: 'Speaker & audio-event analysis', children: [
        { name: 'Speaker diarization', desc: 'Segments and clusters audio by speaker with no enrollment.', page: '13-speech-audio' },
        { name: 'Speaker identification / verification', desc: 'Embedding-similarity check against an enrolled identity set.', page: '13-speech-audio' },
        { name: 'Voice activity detection (VAD)', desc: 'Frame-by-frame classifier deciding whether audio contains speech.', page: '13-speech-audio' },
        { name: 'Beamforming', desc: 'Uses timing/phase differences across a mic array to boost one direction.', page: '13-speech-audio' }
      ]},
      { name: 'Cross-modal alignment & fusion', children: [
        { name: 'CLIP', desc: 'Trains image and text encoders jointly via contrastive alignment.', page: '14-multimodal-ai' },
        { name: 'Early / late / cross-attention fusion', desc: 'Three points in the pipeline where modalities can be combined.', page: '14-multimodal-ai' },
        { name: 'Encoder + projector + LLM recipe', desc: "Maps a pretrained encoder's features into an LLM's token space.", page: '14-multimodal-ai' },
        { name: 'Native multimodal tokenization', desc: 'Converts every modality into tokens from the start, trained jointly.', page: '14-multimodal-ai' }
      ]}
    ]
  },
  {
    name: 'Decision & Retrieval Systems', color: 'var(--c-rl)', children: [
      { name: 'Value-based control', children: [
        { name: 'Q-learning', desc: 'Learns Q(s,a) values so the best action is argmax_a Q(s,a).', page: '15-reinforcement-learning' },
        { name: 'Deep Q-Network (DQN)', desc: 'Neural network replacing the Q-table, taking raw pixels as input.', page: '15-reinforcement-learning' },
        { name: 'Temporal-difference (TD) learning', desc: 'Bootstraps using immediate reward plus the estimated next-state value.', page: '15-reinforcement-learning' }
      ]},
      { name: 'Policy optimization', children: [
        { name: 'REINFORCE', desc: 'On-policy policy-gradient method using raw return; high variance.', page: '15-reinforcement-learning' },
        { name: 'Proximal Policy Optimization (PPO)', desc: "Clips the new/old policy ratio so updates can't move too far.", page: '15-reinforcement-learning' },
        { name: 'Actor-critic', desc: 'Combines a policy-gradient actor with a learned value-function critic.', page: '15-reinforcement-learning' },
        { name: 'Soft Actor-Critic (SAC)', desc: 'Adds an entropy bonus rewarding the policy for staying exploratory.', page: '15-reinforcement-learning' },
        { name: 'RLHF (reward model + PPO)', desc: 'Applies PPO against a human-preference-trained reward model.', page: '15-reinforcement-learning' }
      ]},
      { name: 'Candidate retrieval & ranking', stub: true, children: [
        { name: 'Two-tower retrieval models', desc: null, page: '16-recommenders-ranking-search' },
        { name: 'Matrix factorization / collaborative filtering', desc: null, page: '16-recommenders-ranking-search' },
        { name: 'Wide & Deep / DeepFM', desc: null, page: '16-recommenders-ranking-search' },
        { name: 'Learning-to-rank (pointwise/pairwise/listwise)', desc: null, page: '16-recommenders-ranking-search' }
      ]},
      { name: 'Time series forecasting', stub: true, children: [
        { name: 'ARIMA / SARIMA', desc: null, page: '17-time-series-forecasting' },
        { name: 'Exponential smoothing', desc: null, page: '17-time-series-forecasting' },
        { name: 'Temporal Fusion Transformer', desc: null, page: '17-time-series-forecasting' },
        { name: 'Foundation models for time series', desc: null, page: '17-time-series-forecasting' }
      ]},
      { name: 'Graph representation learning', stub: true, children: [
        { name: 'Graph convolutional networks (GCN)', desc: null, page: '18-graph-ml' },
        { name: 'GraphSAGE', desc: null, page: '18-graph-ml' },
        { name: 'GAT (graph attention)', desc: null, page: '18-graph-ml' },
        { name: 'Graph transformers', desc: null, page: '18-graph-ml' }
      ]}
    ]
  },
  {
    name: 'Embodied & Frontier', color: 'var(--c-world)', children: [
      { name: 'Low-level robot control', children: [
        { name: 'PID controller', desc: 'Combines proportional, integral, and derivative error terms.', page: '21-robotics-embodied-ai' },
        { name: 'LQR', desc: 'Gives the mathematically optimal linear feedback controller in closed form.', page: '21-robotics-embodied-ai' },
        { name: 'MPC (model predictive control)', desc: 'Plans a short future trajectory each timestep, then replans.', page: '21-robotics-embodied-ai' }
      ]},
      { name: 'Motion planning & state estimation', children: [
        { name: 'Inverse kinematics (IK)', desc: 'Computes joint angles needed to reach a desired end-effector pose.', page: '21-robotics-embodied-ai' },
        { name: 'Trajectory optimization', desc: 'Solves a smooth, collision-free sequence of joint configurations.', page: '21-robotics-embodied-ai' },
        { name: 'Kalman filter', desc: 'Fuses noisy sensor data with a dynamics model into a state estimate.', page: '21-robotics-embodied-ai' },
        { name: 'SLAM', desc: 'Builds/uses a map so a robot can localize itself and navigate.', page: '21-robotics-embodied-ai' }
      ]},
      { name: 'Learning robot policies', children: [
        { name: 'Behavioral cloning', desc: 'Trains a policy via supervised learning on expert observation-action pairs.', page: '21-robotics-embodied-ai' },
        { name: 'DAgger', desc: 'Adds expert corrections on states the current policy actually visits.', page: '21-robotics-embodied-ai' },
        { name: 'Diffusion Policy', desc: 'Denoises a sequence of future robot actions conditioned on observation.', page: '21-robotics-embodied-ai' },
        { name: 'Vision-language-action (VLA) model', desc: 'Fine-tunes a vision-language model to emit robot actions as tokens.', page: '21-robotics-embodied-ai' },
        { name: 'Domain randomization', desc: 'Randomizes simulation parameters so policies transfer to the real world.', page: '21-robotics-embodied-ai' }
      ]},
      { name: 'Learned world simulation for planning', stub: true, children: [
        { name: 'PlaNet / Dreamer', desc: null, page: '22-world-models' },
        { name: 'MuZero-style learned planning', desc: null, page: '22-world-models' },
        { name: 'JEPA / self-supervised predictive representations', desc: null, page: '22-world-models' }
      ]},
      { name: '3D perception for autonomous driving', children: [
        { name: 'PointPillars', desc: 'Converts a raw LiDAR point cloud into vertical pillars a standard 2D CNN can process.', page: '20-3d-spatial-autonomous-driving' },
        { name: 'BEVFormer', desc: 'Fuses multiple camera views into a single bird’s-eye-view grid using spatiotemporal attention.', page: '20-3d-spatial-autonomous-driving' },
        { name: 'TPVFormer (occupancy networks)', desc: 'Predicts whether each cell of a 3D grid around the vehicle is occupied, not just where boxes are.', page: '20-3d-spatial-autonomous-driving' },
        { name: 'ORB-SLAM3', desc: 'Builds a map and localizes a camera within it simultaneously from feature matches across frames.', page: '20-3d-spatial-autonomous-driving' },
        { name: 'MotionNet (trajectory prediction)', desc: 'Predicts other agents’ future positions from a bird’s-eye-view scene representation.', page: '20-3d-spatial-autonomous-driving' }
      ]},
      { name: 'AI for science', stub: true, children: [
        { name: 'Protein language models', desc: null, page: '19-scientific-structured-ai' },
        { name: 'Physics-informed neural networks', desc: null, page: '19-scientific-structured-ai' },
        { name: 'Neural operators', desc: null, page: '19-scientific-structured-ai' }
      ]}
    ]
  },
  {
    name: 'Systems, Safety & Interview', color: 'var(--c-interview)', children: [
      { name: 'Distributed training parallelism', children: [
        { name: 'Data parallelism', desc: 'Replicates the model on every GPU, splits the batch, averages gradients.', page: '23-efficient-ai-systems' },
        { name: 'Tensor parallelism', desc: 'Splits individual weight matrices across devices.', page: '23-efficient-ai-systems' },
        { name: 'Pipeline parallelism', desc: 'Splits layers across devices; activations flow like an assembly line.', page: '23-efficient-ai-systems' },
        { name: 'ZeRO / FSDP', desc: 'Shards parameters, gradients, and optimizer states across devices.', page: '23-efficient-ai-systems' },
        { name: 'Ring all-reduce', desc: "Ring-arranged scatter-reduce then all-gather; traffic stays bounded.", page: '28-gpu-architecture-cuda-distributed' }
      ]},
      { name: 'Inference efficiency', children: [
        { name: 'FlashAttention', desc: 'Computes exact attention via SRAM tiling, avoiding slow memory writes.', page: '23-efficient-ai-systems' },
        { name: 'PagedAttention', desc: 'Divides the KV cache into fixed-size, non-contiguous blocks.', page: '23-efficient-ai-systems' },
        { name: 'Continuous batching', desc: 'Evicts finished requests and admits new ones every generation step.', page: '23-efficient-ai-systems' },
        { name: 'Speculative decoding', desc: 'A small draft model proposes tokens; the large model verifies them.', page: '23-efficient-ai-systems' }
      ]},
      { name: 'Model compression', children: [
        { name: 'Quantization (PTQ / QAT)', desc: 'Reduces numeric precision used to store/compute weights.', page: '23-efficient-ai-systems' },
        { name: 'Distillation', desc: 'Trains a smaller student model to match a larger teacher.', page: '23-efficient-ai-systems' },
        { name: 'Pruning / sparsity', desc: 'Removes weights or structures contributing little to output.', page: '23-efficient-ai-systems' }
      ]},
      { name: 'GPU execution & hardware', children: [
        { name: 'SIMT / warps', desc: 'Thousands of simple cores execute the same instruction on different data.', page: '28-gpu-architecture-cuda-distributed' },
        { name: 'Tensor cores', desc: 'Dedicated hardware performing fused multiply-accumulate on matrix tiles.', page: '28-gpu-architecture-cuda-distributed' },
        { name: 'CUDA / Triton', desc: 'Programming models for writing GPU kernels at thread or tile level.', page: '28-gpu-architecture-cuda-distributed' },
        { name: 'NVLink / InfiniBand', desc: 'High-bandwidth interconnects for GPU-to-GPU and node-to-node traffic.', page: '28-gpu-architecture-cuda-distributed' }
      ]},
      { name: 'MLOps lifecycle', children: [
        { name: 'Feature stores', desc: 'A shared, versioned store of features so training and serving compute them identically.', page: '24-mlops' },
        { name: 'Experiment tracking / model registry', desc: 'Records every training run’s config and metrics, and versions which model is actually deployed.', page: '24-mlops' },
        { name: 'Shadow / canary deployments', desc: 'Routes a small slice of real traffic to a new model before trusting it with all of it.', page: '24-mlops' },
        { name: 'Drift monitoring (PSI)', desc: 'Tracks how far live input or prediction distributions have shifted from training, via the population stability index.', page: '24-mlops' }
      ]},
      { name: 'Evaluation & safety', children: [
        { name: 'LLM-as-judge', desc: 'Uses a strong LLM to score another model’s outputs at a scale human review can’t match.', page: '25-evaluation-reliability-safety' },
        { name: 'Calibration (ECE)', desc: 'Expected Calibration Error measures whether a model’s stated confidence matches its actual accuracy.', page: '25-evaluation-reliability-safety' },
        { name: 'Red teaming / prompt injection defenses', desc: 'Deliberately attacks a model to surface harmful, insecure, or manipulable behavior before real users do.', page: '25-evaluation-reliability-safety' },
        { name: 'Mechanistic interpretability', desc: 'Reverse-engineers what a specific circuit of neurons/attention heads inside a model is actually computing.', page: '25-evaluation-reliability-safety' }
      ]},
      { name: '2026 frontier techniques', children: [
        { name: 'Inference-time compute / verifiers', desc: 'Spends extra compute at answer time sampling and verifying candidates, instead of only scaling pretraining.', page: '26-frontier-2026' },
        { name: 'Tool-use agents (Toolformer-style)', desc: 'A model trained to call external tools mid-generation and use their results.', page: '26-frontier-2026' },
        { name: 'Sparse scaling (Switch Transformers)', desc: 'Routes each token to a subset of expert layers so total parameters can grow without growing compute per token.', page: '26-frontier-2026' },
        { name: 'AI for science (AlphaFold2)', desc: 'Predicts a protein’s 3D structure directly from its amino-acid sequence.', page: '26-frontier-2026' }
      ]}
    ]
  }
];

/* Returns a flat list of sub-problem branches scoped to one page — used for the
   smaller embedded trees on individual topic pages, so they only show the
   techniques that page itself covers rather than the whole site's taxonomy. */
window.KML_TECHTREE_FOR_PAGE = function (pageId) {
  var out = [];
  window.KML_TECHTREE.forEach(function (domain) {
    domain.children.forEach(function (branch) {
      var leaves = (branch.children || []).filter(function (leaf) { return leaf.page === pageId; });
      if (leaves.length) out.push({ name: branch.name, color: domain.color, stub: branch.stub, children: leaves });
    });
  });
  return out;
};
