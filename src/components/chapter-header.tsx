import type { Page } from "@/lib/manifest";
import type { Frontmatter, Outline } from "@/lib/mdx";
import Link from "next/link";
import { PageStats } from "./page-stats";
import { ChapterActions } from "./chapter-actions";
import { BrandLogo, hasBrandLogo } from "./brand-logo";

/* The chapter's front page: where it sits, what it's called, why you'd read
   it, what it costs you in time, and what's in it. The last word or two of
   the title carries the accent gradient. */
export function ChapterHeader({
  page, fm, outline,
}: {
  page: Page;
  colour: string;
  fm?: Frontmatter;
  outline?: Outline[];
}) {
  const words = page.title.split(" ");
  const cut = words.length > 3 ? words.length - 2 : Math.max(words.length - 1, 1);
  const head = words.slice(0, cut).join(" ");
  const tail = words.slice(cut).join(" ");
  const pills = [
    fm?.readingTime && `⏱ ${fm.readingTime.replace(/^~/, "")} read`,
    fm?.level && `◆ ${fm.level}`,
    fm?.prereqs && `Assumes: ${fm.prereqs}`,
  ].filter(Boolean) as string[];
  const sections = (outline ?? []).filter((o) => o.n);

  return (
    <header className="relative mb-10 border-b border-line pb-10 pt-2">
      <div aria-hidden className="hero-glow -top-16 h-[380px]" />
      <div className="mb-5 flex flex-wrap items-center gap-2.5 text-[13px]">
        <Link
          href={`/sections#${page.groupSlug}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent"
        >
          <span className="size-1.5 rounded-full bg-accent" />
          {page.group}
        </Link>
        <span className="tnum text-faint">Chapter {page.num}</span>
        {page.status !== "live" && <span className="text-faint">· not written yet</span>}
        <span className="flex-1" />
        <PageStats pageId={page.slug} />
      </div>

      {hasBrandLogo(page.slug) && <BrandLogo slug={page.slug} size={60} className="mb-5 shadow-[var(--shadow)]" />}

      <h1 className="mb-4 text-[38px] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink sm:text-[52px]">
        {head}{" "}
        <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">{tail}</span>
      </h1>

      <p className="mb-6 max-w-[62ch] text-[18px] leading-relaxed text-muted sm:text-[19px]">{fm?.dek ?? page.hook}</p>

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-muted">{p}</span>
          ))}
        </div>
      )}

      {fm && <ChapterActions slug={page.slug} firstId={sections[0]?.id} />}

      {sections.length > 0 && (
        <nav className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <div className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-[0.07em] text-faint">In this chapter</div>
          <ol className="grid gap-x-8 gap-y-1 text-[15px] sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2.5 py-0.5 text-muted transition-colors hover:text-accent">
                  <span className="tnum w-5 shrink-0 font-mono text-[13px] text-faint">{s.n.replace(/^0/, "")}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </header>
  );
}
