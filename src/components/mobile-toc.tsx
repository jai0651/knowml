"use client";

import { useEffect, useState } from "react";
import { ListTree, X } from "lucide-react";
import type { RailItem } from "./spine-rail";
import { cn } from "@/lib/utils";

/* The "On this page" rail only fits on wide screens. On a phone, this pill
   sits at the bottom-left with how far you've read, and opens the same
   section list as a sheet. */
export function MobileToc({ items }: { items: RailItem[] }) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const body = document.getElementById("chapter-body");
    if (!body) return;
    const on = () => {
      const r = body.getBoundingClientRect();
      setPct(Math.round(Math.min(Math.max((-r.top + 90) / Math.max(r.height - window.innerHeight * 0.6, 1), 0), 1) * 100));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!items.length) return null;
  return (
    <div className="xl:hidden">
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-line-2 bg-surface/95 px-3.5 py-2.5 text-[13.5px] font-semibold text-ink shadow-[var(--shadow)] backdrop-blur"
        aria-label="Chapter contents"
      >
        <ListTree className="size-4 text-accent" />
        Contents
        <span className="tnum rounded-full bg-accent-soft px-1.5 py-px text-[11.5px] text-accent">{pct}%</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <nav
            onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl border-t border-line bg-bg px-5 pb-8 pt-4"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-2" />
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[16px] font-bold text-ink">On this page</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2">
                <X className="size-[18px]" />
              </button>
            </div>
            <ol className="space-y-0.5">
              {items.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-3 rounded-lg px-2 py-2.5 text-[15px] font-medium text-ink hover:bg-surface-2">
                    <span className="tnum w-6 shrink-0 font-mono text-[13px] text-accent">{s.n ? s.n.replace(/^0/, "") : "·"}</span>
                    {s.label}
                  </a>
                  {(s.subs ?? []).length > 0 && (
                    <ul className="mb-1 ml-9 border-l border-line">
                      {s.subs!.map((x) => (
                        <li key={x.id}>
                          <a href={`#${x.id}`} className={cn("block py-1.5 pl-3 text-[13.5px] text-muted hover:text-ink")}>{x.label}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}
    </div>
  );
}
