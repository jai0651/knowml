import Link from "next/link";
import { ArrowRight, BookOpen, FlaskConical, Newspaper } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { groups, topics, labs, livePages, pageBySlug } from "@/lib/manifest";
import { readDoc } from "@/lib/mdx";
import { StartPath } from "@/components/start-path";
import { JsonLd } from "@/components/json-ld";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const TINT: Record<string, string> = {
  machine: "from-machine/15", os: "from-os/15", conc: "from-conc/15", data: "from-data/15",
  dist: "from-dist/15", cloud: "from-cloud/15", ops: "from-ops/15", lab: "from-lab/15",
};
const DOT: Record<string, string> = {
  machine: "bg-machine", os: "bg-os", conc: "bg-conc", data: "bg-data",
  dist: "bg-dist", cloud: "bg-cloud", ops: "bg-ops", cases: "bg-cases", lab: "bg-lab",
};
const TEXT: Record<string, string> = {
  machine: "text-machine", os: "text-os", conc: "text-conc", data: "text-data",
  dist: "text-dist", cloud: "text-cloud", ops: "text-ops", cases: "text-cases", lab: "text-lab",
};

/* A path through the course for someone who doesn't know where to start.
   Five, not forty: a short list gets started, a long one gets bookmarked. */
const START_HERE = [
  { slug: "01-math-foundations", why: "The loop every model runs: predict, score, nudge" },
  { slug: "04-neural-network-fundamentals", why: "How a network learns XOR, one weight at a time" },
  { slug: "07-sequence-modeling-pre-transformer", why: "Why reading word by word loses the subject" },
  { slug: "08-attention-transformers", why: "How \u201cit\u201d finds the word it refers to" },
  { slug: "10-llm-architecture-training", why: "From next-word prediction to an assistant" },
];

const FEATURES = [
  { icon: BookOpen, head: "Taught like a course", body: "One running example per chapter, every term explained before it's used, and a summary at the end." },
  { icon: FlaskConical, head: "Code you can run", body: "Small numpy and PyTorch experiments whose printed numbers are the ones the text quotes." },
  { icon: Newspaper, head: "Built on primary sources", body: "Papers, engineering blogs and measured numbers, dated, with the claims that didn't hold up corrected." },
];

