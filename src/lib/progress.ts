"use client";

import { useSyncExternalStore } from "react";

/* Which chapters the reader has marked complete. Local to the browser: no
   account, nothing sent anywhere. Components subscribe so a tick in the
   header updates the sidebar and the progress pill at once. */
const KEY = "np-done-pages";
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; }
  return cache!;
}

export function setDone(slug: string, done: boolean) {
  const cur = new Set(read());
  if (done) cur.add(slug); else cur.delete(slug);
  cache = [...cur];
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  listeners.forEach((l) => l());
}

const EMPTY: string[] = [];
export function useDone(): string[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => EMPTY,
  );
}
