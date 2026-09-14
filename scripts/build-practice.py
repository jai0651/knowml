#!/usr/bin/env python3
"""Match Deep-ML problems to each topic page and emit content/practice.json.

The catalogue comes from https://api.deep-ml.com/list-problems (1,380 problems,
id + title + category + difficulty). Problem pages live at
https://www.deep-ml.com/problems/<id>, verified: a real id renders
"Deep-ML | <exact title>"; a bogus one renders "Something went wrong".

Matching is on title keywords rather than category, because the categories are
far too coarse to be useful — 301 problems are tagged "Deep Learning". Each
rule is (must-match-any, category-hint) and results are ranked easy-first so a
page opens with something approachable.
"""
import json, re, collections, pathlib

RULES = {
 "01-math-foundations":            (r"\b(dot product|matrix|vector|eigen|determinant|transpose|covariance|norm|gradient descent|bayes|entropy|probability|variance|softmax|jacobian|hessian|svd|orthogonal|projection|linear system)\b", None),
 "02-classical-ml":                (r"\b(linear regression|logistic regression|decision tree|random forest|gradient boost|svm|support vector|k-?nearest|naive bayes|adaboost|ridge|lasso|elastic net|cross.?validation|r-?squared|confusion matrix|precision|recall|f1|roc|auc)\b", None),
 "03-unsupervised-self-supervised":(r"\b(k-?means|clustering|pca|principal component|dbscan|hierarchical|autoencoder|contrastive|t-?sne|umap|gaussian mixture|silhouette|anomaly)\b", None),
 "04-neural-network-fundamentals": (r"\b(relu|sigmoid|tanh|activation|backprop|neuron|perceptron|dense layer|batch norm|layer norm|dropout|weight init|xavier|he init|mlp|feed.?forward|chain rule|vanishing)\b", None),
 "05-cnn-vision-foundations":      (r"\b(convolution|conv2d|pooling|max pool|kernel|stride|padding|image|resnet|residual block|feature map|edge detect)\b", None),
 "06-modern-vision-foundation-models": (r"\b(vision transformer|vit|clip|patch embed|image encoder|segmentation|detection|iou|bounding box|nms)\b", None),
 "07-sequence-modeling-pre-transformer": (r"\b(rnn|lstm|gru|recurrent|sequence|hidden state|teacher forcing|beam search|seq2seq)\b", None),
 "08-attention-transformers":      (r"\b(attention|self.?attention|multi.?head|positional encoding|transformer|query|key.{0,6}value|scaled dot|causal mask|rope|kv cache)\b", None),
 "09-nlp-evolution":               (r"\b(tokeniz|bpe|word2vec|embedding|tf-?idf|bag of words|n-?gram|bert|cosine similarity|stemming|lemmat|vocabulary|perplexity)\b", None),
 "10-llm-architecture-training":   (r"\b(language model|llm|gpt|next token|cross.?entropy loss|label smooth|scaling law|rlhf|dpo|sampling|temperature|top.?k|top.?p|nucleus)\b", None),
 "11-rag-agents-reasoning":        (r"\b(retrieval|rag|vector (search|database)|similarity search|bm25|rerank|chunk|nearest neighbou?r search|faiss|cosine)\b", None),
 "12-generative-models":           (r"\b(gan|vae|diffusion|denois|variational|generator|discriminator|noise schedule|ddpm|reparameter|sampling from)\b", None),
 "13-speech-audio":                (r"\b(audio|speech|spectrogram|mel.?(spectrogram|scale|filter)|mfcc|ctc loss|waveform|asr|phoneme)\b", None),
 "14-multimodal-ai":               (r"\b(multimodal|cross.?attention|image.?text|clip|fusion|contrastive loss)\b", None),
 "15-reinforcement-learning":      (r"\b(q-?learning|reward|policy|bellman|markov decision|mdp|value iteration|actor.?critic|ppo|epsilon.?greedy|bandit|discount|advantage|temporal difference|sarsa|monte carlo)\b", "Reinforcement Learning"),
 "16-recommenders-ranking-search": (r"\b(recommend|collaborative filtering|matrix factoriz|learning to rank|ndcg|\bmrr\b|hit rate|implicit feedback|two.?tower|\bbpr\b|reciprocal rank)\b", None),
 "17-time-series-forecasting":     (r"\b(time series|forecast|arima|seasonal|moving average|autocorrelat|lag|stationar|exponential smoothing|trend)\b", None),
 "18-graph-ml":                    (r"\b(graph|adjacency|node embed|gnn|message passing|pagerank|laplacian|degree matrix|edge list|bfs|dfs)\b", None),
 "19-scientific-structured-ai":    (r"\b(differential equation|physics.?informed|\bpde\b|equivarian|molecul|protein|\bmd simulation\b)\b", None),
 "20-3d-spatial-autonomous-driving":(r"\b(3d|point cloud|lidar|camera|homograph|rotation matrix|quaternion|transform matrix|depth|stereo|slam)\b", None),
 "21-robotics-embodied-ai":        (r"\b(robot|kinematic|trajectory|control|pid|inverse kinematic|manipulat)\b", None),
 "22-world-models":                (r"\b(world model|latent dynamic|dreamer|model.?based|rollout|imagination|state transition)\b", None),
 "23-efficient-ai-systems":        (r"\b(quantiz|prun(e|ing)|sparsit|distill|flash attention|int8|int4|mixed precision|memory (fragmentation|footprint|bandwidth)|throughput|kernel fusion|flops|mfu|paged attention)\b", None),
 "24-mlops":                       (r"\b(pipeline|drift|monitor|deploy|feature store|a/?b test|batch inference|serialization|versioning)\b", "MLOps"),
 "25-evaluation-reliability-safety":(r"\b(calibrat|brier|expected calibration|bootstrap|confidence interval|significance|p-?value|fairness|bias metric|hallucinat)\b", None),
 "26-frontier-2026":               (r"\b(chain.?of.?thought|mixture of experts|\bmoe\b|expert rout|speculative decod|test.?time (compute|scaling)|self.?consistency)\b", None),
 "27-interview-mastery":           (r"\b(implement|from scratch|numpy)\b", "Algorithms"),
 "28-gpu-architecture-cuda-distributed": (r"\b(cuda|kernel|gpu|thread|warp|shared memory|tile|all.?reduce|parallel|triton|coalesc)\b", None),
 "29-finetuning-llms":             (r"\b(lora|qlora|fine.?tun|peft|low.?rank adapt|prefix tun|lora adapter|instruction (tun|complexity|dataset))\b", None),
 "30-running-models-locally":      (r"\b(quantiz|int4|int8|gguf|memory footprint|vram|kv cache)\b", None),
 "31-llm-inference-serving":       (r"\b(inference|batching|kv cache|throughput|latency|serving|decode|prefill|speculative)\b", "Inference"),
 "32-preference-optimization":     (r"\b(rlhf|dpo|preference|reward model|ppo|kl diverg|bradley.?terry|grpo)\b", None),
 "33-model-atlas-language":        (r"\b(perplexity|benchmark|tokeniz|embedding|language model)\b", None),
 "34-model-atlas-speech-audio":    (r"\b(speech|audio|word error rate|spectrogram|mel.?spectrogram)\b", None),
 "35-model-atlas-vision-generative":(r"\b(image|vision|fid|generat|diffusion)\b", None),
 "36-millennium-prize-problems":   (r"\b(np-?(hard|complete)|travelling salesman|satisfiability|prime factor|navier|riemann)\b", None),
 "38-llm-inference-at-scale":      (r"\b(kv cache|paged attention|continuous batch|speculative decod|prefill|decode|quantiz|fp8|int8|throughput|goodput|latency|serving|batching|expert rout|moe)\b", "Inference"),
 "39-realtime-voice-ai":           (r"\b(streaming|latency|audio|speech|buffer|chunk|real.?time|jitter|voice)\b", None),
 "40-diffusion-video-inference":   (r"\b(diffusion|denois|ddim|sampler|timestep|guidance|cache|distill|latent|video|frame)\b", None),
 "37-ai-in-industry":              (r"\b(forecast|fraud|recommend|anomaly|churn|credit|medical|financial)\b", "Financial Engineering"),
}

