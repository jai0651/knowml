"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface RailItem {
  id: string;
  n: string;
  label: string;
  cmd?: string;
  subs?: { id: string; n: string; label: string }[];
}

/* "On this page", with the section you're in marked and its subsections
   unfolded, and a reading-progress box underneath: how far through you are
   and roughly how long is left. */
export function SpineRail({
  spine, tail = [], minutes,
}: {
  spine: RailItem[];
  tail?: RailItem[];
  minutes?: number;
  title?: string;
}) {
  const all = useMemo(() => [...spine, ...tail], [spine, tail]);
  const ids = useMemo(() => all.flatMap((s) => [s.id, ...(s.subs ?? []).map((x) => x.id)]), [all]);
  const [active, setActive] = useState(all[0]?.id ?? "");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);

  useEffect(() => {
    const body = document.getElementById("chapter-body");
    if (!body) return;
    const on = () => {
      const r = body.getBoundingClientRect();
      const p = Math.min(Math.max((-r.top + 90) / Math.max(r.height - window.innerHeight * 0.6, 1), 0), 1);
      setPct(Math.round(p * 100));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const activeTop = all.findIndex((s) => s.id === active || (s.subs ?? []).some((x) => x.id === active));

  return (
    <aside className="hidden w-[240px] shrink-0 xl:block">
      <nav className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-9 text-[13.5px]">
        <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">On this page</div>
        <ul className="border-l-2 border-line">
          {all.map((s, i) => {
            const open = i === activeTop;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cn(
                    "-ml-[2px] block border-l-2 py-[5px] pl-3 leading-snug transition-colors",
                    open ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {s.n ? `${s.n.replace(/^0/, "")} · ` : ""}{s.label}
                </a>
                {open && (s.subs?.length ?? 0) > 0 && (
                  <ul>
                    {s.subs!.map((x) => (
                      <li key={x.id}>
                        <a
                          href={`#${x.id}`}
                          className={cn("block py-[4px] pl-6 text-[13px] leading-snug transition-colors", x.id === active ? "text-accent" : "text-faint hover:text-muted")}
                        >
                          {x.n} {x.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 text-[12.5px] text-faint">
          {pct}% read{minutes ? ` · ${Math.max(Math.round(minutes * (1 - pct / 100)), 0)} min left` : ""}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </nav>
    </aside>
  );
}
