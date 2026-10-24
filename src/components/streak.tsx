"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Flame } from "lucide-react";
import { dayKey, recordVisit, summarise, useDays } from "@/lib/streak";
import { useDone } from "@/lib/progress";
import { cn } from "@/lib/utils";

const WEEKS = 15;
const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

/* The flame in the top bar. Opening any page counts the day; the pill shows
   the current run and opens a card with this week, the last few months and
   the reader's best. The first visit of a day that extends a streak gets a
   short celebration, so keeping it feels like something. */
export function StreakPill() {
  const path = usePathname();
  const days = useDays();
  const done = useDone().length;
  const [open, setOpen] = useState(false);
  const [cheer, setCheer] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = recordVisit();
    if (!first) return;
    const n = summarise(JSON.parse(localStorage.getItem("kml-days") ?? "{}")).current;
    if (n >= 2) setCheer(n);
  }, [path]);

  useEffect(() => {
    if (cheer === null) return;
    const t = setTimeout(() => setCheer(null), 4500);
    return () => clearTimeout(t);
  }, [cheer]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!days) return <span className="h-[34px] w-[58px]" aria-hidden />;
  const s = summarise(days);
  const lit = s.current > 0;

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`${s.current}-day reading streak`}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-semibold transition-colors",
          lit ? "streak-lit border-streak/40 text-ink hover:border-streak" : "border-line text-muted hover:border-line-2",
          cheer !== null && "streak-bump",
        )}
      >
        <Flame className={cn("size-[17px]", lit ? "streak-flame" : "text-faint")} />
        <span className="tnum">{s.current}</span>
      </button>

      {cheer !== null && !open && (
        <div className="streak-cheer absolute right-0 top-[calc(100%+10px)] z-50 w-max max-w-[260px] rounded-xl border border-line-2 bg-bg px-3.5 py-2.5 text-[13px] text-ink shadow-[var(--shadow)]">
          <b className="font-semibold">{MILESTONES.includes(cheer) ? `${cheer} days in a row!` : `Day ${cheer}.`}</b>{" "}
          <span className="text-muted">Streak kept.</span>
        </div>
      )}

      {open && <StreakCard days={days} done={done} />}
    </div>
  );
}

function StreakCard({ days, done }: { days: Record<string, number>; done: number }) {
  const s = summarise(days);
  const now = new Date();
  const todayKey = dayKey(now);
  const next = MILESTONES.find((m) => m > s.current);

  /* This week, Monday first. */
  const dow = (now.getDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + i));

  /* The calendar: WEEKS columns ending with this week, a row per weekday. */
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - (WEEKS - 1) * 7);
  const cols = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)),
  );
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);

  return (
    <div className="streak-card absolute right-0 top-[calc(100%+10px)] z-50 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-line-2 bg-bg p-4 shadow-[var(--shadow)]">
      <div className="flex items-center gap-3">
        <div className={cn("grid size-12 place-items-center rounded-xl", s.current ? "bg-streak/15" : "bg-surface-2")}>
          <Flame className={cn("size-7", s.current ? "streak-flame" : "text-faint")} />
        </div>
        <div>
          <div className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            {s.current} day{s.current === 1 ? "" : "s"}
          </div>
          <div className="text-[12.5px] text-muted">
            {s.today
              ? next
                ? `${next - s.current} more to reach ${next}. Come back tomorrow.`
                : "Come back tomorrow to keep it going."
              : s.current
                ? "Open a chapter today to keep your streak."
                : "Open a chapter today to start a streak."}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const k = dayKey(d);
          const hit = Boolean(days[k]);
          const future = k > todayKey;
          return (
            <div key={k} className="flex flex-col items-center gap-1">
              <span className={cn("text-[10.5px] font-medium", k === todayKey ? "text-ink" : "text-faint")}>
                {d.toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full",
                  hit ? "bg-streak text-bg" : future ? "border border-dashed border-line" : "bg-surface-2",
                  k === todayKey && !hit && "ring-2 ring-streak/50",
                )}
              >
                {hit && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-3">
        <div className="flex gap-[3px]" role="img" aria-label={`Reading activity over the last ${WEEKS} weeks`}>
          {cols.map((col, i) => (
            <div key={i} className="flex flex-1 flex-col gap-[3px]">
              {col.map((d) => {
                const k = dayKey(d);
                const future = k > todayKey;
                return (
                  <span
                    key={k}
                    title={future ? undefined : `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}: ${days[k] ?? 0} page${days[k] === 1 ? "" : "s"}`}
                    className={cn("aspect-square rounded-[3px]", future ? "opacity-0" : `heat-${level(days[k] ?? 0)}`)}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10.5px] text-faint">
          Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className={cn("size-2.5 rounded-[2px]", `heat-${l}`)} />)} More
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Best", s.longest],
          ["Days read", s.total],
          ["Chapters done", done],
        ].map(([label, v]) => (
          <div key={label} className="flex flex-col-reverse rounded-lg bg-surface-2 py-2">
            <dt className="text-[11px] text-faint">{label}</dt>
            <dd className="tnum text-[16px] font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">Saved in this browser only. A day counts when you open any page.</p>
    </div>
  );
}