# Titles that match a page's keywords but are about something else. Keyword
# matching gets you most of the way and then needs a human to veto the rest.
EXCLUDE = {
 "18-graph-ml": ["Detect a Cycle in a Linked List", "Distributed Mode/Median"],
 "23-efficient-ai-systems": ["Decision Tree Pruning"],
 "27-interview-mastery": ["Reduced Row Echelon"],
}

RANK = {"easy": 0, "medium": 1, "hard": 2}
MAX_PER_PAGE = 6

def main():
    cat = json.load(open(".scratch/deepml.json"))["problems"]
    out = {}
    for page, (pattern, cat_hint) in RULES.items():
        rx = re.compile(pattern, re.I)
        hits = []
        for p in cat:
            score = 0
            if rx.search(p["title"]): score += 2
            if cat_hint and p["category"] == cat_hint: score += 1
            if score: hits.append((score, RANK.get(p["difficulty"], 1), p))
        # strongest match first, then easiest, then a stable id order
        hits.sort(key=lambda h: (-h[0], h[1], int(h[2]["id"])))
        # keep a difficulty spread rather than six easy ones
        picked, seen_diff = [], collections.Counter()
        banned = EXCLUDE.get(page, [])
        for _, _, p in hits:
            if any(b.lower() in p["title"].lower() for b in banned): continue
            d = p["difficulty"]
            if seen_diff[d] >= 3: continue
            picked.append({"id": p["id"], "title": p["title"],
                           "difficulty": d, "category": p["category"]})
            seen_diff[d] += 1
            if len(picked) >= MAX_PER_PAGE: break
        out[page] = picked
    dropped = sorted(k for k, v in out.items() if len(v) < 3)
    out = {k: v for k, v in out.items() if len(v) >= 3}
    pathlib.Path("content/practice.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"{len(out)} pages mapped, {sum(len(v) for v in out.values())} problem links")
    if dropped:
        print(f"  {len(dropped)} pages left without a practice block (fewer than 3 real matches):")
        for d in dropped: print("     ", d)

if __name__ == "__main__":
    main()
