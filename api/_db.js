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

// Page ids are lowercase-hyphenated slugs, usually carrying a two-digit index:
// "08-attention-transformers", or "technique-map" for pages outside the
// numbered sequence. This validates by shape rather than against a list of
// known ids, and that is deliberate.
//
// The previous version enumerated every id by hand with a note to keep it in
// sync. It was not kept in sync. Pages 29 through 32 and the technique map were
// never added, so every request for them failed validation with a 400, and
// because the client catches that error and skips the widget rather than
// surfacing it, five pages quietly lost their view and like counters with
// nothing in any log to say so.
//
// The tradeoff is that a well-formed id which is not a real page can still
// create a row. For a view counter that is a much smaller cost than silently
// losing the widget on every page added from here on.
const PAGE_ID_PATTERN = /^(?:\d{2}-)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_ID_MAX_LENGTH = 64;

export function isValidPageId(pageId) {
  return (
    typeof pageId === "string" &&
    pageId.length <= PAGE_ID_MAX_LENGTH &&
    PAGE_ID_PATTERN.test(pageId)
  );
}

export function setCors(res) {
  // Same-origin site; kept permissive-but-simple since there's no cookie/auth to protect.
  res.setHeader("Content-Type", "application/json");
}
