import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TopNav } from "@/components/top-nav";
import { Sidebar } from "@/components/sidebar";
import { pageMeta } from "@/lib/site";
import { PracticeClient } from "./practice-client";
import "./practice.css";

export const metadata: Metadata = pageMeta(
  "/practice",
  "Where to Practise",
  "Reading will not make you good at machine learning. Where to actually practise: Deep-ML for drills, Kaggle and ML Contests for judgement under a real metric, Karpathy and ARENA for building from scratch.",
);

const body = readFileSync(join(process.cwd(), "content/pages/practice.html"), "utf8");

export default function PracticePage() {
  return (
    <>
      <TopNav />
      <div className="mx-auto flex max-w-[1560px] gap-2 px-4 pt-8 sm:px-6">
        <Sidebar />
        <main className="pg-practice min-w-0 flex-1 pb-24 sm:px-6">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-accent">Practice</div>
          <h1 className="mb-3 text-[34px] font-bold tracking-tight text-ink sm:text-[40px]">Where to Practise</h1>
          <p className="mb-8 max-w-2xl text-[15.5px] leading-relaxed text-muted">
            Reading will not make you good at this. Follow the branch that matches what you are missing.
          </p>
          <div className="pr-body" dangerouslySetInnerHTML={{ __html: body }} />
        </main>
      </div>
      <PracticeClient />
    </>
  );
}
