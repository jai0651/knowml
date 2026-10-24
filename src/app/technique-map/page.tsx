import type { Metadata } from "next";
import { TopNav } from "@/components/top-nav";
import { Sidebar } from "@/components/sidebar";
import { pageMeta } from "@/lib/site";
import { TechmapScripts } from "./techmap-client";
import "./technique-map.css";

export const metadata: Metadata = pageMeta(
  "/technique-map",
  "The Technique Map",
  "Every model, architecture and algorithm on KnowML, organized by the problem it solves, in one expandable tree from PCA to diffusion transformers to ring all-reduce.",
);

export default function TechniqueMapPage() {
  return (
    <>
      <TopNav />
      <div className="mx-auto flex max-w-[1560px] gap-2 px-4 pt-8 sm:px-6">
        <Sidebar />
        <main className="pg-techmap min-w-0 flex-1 pb-24 sm:px-6">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-accent">Reference</div>
          <h1 className="mb-3 text-[34px] font-bold tracking-tight text-ink sm:text-[40px]">The Technique Map</h1>
          <p className="mb-8 max-w-2xl text-[15.5px] leading-relaxed text-muted">
            Every model, architecture and algorithm covered here, organized by the problem it solves
            rather than the chapter it sits in. Expand a domain, then a sub-problem, to see the options.
            Click any technique to jump to its write-up.
          </p>
          <div className="techtree-toolbar">
            <input id="ttFilter" type="text" placeholder={'Filter by technique, e.g. "diffusion" or "attention"…'} autoComplete="off" />
            <button id="ttExpandAll" type="button">Expand all</button>
            <button id="ttCollapseAll" type="button">Collapse all</button>
          </div>
          <div id="ttContainer" />
          <p className="tt-footnote">
            Every branch links to the chapter that covers it. A handful of sections show technique names
            ahead of their full write-up; those are on the way.
          </p>
        </main>
      </div>
      <TechmapScripts />
    </>
  );
}
