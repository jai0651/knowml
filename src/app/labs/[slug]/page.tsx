import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";
import { TopNav } from "@/components/top-nav";
import { pageMeta } from "@/lib/site";
import { LABS } from "./lab-content";
import { LabRunner } from "./lab-runner";
import "./lab.css";

const SLUGS = ["attention-lab", "backprop-lab", "tokenizer-lab", "sampling-lab", "quantization-lab"];

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lab = LABS[slug];
  if (!lab) return {};
  return pageMeta(`/labs/${slug}`, lab.title, lab.description);
}

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = LABS[slug];
  if (!lab) notFound();

  return (
    <>
      <TopNav />
      <div className="pg-lab mx-auto max-w-[1320px] px-4 pb-24 pt-8 sm:px-6">
        <nav className="lab-crumbs">
          <Link href="/labs">Labs</Link> / {lab.title}
        </nav>
        <div className="lab-eyebrow">Interactive</div>
        <h1 className="lab-h1">{lab.title}</h1>
        <p className="lab-dek">{lab.dek}</p>
        <p className="lab-prereq">{lab.prereq}</p>

        <details className="lab-howto" open>
          <summary>
            How to use this page <span className="lab-howto-chev">▾</span>
          </summary>
          <div dangerouslySetInnerHTML={{ __html: lab.howto }} />
        </details>

        <div className="lab-shell" id="labShell">
          <div className="lab-tabs" id="labTabs" />
          <div className="lab-dimstrip" id="labDimStrip" />
          <div className="lab-panelbox">
            <div className="lab-toolbar">
              <div className="lab-dots" id="labDots" />
              <span className="lab-stepcount" id="labEyebrow" />
              <div className="lab-toolbar-nav">
                <button className="lab-navbtn" id="labPrev">← Prev</button>
                <button className="lab-navbtn lab-navbtn--primary" id="labNext">Next →</button>
              </div>
            </div>
            <div className="lab-stepintro">
              <h2 id="labTitle" />
              <div className="lab-formula" id="labFormula" />
              <p className="lab-stepnote" id="labNote" />
            </div>
            <div className="lab-stage" id="labStage" />
            <details className="lab-ledger" id="labLedger" />
          </div>
        </div>

        <section className="lab-section">
          <h2>What this page simplifies, on purpose</h2>
          <ul dangerouslySetInnerHTML={{ __html: lab.simplifies }} />
        </section>

        <section className="lab-section">
          <h2>Related pages</h2>
          <div className="lab-related">
            {lab.related.map((r) => (
              <Link key={r.href} href={r.href} className="lab-rcard">
                <div className="lab-rsec" style={{ color: r.color }}>{r.sec}</div>
                <div className="lab-rtitle">{r.title}</div>
                <div className="lab-rhook">{r.hook}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <LabRunner scripts={lab.scripts} />
    </>
  );
}
