"use client";

import { useDone } from "@/lib/progress";

export function ProgressPill({ total }: { total: number }) {
  const n = useDone().length;
  const pct = Math.round((n / Math.max(total, 1)) * 100);
  return (
    <span className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] text-muted md:flex" title="Chapters you've marked complete, in this browser">
      <span className="size-[18px] rounded-full" style={{ background: `conic-gradient(var(--accent) 0 ${pct}%, var(--line-2) ${pct}% 100%)` }} />
      <b className="tnum font-semibold text-ink">{n}</b>/{total} done
    </span>
  );
}
