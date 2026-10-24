import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TopNav } from "@/components/top-nav";
import { Sidebar } from "@/components/sidebar";
import { pageMeta } from "@/lib/site";
import { RoadmapClient } from "./roadmap-client";
import "./roadmaps.css";

export const metadata: Metadata = pageMeta(
  "/roadmaps",
  "Learning Roadmaps",
  "Four ordered routes through the topic pages: total beginner to training a model, classical ML to reading a transformer paper, understanding LLMs to shipping one, and a dense interview path. Each stage has a checkpoint you can perform, an honest time estimate, and a list of what to skip.",
);

const body = readFileSync(join(process.cwd(), "content/pages/roadmaps.html"), "utf8");

export default function RoadmapsPage() {
  return (
    <>
      <TopNav />
      <div className="mx-auto flex max-w-[1560px] gap-2 px-4 pt-8 sm:px-6">
        <Sidebar />
        <main className="pg-roadmaps min-w-0 flex-1 pb-24 sm:px-6">
          <div className="rm-wrap">
            <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-accent">Guide · 4 routes</div>
            <h1 className="mb-3 text-[34px] font-bold tracking-tight text-ink sm:text-[40px]">Learning Roadmaps</h1>
            <p className="mb-8 max-w-2xl text-[15.5px] leading-relaxed text-muted">
              Thirty-seven numbered pages is a library, not a course. These are four routes through it, in order,
              with a time cost, a checkpoint you have to pass, and a list of what to leave unread.
            </p>
            <div className="rm-body" dangerouslySetInnerHTML={{ __html: body }} />
          </div>
        </main>
      </div>
      <RoadmapClient />
    </>
  );
}
