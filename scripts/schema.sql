-- Per-page view/like counters
CREATE TABLE IF NOT EXISTS page_counters (
  page_id TEXT PRIMARY KEY,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0
);

-- Per-page discussion comments
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  page_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  anchor_text TEXT,
  anchor_occurrence INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_page_id ON comments (page_id, created_at DESC);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS anchor_text TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS anchor_occurrence INT;
