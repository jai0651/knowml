import { neon } from "@neondatabase/serverless";

let _sql = null;

export function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Recognized page ids — kept in sync with assets/js/search-data.js's page list.
// Validating against this prevents arbitrary strings from creating junk rows.
export const KNOWN_PAGE_IDS = new Set([
  "00-map-timeline",
  "01-math-foundations",
  "02-classical-ml",
  "03-unsupervised-self-supervised",
  "04-neural-network-fundamentals",
  "05-cnn-vision-foundations",
  "06-modern-vision-foundation-models",
  "07-sequence-modeling-pre-transformer",
  "08-attention-transformers",
  "09-nlp-evolution",
  "10-llm-architecture-training",
  "11-rag-agents-reasoning",
  "12-generative-models",
  "13-speech-audio",
  "14-multimodal-ai",
  "15-reinforcement-learning",
  "16-recommenders-ranking-search",
  "17-time-series-forecasting",
  "18-graph-ml",
  "19-scientific-structured-ai",
  "20-3d-spatial-autonomous-driving",
  "21-robotics-embodied-ai",
  "22-world-models",
  "23-efficient-ai-systems",
  "24-mlops",
  "25-evaluation-reliability-safety",
  "26-frontier-2026",
  "27-interview-mastery",
  "28-gpu-architecture-cuda-distributed",
]);

export function isValidPageId(pageId) {
  return typeof pageId === "string" && KNOWN_PAGE_IDS.has(pageId);
}

export function setCors(res) {
  // Same-origin site; kept permissive-but-simple since there's no cookie/auth to protect.
  res.setHeader("Content-Type", "application/json");
}
