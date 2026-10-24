"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { groups } from "@/lib/manifest";
import { BrandLogo, hasBrandLogo } from "./brand-logo";
import { useDone } from "@/lib/progress";
import { cn } from "@/lib/utils";

/* The course outline. Each chapter carries a status ring: ticked when the
   reader marked it complete, filled when it's the one open, faint when it
   isn't written yet. Groups fold except the one you're in. */
export function Sidebar({ currentSlug }: { currentSlug?: string }) {
  const done = useDone();
  return (
    <aside className="hidden w-[256px] shrink-0 lg:block">
      <nav className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-7 pr-2 text-[14px]">
        {groups.map((g) => {
          const open = g.pages.some((p) => p.slug === currentSlug) || !currentSlug;
          const complete = g.pages.filter((p) => done.includes(p.slug)).length;
          return (
            <details key={g.slug} open={open} className="mb-3">
              <summary className="mb-1 flex cursor-pointer list-none items-center justify-between px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint hover:text-muted">
                <span>{g.name}</span>
                <span className="tnum font-medium normal-case tracking-normal">{complete}/{g.pages.length}</span>
              </summary>
              {g.pages.map((p) => {
                const active = p.slug === currentSlug;
                const isDone = done.includes(p.slug);
                const stub = p.status === "stub";
                return (
                  <Link
                    key={p.slug}
                    href={p.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] leading-snug transition-colors",
                      active ? "bg-accent-soft font-semibold text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
                      stub && !active && "text-faint",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
                        isDone ? "border-ok bg-ok text-white" : active ? "border-accent" : "border-line-2",
                      )}
                    >
                      {isDone ? <Check className="size-2.5" strokeWidth={3.5} /> : active ? <span className="size-2 rounded-full bg-accent" /> : null}
                    </span>
                    {hasBrandLogo(p.slug) && <BrandLogo slug={p.slug} size={18} />}
                    <span className="min-w-0 flex-1">{p.short}</span>
                    {stub && <span className="text-[10.5px] text-faint">soon</span>}
                  </Link>
                );
              })}
            </details>
          );
        })}
      </nav>
    </aside>
  );
}
