"use client";

import { useState } from "react";
import { Check, ChevronRight, Lightbulb, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/* Components for system design case studies.

     <Think>      stop and design it yourself before reading on; a hint and
                  one good answer are revealed on demand
     <Decision>   the options that were on the table, what each costs, which
                  one was chosen; the reasons go in the children
     <Elsewhere>  the same idea in other systems, for readers who want depth
     <Zoom>       where we are, from the whole system down to a data structure */

export function Think({
  q, hint, children,
}: {
  q: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [showHint, setShowHint] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <div className="my-9 rounded-xl border border-accent/30 bg-accent/[0.05] p-5 font-[family-name:var(--font-inter)]">
      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-accent">
        <Lightbulb className="size-3.5" /> Your turn: design it before reading on
      </div>
      <p className="mb-4 font-[family-name:var(--font-serif)] text-[18.5px] leading-snug text-ink">{q}</p>
      {showHint && hint && (
        <p className="mb-4 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14.5px] leading-relaxed text-muted">
          <b className="font-semibold text-ink">Hint.</b> {hint}
        </p>
      )}
      {open && (
        <div className="mb-4 border-t border-line pt-4 text-[15.5px] leading-relaxed text-ink [&>p:last-child]:mb-0 [&>p]:mb-2.5 [&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {hint && !showHint && !open && (
          <button onClick={() => setShowHint(true)} className="rounded-lg border border-line-2 px-3 py-1.5 text-[13.5px] text-muted transition hover:border-accent hover:text-ink">
            Show a hint
          </button>
        )}
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-[13.5px] font-medium text-ink transition hover:bg-accent/20">
          {open ? "Hide the answer" : "I've thought about it: show one answer"}
        </button>
      </div>
    </div>
  );
}

export function Decision({
  q, options, children,
}: {
  q: string;
  options: { name: string; how: string; good: string[]; bad: string[]; chosen?: boolean }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="not-prose my-10 rounded-2xl border border-line bg-surface p-5 font-[family-name:var(--font-inter)] shadow-[var(--shadow)] lg:-mx-6">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.07em] text-faint">Decision</div>
      <p className="mb-4 font-[family-name:var(--font-serif)] text-[19px] leading-snug text-ink">{q}</p>
      <div className={cn("grid gap-3", options.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {options.map((o) => (
          <div
            key={o.name}
            className={cn(
              "relative rounded-xl border p-4",
              o.chosen ? "border-data bg-data/[0.07] shadow-[0_0_0_1px_var(--c-data)]" : "border-line bg-surface-2",
            )}
          >
            {o.chosen && (
              <span className="absolute -top-2.5 right-3 flex items-center gap-1 rounded-md bg-data px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-bg">
                <Check className="size-3" /> chosen
              </span>
            )}
            <div className="mb-1 text-[15px] font-semibold text-ink">{o.name}</div>
            <div className="mb-3 text-[13.5px] leading-snug text-muted">{o.how}</div>
            <ul className="space-y-1.5 text-[13.5px] leading-snug">
              {o.good.map((g) => (
                <li key={g} className="flex gap-1.5 text-ink"><Plus className="mt-0.5 size-3.5 shrink-0 text-data" />{g}</li>
              ))}
              {o.bad.map((b) => (
                <li key={b} className="flex gap-1.5 text-muted"><Minus className="mt-0.5 size-3.5 shrink-0 text-bad" />{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {children && (
        <div className="prose-sm mt-4 border-t border-line pt-4 text-[15px] leading-relaxed text-ink [&>p:last-child]:mb-0 [&>p]:mb-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

export function Elsewhere({ items }: { items: { where: string; how: string }[] }) {
  return (
    <aside className="not-prose my-8 rounded-xl border border-line bg-surface-2 px-5 py-4 font-[family-name:var(--font-inter)]">
      <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.07em] text-accent-2">The same idea elsewhere</div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.where} className="flex gap-2 text-[14.5px] leading-snug">
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint" />
            <span><b className="font-semibold text-ink">{it.where}.</b> <span className="text-muted">{it.how}</span></span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function Zoom({ path }: { path: string[] }) {
  return (
    <div className="not-prose my-6 flex flex-wrap items-center gap-1 font-mono text-[11.5px] text-faint">
      <span className="mr-1 uppercase tracking-wider">zoom</span>
      {path.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3" />}
          <span className={cn("rounded px-1.5 py-0.5", i === path.length - 1 ? "bg-accent/15 text-ink" : "bg-surface-2")}>{p}</span>
        </span>
      ))}
    </div>
  );
}

/* A real photo or illustration from outside the site. Every one carries its
   credit and licence, linked to the page it came from. */
export function Picture({
  src, alt, caption, credit, href, narrow, paper,
}: {
  src: string;
  alt: string;
  caption?: string;
  credit: string;
  href?: string;
  narrow?: boolean;
  /** draw on a white card: for line drawings with a transparent background */
  paper?: boolean;
}) {
  return (
    <figure className={cn("not-prose my-10", narrow ? "mx-auto max-w-[520px]" : "lg:-mx-6")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className={cn("w-full rounded-xl border border-line", paper ? "bg-white p-4" : "bg-white/[0.02]")} />
      <figcaption className="mt-2.5 px-1 font-[family-name:var(--font-inter)]">
        {caption && <span className="block text-[14.5px] leading-relaxed text-muted">{caption}</span>}
        <span className="mt-1 block text-[11.5px] text-faint">
          {href ? <a href={href} target="_blank" rel="noopener" className="underline decoration-line-2 underline-offset-2 hover:text-ink">{credit}</a> : credit}
        </span>
      </figcaption>
    </figure>
  );
}