export default function Home() {
  const chapterGroups = groups.filter((g) => g.slug !== "the-labs");
  const path = START_HERE.map((s) => {
    const p = pageBySlug(s.slug)!;
    return { slug: s.slug, href: p.href, title: p.short, why: s.why, time: readDoc("chapters", s.slug)?.frontmatter.readingTime?.replace(/^~/, "") };
  });
  const liveTopics = livePages.filter((p) => p.kind === "topic").length;
  const cases = groups.find((g) => g.slug === "ml-system-design")?.pages ?? [];

  return (
    <>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE.url, description: SITE.description, inLanguage: "en" },
          { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE.url, logo: `${SITE.url}/icons/icon-512.png` },
        ]}
      />
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-5 pb-28 sm:px-8">
        {/* ── hero ─────────────────────────────────────────────────────── */}
        <section className="relative grid gap-12 pb-24 pt-16 sm:pt-24 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
          <div aria-hidden className="hero-glow -top-10 h-[520px]" />
          <div>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-muted shadow-[var(--shadow)]">
              <span className="size-1.5 rounded-full bg-gradient-to-r from-accent to-accent-2" />
              {liveTopics} chapters · {labs.length} labs · free
            </span>
            <h1 className="mb-6 text-[46px] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink sm:text-[68px]">
              Machine learning,{" "}
              <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">explained</span>{" "}
              from the ground up
            </h1>
            <p className="mb-9 max-w-[54ch] text-[18px] leading-relaxed text-muted sm:text-[19.5px]">
              The maths, classical ML, neural networks, transformers and LLMs, and the systems
              that train and serve them, taught step by step for engineers who want to know
              why a model works, not just which library call to make.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/topics/01-math-foundations"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-5 py-3.5 text-[15px] font-semibold text-on-accent shadow-[0_10px_30px_-10px_var(--accent)] transition-opacity hover:opacity-90"
              >
                Start learning
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/sections"
                className="inline-flex items-center gap-2 rounded-xl border border-line-2 bg-surface px-5 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:border-accent"
              >
                Browse all chapters
              </Link>
            </div>
          </div>

          <StartPath items={path} />
        </section>

        {/* ── features ─────────────────────────────────────────────────── */}
        <section className="grid gap-4 pb-20 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, head, body }) => (
            <div key={head} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon className="size-5" />
              </span>
              <div className="mb-1.5 text-[16.5px] font-bold text-ink">{head}</div>
              <p className="text-[14.5px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </section>

        {/* ── the course ───────────────────────────────────────────────── */}
        <section className="pb-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="mb-2 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">The course</h2>
              <p className="max-w-[58ch] text-[16px] leading-relaxed text-muted">
                {topics.length} chapters in {chapterGroups.length} parts, from linear algebra up to
                serving LLMs at scale, plus {labs.length} interactive labs.
              </p>
            </div>
            <Link href="/sections" className="inline-flex items-center gap-1 text-[14.5px] font-semibold text-accent">
              Every chapter <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chapterGroups.map((g) => {
              const live = g.pages.filter((p) => p.status === "live");
              const shown = live.length ? live : g.pages;
              return (
                <Link
                  key={g.slug}
                  href={`/sections#${g.slug}`}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-line bg-surface bg-gradient-to-br to-transparent p-6 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-accent",
                    TINT[g.colour],
                  )}
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className={cn("size-2.5 rounded-full", DOT[g.colour])} />
                    <span className={cn("text-[15.5px] font-bold", TEXT[g.colour])}>{g.name}</span>
                  </div>
                  <div className="mb-4 min-h-[44px] text-[14px] leading-relaxed text-muted">
                    {shown.slice(0, 4).map((p) => p.short).join(" · ")}
                    {shown.length > 4 && " …"}
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="tnum font-semibold text-ink">
                      {live.length}/{g.pages.length} <span className="font-normal text-faint">written</span>
                    </span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                      <span className={cn("block h-full rounded-full", DOT[g.colour])} style={{ width: `${(live.length / g.pages.length) * 100}%` }} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── case studies ─────────────────────────────────────────────── */}
        {cases.length > 0 && (
          <section className="pb-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="mb-2 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">
                  ML system <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">design</span>
                </h2>
                <p className="max-w-[58ch] text-[16px] leading-relaxed text-muted">
                  Real products, designed the way an engineer would: the naive version first, then
                  every place it breaks and what the company did about it.
                </p>
              </div>
              <Link href="/sections#ml-system-design" className="inline-flex items-center gap-1 text-[14.5px] font-semibold text-accent">
                All case studies <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cases.map((p) => (
                <Link key={p.slug} href={p.href} className="group rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-accent">
                  <span className="mb-1 block text-[16px] font-bold leading-snug text-ink">{p.title}</span>
                  <span className="block text-[13.5px] leading-snug text-muted">{p.hook}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── labs ─────────────────────────────────────────────────────── */}
        <section className="pb-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="mb-2 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">The labs</h2>
              <p className="max-w-[58ch] text-[16px] leading-relaxed text-muted">
                Step through backpropagation, attention or sampling one operation at a time, on
                numbers small enough to check by hand.
              </p>
            </div>
            <Link href="/labs" className="inline-flex items-center gap-1 text-[14.5px] font-semibold text-accent">
              All labs <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map((p) => (
              <a key={p.slug} href={p.href} className="group rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-accent">
                <span className="mb-1 block text-[16px] font-bold leading-snug text-ink">{p.title}</span>
                <span className="block text-[13.5px] leading-snug text-muted">{p.hook}</span>
              </a>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line pt-8 text-[13.5px] text-faint">
          <Logo className="size-5" />
          <span className="font-semibold text-muted">KnowML</span>
          <span>· a sibling to</span>
          <a href="https://knowsys.tech" className="font-medium text-muted hover:text-accent">KnowSys</a>
        </footer>
      </main>
    </>
  );
}
