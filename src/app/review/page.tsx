import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./review.css";
import { TopNav } from "@/components/top-nav";
import { Sidebar } from "@/components/sidebar";
import { pageMeta } from "@/lib/site";
import { ReviewScripts } from "./review-scripts";

export const metadata: Metadata = pageMeta(
  "/review",
  "Review",
  "Drill the interview questions from every section with spaced repetition: answer, rate yourself, and let the schedule bring each one back exactly when you are about to forget it.",
);

export default function ReviewPage() {
  return (
    <>
      <TopNav />
      <div className="mx-auto flex max-w-[1560px] gap-2 px-4 pt-8 sm:px-6">
        <Sidebar />
        <main className="pg-review min-w-0 flex-1 pb-24 sm:px-6">
          <div className="rv-inner">
            <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-accent">Spaced repetition</div>
            <h1 className="mb-3 text-[34px] font-bold tracking-tight text-ink sm:text-[40px]">Review</h1>
            <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted">
              Reading a section is the easy half. This is the half that makes it stick: answer the question before you
              look, tell the truth about how it went, and let the schedule decide when you see it again.
            </p>

            <div className="rv-stats">
              <div className="rv-stat"><div className="rv-num" id="statDue">0</div><div className="rv-lbl">Due now</div></div>
              <div className="rv-stat"><div className="rv-num" id="statNew">0</div><div className="rv-lbl">Not yet seen</div></div>
              <div className="rv-stat"><div className="rv-num" id="statKnown">0</div><div className="rv-lbl">Known</div></div>
              <div className="rv-stat"><div className="rv-num" id="statStreak">0</div><div className="rv-lbl">Day streak</div></div>
            </div>

            <div className="rv-overall">
              <div className="rv-overall-head">
                <span className="rv-overall-label">Overall recall</span>
                <span className="rv-overall-pct" id="overallPct">0%</span>
              </div>
              <div className="rv-overall-track"><div className="rv-overall-fill" id="overallBar" style={{ width: "0%" }} /></div>
              <div className="rv-overall-detail" id="overallDetail" />
            </div>

            <section className="rv-setup" id="reviewSetup">
              <h2>Start a session</h2>
              <p className="rv-setup-hint" id="setupHint">
                Due cards come first, then ones you have never seen. A card you miss comes back before the session ends.
              </p>
              <div className="rv-controls">
                <label>Section
                  <select id="filterGroup" defaultValue=""><option value="">Everything</option></select>
                </label>
                <label>Difficulty
                  <select id="filterLevel" defaultValue="">
                    <option value="">Any</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="deep">Deep</option>
                  </select>
                </label>
                <label>Length
                  <select id="filterLimit" defaultValue="20">
                    <option value="10">10 cards</option>
                    <option value="20">20 cards</option>
                    <option value="40">40 cards</option>
                    <option value="200">Everything due</option>
                  </select>
                </label>
                <button className="btn-primary" id="startBtn">Start review <span className="arrow">→</span></button>
              </div>
              <p className="rv-empty" id="drillEmpty" hidden />
            </section>

            <section className="drill" id="drill" hidden>
              <div className="drill-track"><div className="drill-track-fill" id="drillProgress" /></div>
              <div className="drill-meta">
                <a className="drill-chip" id="drillChip" href="#" />
                <span className="qa-level" id="drillLevel" />
                <span className="drill-state" id="drillState" />
                <span className="drill-count" id="drillCount" />
                <button className="drill-exit" id="drillExit" title="End session (Esc)">✕</button>
              </div>
              <div className="drill-q" id="drillQ" />
              <div className="drill-a" id="drillA" hidden />
              <button className="drill-reveal" id="drillReveal">Show answer <kbd>space</kbd></button>
              <div className="drill-rate" id="drillRate" hidden>
                <button className="dr-again" data-rate="again">No idea <kbd>1</kbd></button>
                <button className="dr-hard" data-rate="hard">Shaky <kbd>2</kbd></button>
                <button className="dr-good" data-rate="good">Got it <kbd>3</kbd></button>
              </div>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- href is rewritten by review-page.js per card */}
              <a className="drill-source" id="drillSource" href="#">Read the full section →</a>
            </section>

            <section className="rv-done" id="drillDone" hidden>
              <div className="rv-done-check">✓</div>
              <h2>Session complete</h2>
              <p id="doneSummary" />
              <button className="btn-secondary" id="doneAgain">Start another</button>
            </section>

            <section className="rv-section">
              <div className="rv-section-head">
                <h2>Recall by section</h2>
                <p className="rv-sub">
                  A section counts as known once you have recalled it correctly across a widening gap, not once you have
                  read it. Click any bar to drill just that section.
                </p>
              </div>
              <div className="mastery-list" id="masteryList" />
            </section>

            <section className="rv-section">
              <div className="rv-section-head">
                <h2>Back from your highlights <span className="rv-count" id="hlCount" /></h2>
                <p className="rv-sub">
                  Everything you marked while reading, newest first. Worth a second look: you flagged it for a reason.
                </p>
              </div>
              <div className="hl-grid" id="hlList" />
            </section>

            <div className="rv-footer">
              <button className="rv-reset" id="resetBtn">Reset review progress</button>
              <span>Your schedule, highlights and notes live in this browser only.</span>
            </div>
          </div>
        </main>
      </div>
      <ReviewScripts />
    </>
  );
}
