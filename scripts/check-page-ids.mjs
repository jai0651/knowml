/* Every page's data-page-id must pass the API's validator.

   This exists because of a silent failure. api/_db.js used to validate page ids
   against a hand-maintained allowlist with a comment asking that it be kept in
   sync. It was not. Pages 29 through 32 were added without being added to the
   list, so /api/counters returned 400 for them, and because community.js skips
   the widget on any error rather than surfacing it, those pages quietly lost
   their view and like counters. Nothing failed loudly, nothing appeared in a
   log, and the only symptom was a widget that was not there.

   Validation is now by shape rather than by list, so new pages work
   automatically. This check guards the other direction: that no page id drifts
   into a format the validator rejects.

     node scripts/check-page-ids.mjs
*/
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidPageId } from '../api/_db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  ...readdirSync(path.join(ROOT, 'topics'))
    .filter(f => f.endsWith('.html'))
    .map(f => path.join('topics', f)),
  'index.html',
  'review.html',
];

let failures = 0;
const seen = new Map();

for (const rel of files) {
  let html;
  try {
    html = readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    continue;
  }
  const m = html.match(/<body[^>]*\bdata-page-id="([^"]*)"/);
  if (!m) continue;
  // Only pages carrying a .topic-header call the counters API — that is exactly
  // the condition isTopicPage() uses in community.js. The homepage, the review
  // page and the technique map have page ids but never hit the endpoint, so
  // their ids are not required to satisfy the API's format.
  if (!/class="topic-header"/.test(html)) continue;
  const id = m[1];
  if (!isValidPageId(id)) {
    console.log(`  FAIL ${rel} — data-page-id "${id}" is rejected by isValidPageId`);
    failures++;
  }
  if (seen.has(id)) {
    console.log(`  FAIL ${rel} — data-page-id "${id}" already used by ${seen.get(id)}`);
    failures++;
  }
  seen.set(id, rel);
}

console.log(`${seen.size} page ids checked, ${failures} problem${failures === 1 ? '' : 's'}`);
process.exit(failures ? 1 : 0);
