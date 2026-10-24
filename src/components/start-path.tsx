"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useDone } from "@/lib/progress";
import { cn } from "@/lib/utils";

/* "New here? Start with these." Ticks off as the reader marks chapters done,
   so returning visitors see where they left off. */
export function StartPath({
  items,
}: {
  items: { slug: string; href: string; title: string; why: string; time?: string }[];
}) {
  const done = useDone();
  const next = items.find((i) => !done.includes(i.slug));
  return (
    <aside className="self-start rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
      <div className="mb-1 text-[15px] font-bold text-ink">New here? Start with these</div>
      <p className="mb-5 text-[13.5px] leading-relaxed text-faint">Five chapters in order. Each builds on the one before.</p>
      <ol className="space-y-1">
        {items.map((s, i) => {
          const isDone = done.includes(s.slug);
          const isNext = next?.slug === s.slug;
          return (
            <li key={s.slug}>
              <Link
                href={s.href}
                className={cn(
                  "-mx-2 flex gap-3.5 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2",
                  isNext && "bg-accent-soft/60",
                )}
              >
                <span
                  className={cn(
                    "tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold",
                    isDone ? "bg-ok text-white" : isNext ? "bg-gradient-to-br from-accent to-accent-2 text-on-accent" : "border border-line-2 text-muted",
                  )}
                >
                  {isDone ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug text-ink">{s.title}</span>
                  <span className="block text-[13px] leading-snug text-faint">
                    {s.why}
                    {s.time && ` · ${s.time}`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
