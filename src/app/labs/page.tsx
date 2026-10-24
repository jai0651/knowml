import type { Metadata } from "next";
import { TopNav } from "@/components/top-nav";
import { Sidebar } from "@/components/sidebar";
import { PageCard } from "@/components/page-card";
import { labs } from "@/lib/manifest";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/labs",
  "The Labs",
  "Interactive labs: step through backpropagation, attention, tokenization, sampling and quantization on examples small enough to check by hand.",
);

export default function LabsPage() {
  return (
    <>
      <TopNav />
      <div className="mx-auto flex max-w-[1560px] gap-2 px-4 pt-8 sm:px-6">
        <Sidebar />
        <main className="min-w-0 flex-1 pb-24 sm:px-6">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-accent">Interactive</div>
          <h1 className="mb-3 text-[34px] font-bold tracking-tight text-ink sm:text-[40px]">
            The Labs
          </h1>
          <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted">
            Step through one mechanism at a time, on an example small enough to check by hand.
            A lab is usually worth more than the chapter it belongs to, which is why there
            are {labs.length} of them.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {labs.map((p) => (
              <PageCard key={p.slug} page={p} colour="lab" />
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
