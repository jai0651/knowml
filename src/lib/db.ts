import { neon } from "@neondatabase/serverless";

/** Namespace prefix for page ids in the shared `page_counters` table.
 *  KnowML's rows predate namespacing and use plain ids ("08-attention-transformers"),
 *  so this site uses "" and existing counts carry over. KnowSys's deployment
 *  sets this to "ks:". Applies to page_counters only; page_views and comments
 *  store the plain id, as the old api/ did. */
export const NS = "";

export const hasDb = () => Boolean(process.env.DATABASE_URL);

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// Page ids are lowercase-hyphenated slugs, usually carrying a two-digit index:
// "08-attention-transformers", or "technique-map" for pages outside the
// numbered sequence. Validated by shape rather than against a list of known
// ids, deliberately: a hand-kept list went stale and silently disabled the
// widgets on five pages. A well-formed id that is not a real page can still
// create a row, which is a much smaller cost for a view counter.
const PAGE_ID_PATTERN = /^(?:\d{2}-)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_ID_MAX_LENGTH = 64;

export function isValidPageId(pageId: unknown): pageId is string {
  return (
    typeof pageId === "string" &&
    pageId.length <= PAGE_ID_MAX_LENGTH &&
    PAGE_ID_PATTERN.test(pageId)
  );
}
