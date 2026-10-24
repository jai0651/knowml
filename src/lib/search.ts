import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { allPages, groups } from "./manifest";

export interface Hit {
  /** page slug */
  s: string;
  /** page title */
  t: string;
  /** group name */
  g: string;
  /** kind: chapter or section */
  k: "page" | "section";
  /** section heading, when k === "section" */
  h?: string;
  /** anchor id */
  a?: string;
  /** searchable text */
  x: string;
  /** chapter number */
  n: string;
  status: string;
  /** explicit destination, for hits that are not chapters */
  u?: string;
}

const strip = (s: string) =>
  s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[A-Z][A-Za-z]*[\s\S]*?\/>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`>#|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Built at build time and served as a static JSON file. Sections are indexed
 *  separately from chapters so a search for "false sharing" lands on the
 *  section that covers it, not just on the chapter that mentions it. */
export function buildIndex(): Hit[] {
  const dir = path.join(process.cwd(), "content/chapters");
  const out: Hit[] = [];

  for (const p of allPages) {
    const g = groups.find((x) => x.slug === p.groupSlug)!;
    let body = "";
    const file = path.join(dir, `${p.slug}.html`);
    if (fs.existsSync(file)) body = matter(fs.readFileSync(file, "utf8")).content;
    body = body.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<pre[\s\S]*?<\/pre>/g, " ");

    out.push({
      s: p.slug, t: p.title, g: g.name, k: "page", n: p.num,
      status: p.status, ...(p.kind === "lab" && { u: p.href }),
      x: `${p.title} ${p.short} ${p.hook} ${strip(body).slice(0, 400)}`.toLowerCase(),
    });

    if (!body) continue;
    /* Every <h2> and <h3> that carries an id is a landing spot. */
    const re = /<section\s+id="([^"]+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h3>/g;
    const marks = [...body.matchAll(re)];
    marks.forEach((m, i) => {
      const heading = strip((m[2] ?? m[4] ?? "").replace(/<span class="num">[^<]*<\/span>/, ""));
      const anchor = m[1] ?? m[3];
      const from = m.index! + m[0].length;
      const to = i + 1 < marks.length ? marks[i + 1].index! : body.length;
      out.push({
        s: p.slug, t: p.title, g: g.name, k: "section", n: p.num,
        status: p.status, h: heading, a: anchor,
        x: `${heading} ${strip(body.slice(from, to)).slice(0, 700)}`.toLowerCase(),
      });
    });
  }
  return out;
}
