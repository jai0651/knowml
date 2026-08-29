/* Regression test for text anchoring (assets/js/anchor.js).

   The bug this exists to catch: highlights and comment pins were anchored by
   searching one text node at a time and painted with Range.surroundContents().
   Both fail the moment a selection crosses an inline element, and they fail
   *silently* — the highlight was written to localStorage and simply never drawn,
   with no error anywhere. Nearly every paragraph here carries a <strong>, so
   most real selections were affected and nobody could tell why.

   Run it:
     npm i -D puppeteer-core          # once
     node scripts/test-highlighting.mjs

   It serves the repo on a scratch port and drives a real Chrome.
*/
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8917;
const PAGE = `http://127.0.0.1:${PORT}/topics/08-attention-transformers.html`;
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let puppeteer;
try {
  puppeteer = createRequire(import.meta.url)('puppeteer-core');
} catch {
  console.error('puppeteer-core is not installed. Run: npm i -D puppeteer-core');
  process.exit(2);
}

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);
await new Promise(r => setTimeout(r, 1200));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox'], defaultViewport: { width: 1300, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message.slice(0, 120)));

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
};

await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForFunction(() => !!document.querySelector('.note-editor'), { timeout: 8000 });

/* Build a selection with the Range API, fire the mouseup the toolbar listens
   for, then click a colour. Returns what actually got painted and stored. */
async function highlight(pickFnSource) {
  return page.evaluate(src => {
    const content = document.getElementById('content');
    const range = new Function('content', 'return (' + src + ')(content)')(content);
    if (!range) return { skip: true };
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const crosses = range.startContainer !== range.endContainer;
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window }));
    const tb = document.getElementById('selectToolbar');
    if (getComputedStyle(tb).display === 'none') return { crosses, shown: false };
    tb.querySelector('[data-color="green"]').dispatchEvent(new MouseEvent('click', { bubbles: true, view: window }));
    return {
      crosses, shown: true,
      marks: content.querySelectorAll('mark.hl').length,
      stored: (JSON.parse(localStorage.getItem('np-notes::' + location.pathname) || '{}').highlights || []).length,
    };
  }, pickFnSource.toString());
}

async function reset() {
  await page.evaluate(() => localStorage.removeItem('np-notes::' + location.pathname));
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !!document.querySelector('.note-editor'), { timeout: 8000 });
}

const acrossStrong = c => {
  const s = [...c.querySelectorAll('p strong')].find(
    x => x.previousSibling?.nodeType === 3 && x.nextSibling?.nodeType === 3);
  if (!s) return null;
  const r = document.createRange();
  r.setStart(s.previousSibling, Math.max(0, s.previousSibling.nodeValue.length - 12));
  r.setEnd(s.nextSibling, Math.min(12, s.nextSibling.nodeValue.length));
  return r;
};

console.log('anchoring across inline markup');
await reset();
let r = await highlight(acrossStrong);
check('selection through a <strong> paints', !r.skip && r.crosses && r.marks > 1 && r.stored === 1,
  `crosses=${r.crosses} marks=${r.marks} stored=${r.stored}`);

await reset();
r = await highlight(c => {
  const ps = [...c.querySelectorAll('p')].filter(x => x.textContent.trim().length > 60);
  if (ps.length < 2) return null;
  const r2 = document.createRange();
  r2.setStart(ps[0].firstChild, 0);
  const last = [...ps[1].childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim());
  r2.setEnd(last, Math.min(20, last.nodeValue.length));
  return r2;
});
check('selection spanning two paragraphs paints', !r.skip && r.marks > 1 && r.stored === 1,
  `marks=${r.marks}`);

await reset();
r = await highlight(c => {
  const k = c.querySelector('p .katex');
  if (!k) return null;
  const par = k.closest('p');
  const first = [...par.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim());
  const last = [...par.childNodes].reverse().find(n => n.nodeType === 3 && n.nodeValue.trim());
  if (!first || !last || first === last) return null;
  const r2 = document.createRange();
  r2.setStart(first, 0); r2.setEnd(last, Math.min(15, last.nodeValue.length));
  return r2;
});
check('selection spanning inline math paints', r.skip || (r.marks > 1 && r.stored === 1),
  r.skip ? 'no inline math on page' : `marks=${r.marks}`);

console.log('persistence and removal');
await reset();
const made = await highlight(acrossStrong);
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => !!document.querySelector('.note-editor'), { timeout: 8000 });
const after = await page.evaluate(() => document.querySelectorAll('#content mark.hl').length);
check('multi-piece highlight survives reload', after === made.marks, `${made.marks} -> ${after}`);

const removed = await page.evaluate(() => {
  const m = document.querySelector('#content mark.hl');
  getSelection().removeAllRanges();
  m.dispatchEvent(new MouseEvent('click', { bubbles: true, view: window }));
  document.querySelector('#selectToolbar [data-remove]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true, view: window }));
  return {
    marks: document.querySelectorAll('#content mark.hl').length,
    stored: (JSON.parse(localStorage.getItem('np-notes::' + location.pathname) || '{}').highlights || []).length,
  };
});
check('removing unwraps every piece', removed.marks === 0 && removed.stored === 0,
  `marks=${removed.marks} stored=${removed.stored}`);

console.log('back-compatibility');
await page.evaluate(() => {
  const t = document.querySelector('#content p').textContent.trim().slice(0, 30);
  localStorage.setItem('np-notes::' + location.pathname, JSON.stringify({
    freeNotes: '', highlights: [{ id: 'legacy1', text: t, color: 'pink', occurrence: 0, note: '', createdAt: 1 }],
  }));
});
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => !!document.querySelector('.note-editor'), { timeout: 8000 });
const legacy = await page.evaluate(() => document.querySelectorAll('#content mark.hl-pink').length);
check('pre-offset highlights still resolve', legacy > 0, `marks=${legacy}`);

const pin = await page.evaluate(() => {
  const c = document.getElementById('content');
  const s = [...c.querySelectorAll('p strong')].find(
    x => x.previousSibling?.nodeType === 3 && x.nextSibling?.nodeType === 3);
  const phrase = s.previousSibling.nodeValue.slice(-14) + s.textContent + s.nextSibling.nodeValue.slice(0, 14);
  const mark = window.KMLAnchor.wrapOccurrence(c, phrase, 0, () => {
    const m = document.createElement('mark'); m.className = 'cm-anchor'; return m;
  });
  const all = [...c.querySelectorAll('mark.cm-anchor')];
  return { painted: all.length, returnedLast: !!mark && mark === all[all.length - 1] };
});
check('comment anchors span inline markup', pin.painted > 1 && pin.returnedLast,
  `painted=${pin.painted} returnedLast=${pin.returnedLast}`);

check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
stop();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
