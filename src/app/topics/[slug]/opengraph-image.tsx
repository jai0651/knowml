import { ogImage, OG_SIZE } from "@/lib/og";
import { pageBySlug, topics } from "@/lib/manifest";
import { readDoc } from "@/lib/mdx";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "KnowML chapter";

export function generateStaticParams() {
  return topics.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = pageBySlug(slug);
  const fm = readDoc("chapters", slug)?.frontmatter;
  return ogImage({ kicker: `${p?.group ?? "Chapter"} · Chapter ${p?.num ?? ""}`, title: p?.title ?? "KnowML", dek: fm?.dek ?? p?.hook });
}
