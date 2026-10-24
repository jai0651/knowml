import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = path.join(process.cwd(), "content");

export interface Frontmatter {
  title?: string;
  dek?: string;
  readingTime?: string;
  /** Beginner, Intermediate or Advanced */
  level?: string;
  prereqs?: string;
  versions?: string;
  updated?: string;
  /** Meta description, when it differs from the dek. */
  description?: string;
}

export interface Doc {
  frontmatter: Frontmatter;
  body: string;
}

/** A chapter is an HTML body with front matter, produced from the original
 *  static pages by scripts/convert-chapters.py. Returns null when the manifest
 *  lists a chapter that has no file yet. */
export function readDoc(kind: "chapters" | "labs", slug: string): Doc | null {
  const file = path.join(ROOT, kind, `${slug}.html`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  return { frontmatter: data as Frontmatter, body: content };
}

export interface Outline {
  id: string;
  n: string;
  label: string;
  cmd?: string;
  subs: { id: string; n: string; label: string }[];
}

const plain = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\$([^$]+)\$/g, "$1")
    .trim();

/** The section tree of a chapter, for the rail and the header contents list.
 *  A section is `<section id><h2><span class="num">NN</span>Label</h2>`;
 *  sections without a number (the opening, the technique map) stay out of it,
 *  and each `<h3 id>` inside a numbered section becomes a sub-entry. */
export function outlineOf(body: string): Outline[] {
  const out: Outline[] = [];
  const sections = body.split(/(?=<section\s+id=")/);
  for (const sec of sections) {
    const m = sec.match(/^<section\s+id="([^"]+)"[^>]*>\s*<h2[^>]*>\s*<span class="num">([^<]*)<\/span>([\s\S]*?)<\/h2>/);
    if (!m) continue;
    const n = m[2].trim();
    if (!/^\d+$/.test(n)) continue;
    const entry: Outline = { id: m[1], n, label: plain(m[3]), subs: [] };
    let k = 0;
    for (const h of sec.matchAll(/<h3[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h3>/g)) {
      k += 1;
      /* Some chapters number their own subheads ("1.2 How big is it?"); take
         that number and don't add a second one. */
      const label = plain(h[2]);
      const own = label.match(/^(\d+\.\d+)\s+(.*)$/);
      entry.subs.push({ id: h[1], n: own ? own[1] : `${Number(n)}.${k}`, label: own ? own[2] : label });
    }
    out.push(entry);
  }
  return out;
}
