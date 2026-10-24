import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   The scaffolding components. AlgoMaster's load-balancer chapter runs 10,174
   words with 13 tables and zero code blocks, and stays navigable because
   every option is presented in the same four-part shape and every section is
   numbered. Both of those are worth taking; the missing code is the gap we
   fill.
   ────────────────────────────────────────────────────────────────────────── */

/** A numbered subsection inside one of the six spine sections. */
export function Sub({
  n, title, children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  const id = `s${n.replace(/\./g, "-")}`;
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h3 className="mb-4 flex items-baseline gap-2.5 text-[21px] font-bold leading-snug tracking-[-0.015em] text-ink">
        <span className="tnum shrink-0 font-mono text-[14px] font-medium text-faint">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ── Approach ────────────────────────────────────────────────────────────
   One option among several, always in the same four parts. When eight
   algorithms are presented this way the reader can compare them by position
   instead of re-reading each one. */
export function Approach({
  n, name, breaks, bestFor, children,
}: {
  n: number | string;
  name: string;
  breaks: string;
  bestFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass my-5 overflow-hidden rounded-xl">
      <div className="flex items-baseline gap-2.5 border-b border-line px-5 py-3">
        <span className="tnum grid size-6 shrink-0 place-items-center rounded-lg bg-accent-soft font-mono text-[11px] font-semibold text-accent">
          {n}
        </span>
        <span className="text-[15.5px] font-semibold text-ink">{name}</span>
      </div>

      <div className="px-5 py-4 text-[14.5px] leading-relaxed [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>

      <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
        <div className="bg-bg/40 px-5 py-3.5 backdrop-blur-sm">
          <dt className="mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-machine">
            where it breaks
          </dt>
          <dd className="text-[13.5px] leading-snug text-muted">{breaks}</dd>
        </div>
        <div className="bg-bg/40 px-5 py-3.5 backdrop-blur-sm">
          <dt className="mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-accent">
            reach for it when
          </dt>
          <dd className="text-[13.5px] leading-snug text-muted">{bestFor}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ── Estimate ────────────────────────────────────────────────────────────
   Back-of-the-envelope arithmetic with the working shown. The rule on this
   site is that a number is derived on the page or attributed, and this is
   what "derived on the page" looks like. */
export function Estimate({
  rows, result,
}: {
  rows: { label: string; math: string; value: string }[];
  result?: { label: string; value: string };
}) {
  return (
    <div className="glass my-6 overflow-hidden rounded-xl">
      <table className="w-full border-collapse text-[13.5px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn(i > 0 && "border-t border-line")}>
              <td className="w-[38%] px-4 py-3 align-top text-muted">{r.label}</td>
              <td className="tnum px-4 py-3 align-top font-mono text-[12.5px] text-faint">
                {r.math}
              </td>
              <td className="tnum whitespace-nowrap px-4 py-3 text-right align-top font-mono font-semibold text-ink">
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
        {result && (
          <tfoot>
            <tr className="border-t border-line-2 bg-accent-soft">
              <td className="px-4 py-3.5 font-semibold text-ink" colSpan={2}>
                {result.label}
              </td>
              <td className="tnum whitespace-nowrap px-4 py-3.5 text-right font-mono text-[16px] font-bold text-accent">
                {result.value}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ── Figure ──────────────────────────────────────────────────────────────
   A diagram with a caption that says what to look at. */
export function Figure({
  caption, children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-7">
      <div className="glass overflow-x-auto rounded-xl p-5">{children}</div>
      <figcaption className="mt-2.5 text-[12.5px] leading-relaxed text-faint">
        {caption}
      </figcaption>
    </figure>
  );
}

/* ── Quiz ────────────────────────────────────────────────────────────────
   End-of-chapter check. Not interview questions — those have their own
   section. These are "did the mechanism land". */
export function Quiz({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass my-7 overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <span className="size-1.5 rounded-full bg-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-accent">
          check yourself
        </span>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

export function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3.5 text-[14.5px] leading-snug text-ink transition-colors hover:bg-surface-2">
        <span className="flex-1">{q}</span>
        <span className="mt-0.5 shrink-0 font-mono text-[11px] text-faint transition-transform duration-200 group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="bg-surface-2/40 px-5 py-3.5 text-[14px] leading-relaxed text-muted [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </details>
  );
}

/* ── Compare ─────────────────────────────────────────────────────────────
   A comparison table that keeps its shape on a phone. */
export function Compare({
  cols, rows,
}: {
  cols: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="glass my-6 overflow-x-auto rounded-xl">
      <table className="w-full border-collapse text-[13.8px]">
        <thead>
          <tr className="border-b border-line-2">
            {cols.map((c, ci) => (
              <th
                key={ci}
                className="px-4 py-3 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn(i > 0 && "border-t border-line")}>
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-3 align-top leading-snug",
                    j === 0 ? "font-medium text-ink" : "text-muted",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
