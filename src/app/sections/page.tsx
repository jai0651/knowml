import type { Metadata } from "next";
import { TopNav } from "@/components/top-nav";
import { Sidebar } from "@/components/sidebar";
import { PageCard } from "@/components/page-card";
import { groups, topics, labs } from "@/lib/manifest";
import { cn } from "@/lib/utils";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/sections",
  "Browse every chapter",
  "Every KnowML chapter and lab, grouped by subject: foundations, neural networks, transformers and LLMs, generative models, decision systems, inference and serving, and ML system design.",
);

const DOT: Record<string, string> = {
  machine: "bg-machine", os: "bg-os", conc: "bg-conc", data: "bg-data",
  dist: "bg-dist", cloud: "bg-cloud", ops: "bg-ops", cases: "bg-cases", lab: "bg-lab",
};

export default function SectionsPage() {
  return (
    <>
      <TopNav />
      <div className="mx-auto flex max-w-[1560px] gap-2 px-4 pt-8 sm:px-6">
        <Sidebar />
        <main className="min-w-0 flex-1 pb-24 sm:px-6">
          <h1 className="mb-3 text-[42px] font-extrabold tracking-[-0.035em] text-ink sm:text-[52px]">
            Every <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">chapter</span>
          </h1>
          <p className="mb-14 max-w-2xl text-[16.5px] leading-relaxed text-muted">
            {topics.length} chapters in {groups.length - 1} parts, and {labs.length} labs. Parts build on
            each other from the processor upward, but every chapter says what it assumes,
            so you can start wherever your problem is.
          </p>

          {groups.map((g) => (
            <section key={g.slug} id={g.slug} className="mb-12 scroll-mt-20">
              <div className="mb-4 flex items-center gap-2.5">
                <span className={cn("size-2 rounded-full", DOT[g.colour])} />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {g.name}
                </h2>
                <span className="tnum text-[12px] text-faint">{g.pages.filter((p) => p.status === "live").length}/{g.pages.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.pages.map((p) => (
                  <PageCard key={p.slug} page={p} colour={g.colour} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </>
  );
}
