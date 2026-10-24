import { Fragment } from "react";
import { Check } from "lucide-react";

function Code({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((p, i) =>
        p.startsWith("`") ? (
          <code key={i} className="rounded border border-line bg-[var(--code-bg)] px-1 font-mono text-[0.88em] text-[var(--code-ink)]">{p.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/* One stop on a project's roadmap: what to build, the ideas it forces you to
   learn, and how you know it's done. Consecutive milestones read as a
   timeline down the left edge. */
export function Milestone({
  n, title, time, learn = [], done, children,
}: {
  n: number;
  title: string;
  time?: string;
  learn?: string[];
  done?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`m${n}`} className="relative my-6 scroll-mt-24 pl-10 sm:pl-14">
      <span className="absolute bottom-[-24px] left-[13px] top-9 w-px bg-line sm:left-[17px] sm:top-11" aria-hidden />
      <span className="absolute left-0 top-0 grid size-7 place-items-center rounded-lg text-[12px] sm:size-9 sm:rounded-xl bg-gradient-to-br from-accent to-accent-2 text-[14px] font-extrabold text-on-accent shadow-[0_8px_20px_-8px_var(--accent)]">
        {n}
      </span>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] sm:p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[19px] font-bold tracking-[-0.015em] text-ink">{title}</h3>
          {time && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold text-accent">{time}</span>}
        </div>
        <div className="text-[15.5px] leading-relaxed text-ink [&>p:last-child]:mb-0 [&>p]:mb-2.5 [&_ul]:mb-2.5">{children}</div>
        {learn.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="mr-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">You&rsquo;ll learn</span>
            {learn.map((l) => (
              <span key={l} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[12.5px] text-muted">{l}</span>
            ))}
          </div>
        )}
        {done && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-ok/10 px-3 py-2 text-[14px] text-ink">
            <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={3} />
            <span><b className="font-semibold">Done when:</b> <Code text={done} /></span>
          </div>
        )}
      </div>
    </section>
  );
}
