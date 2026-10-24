import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { Sidebar } from "@/components/sidebar";
import { SpineRail } from "@/components/spine-rail";
import { MobileToc } from "@/components/mobile-toc";
import { ChapterHeader } from "@/components/chapter-header";
import { SectionHeading } from "@/components/section";
import { StubNote } from "@/components/content";
import { renderChapterHtml } from "@/lib/chapter-html";
import "katex/dist/katex.min.css";
import { readDoc, outlineOf } from "@/lib/mdx";
import { topics, pageBySlug, neighbours, colourOf } from "@/lib/manifest";
import { shapeOf } from "@/lib/spine";
import { Notes } from "@/components/notes/notes";
import { JsonLd } from "@/components/json-ld";
import { SITE } from "@/lib/site";
import { ReadingProgress } from "@/components/reading-progress";
import { ChapterEnhance } from "@/components/chapter-enhance";

export function generateStaticParams() {
  return topics.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = pageBySlug(slug);
  if (!page) return {};
  const fm = readDoc("chapters", slug)?.frontmatter;
  const description = fm?.description ?? fm?.dek ?? page.hook;
  return {
    title: page.title,
    description,
    keywords: [page.title, page.short, page.group, "machine learning", "tutorial"],
    alternates: { canonical: page.href },
    openGraph: { type: "article", title: page.title, description, url: page.href, section: page.group, modifiedTime: fm?.updated },
    twitter: { card: "summary_large_image", title: page.title, description },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pageBySlug(slug);
  if (!page || page.kind !== "topic") notFound();

  const doc = readDoc("chapters", slug);
  const html = doc ? await renderChapterHtml(doc.body) : "";

  /* A written chapter drives the rail from its own headings; a stub falls back
     to the generic skeleton, which is also exactly what it renders. */
  const shape = shapeOf(page.archetype);
  const parsed = doc ? outlineOf(doc.body) : [];
  /* Every numbered section goes in the rail, in page order. The archetype
     spine used to split them into two lists; the new chapter format is
     organised by topic, so there's one list. */
  const railSpine = parsed.length ? parsed : shape.spine.map((s) => ({ ...s, n: "", subs: [] }));
  const railTail = parsed.length ? [] : shape.tail.map((s) => ({ ...s, n: "", subs: [] }));
  const minutes = parseInt(doc?.frontmatter.readingTime?.replace(/\D/g, "") ?? "", 10) || undefined;
  const allSections = [...shape.spine, ...shape.tail];
  const { prev, next } = neighbours(slug);
  const colour = colourOf(page);

  const ld = doc
    ? [
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: page.title,
          description: doc.frontmatter.dek ?? page.hook,
          url: `${SITE.url}${page.href}`,
          image: `${SITE.url}${page.href}/opengraph-image`,
          dateModified: doc.frontmatter.updated,
          articleSection: page.group,
          proficiencyLevel: doc.frontmatter.level,
          timeRequired: doc.frontmatter.readingTime ? `PT${parseInt(doc.frontmatter.readingTime.replace(/\D/g, ""), 10) || 20}M` : undefined,
          isAccessibleForFree: true,
          inLanguage: "en",
          author: { "@type": "Organization", name: SITE.name, url: SITE.url },
          publisher: { "@type": "Organization", name: SITE.name, url: SITE.url, logo: { "@type": "ImageObject", url: `${SITE.url}/icons/icon-512.png` } },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url },
            { "@type": "ListItem", position: 2, name: page.group, item: `${SITE.url}/sections#${page.groupSlug}` },
            { "@type": "ListItem", position: 3, name: page.title, item: `${SITE.url}${page.href}` },
          ],
        },
      ]
    : null;

  return (
    <>
      {ld && <JsonLd data={ld} />}
      <TopNav />
      {doc && <ReadingProgress />}
      <div className="mx-auto flex max-w-[1480px] gap-10 px-5 sm:px-6">
        <Sidebar currentSlug={slug} />

        <main className="min-w-0 flex-1 pb-28 pt-9">
          <div className="mx-auto max-w-[740px]">
            <ChapterHeader page={page} colour={colour} fm={doc?.frontmatter} outline={parsed} />

            <article className="prose kml" id="chapter-body">
              {doc ? (
                <div dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                allSections.map((s, i) => (
                  <section key={s.id} id={s.id} className="scroll-mt-28">
                    <SectionHeading n={String(i + 1).padStart(2, "0")} cmd={s.cmd}>
                      {s.label}
                    </SectionHeading>
                    <StubNote>{s.what}</StubNote>
                  </section>
                ))
              )}
            </article>

            <nav className="mt-20 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
              {prev ? (
                <Link href={prev.href} className="group rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)] transition hover:border-accent">
                  <div className="mb-1 flex items-center gap-1.5 text-[12.5px] text-faint">
                    <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" /> Previous · {prev.num}
                  </div>
                  <div className="text-[16.5px] font-bold leading-snug text-ink">{prev.title}</div>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={next.href}
                  className="group rounded-xl border border-line bg-surface p-4 text-right shadow-[var(--shadow)] transition hover:border-accent sm:col-start-2"
                >
                  <div className="mb-1 flex items-center justify-end gap-1.5 text-[12.5px] text-faint">
                    Next · {next.num} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="text-[16.5px] font-bold leading-snug text-ink">{next.title}</div>
                </Link>
              )}
            </nav>
          </div>
        </main>

        <SpineRail spine={railSpine} tail={railTail} minutes={minutes} />
      </div>

      {railSpine.length > 0 && <MobileToc items={railSpine} />}
      <Notes title={page.title} />
      {doc && <ChapterEnhance />}
    </>
  );
}
