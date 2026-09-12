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

-- Raw pageview events, the source for the admin dashboard.
--
-- page_counters above only holds all-time totals, which cannot answer "how many
-- people came this week", "which pages are being read" or "where from". This
-- table is one row per view.
--
-- Deliberately not stored: the IP address. `visitor` is a SHA-256 of
-- ip + user-agent + a salt that rotates every day, which is enough to count
-- unique visitors within a day and useless for following anyone across days.
-- `referrer` keeps the host only, never the full URL with its query string.
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  page_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  country TEXT,
  referrer TEXT,
  visitor TEXT
);
CREATE INDEX IF NOT EXISTS idx_page_views_ts ON page_views (ts DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page_ts ON page_views (page_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_ts ON page_views (visitor, ts DESC);
