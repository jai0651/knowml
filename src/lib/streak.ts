"use client";

import { useSyncExternalStore } from "react";

/* Reading streaks. Each local calendar day the reader opens a page is recorded
   with a count of pages opened, in this browser only, like the rest of the
   reader's state here. The streak is the run of consecutive days ending today,
   or ending yesterday if today hasn't been visited yet: a streak only breaks
   once a whole day passes with no visit. */
const KEY = "kml-days";
const listeners = new Set<() => void>();
type Days = Record<string, number>;
let cache: Days | null = null;

/** Local-time YYYY-MM-DD, so a streak follows the reader's own midnight. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function read(): Days {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    cache = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    cache = {};
  }
  return cache!;
}

/** Count one page view today. Returns true if this was the first today. */
export function recordVisit(): boolean {
  const days = read();
  const k = dayKey(new Date());
  const first = !days[k];
  cache = { ...days, [k]: (days[k] ?? 0) + 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  listeners.forEach((l) => l());
  return first;
}

export interface Streak {
  days: Days;
  current: number;
  longest: number;
  total: number;
  today: boolean;
}

export function summarise(days: Days, now = new Date()): Streak {
  const today = Boolean(days[dayKey(now)]);
  let current = 0;
  for (let d = today ? now : shift(now, -1); days[dayKey(d)]; d = shift(d, -1)) current++;

  const keys = Object.keys(days).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    const [y, m, dd] = k.split("-").map(Number);
    run = prev && dayKey(shift(new Date(y, m - 1, dd), -1)) === prev ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  return { days, current, longest: Math.max(longest, current), total: keys.length, today };
}

const EMPTY: Days = {};
export function useDays(): Days | null {
  const d = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
  /* The server snapshot is the shared EMPTY object; anything else is real. */
  return d === EMPTY ? null : d;
}
