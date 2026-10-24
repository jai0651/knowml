import { groups } from "@/lib/manifest";
import { readDoc } from "@/lib/mdx";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

/* llms.txt: a plain-text map of the site for AI search engines and agents
   (llmstxt.org). One line per page, with what it teaches. */
export function GET() {
  const lines: string[] = [`# ${SITE.name}`, "", `> ${SITE.description}`, ""];
  for (const g of groups) {
    const live = g.pages.filter((p) => p.status === "live" && p.kind === "topic");
    if (!live.length) continue;
    lines.push(`## ${g.name}`, "");
    for (const p of live) {
      const dek = readDoc("chapters", p.slug)?.frontmatter.dek ?? p.hook;
      lines.push(`- [${p.num} ${p.title}](${SITE.url}${p.href}): ${dek}`);
    }
    lines.push("");
  }
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
