"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Hit {
  s: string; t: string; g: string; k: "page" | "section";
  h?: string; a?: string; x: string; n: string; status: string; u?: string;
}

/** Ranks title matches above heading matches above body matches, and an exact
 *  phrase above scattered words. Crude, and enough for 356 entries — a real
 *  index would be worth it somewhere north of a few thousand. */
function score(hit: Hit, q: string, words: string[]): number {
  const title = (hit.h ?? hit.t).toLowerCase();
  let n = 0;
  if (title === q) n += 1000;
  if (title.startsWith(q)) n += 400;
  if (title.includes(q)) n += 220;
  if (hit.x.includes(q)) n += 90;
  for (const w of words) {
    if (title.includes(w)) n += 40;
    else if (hit.x.includes(w)) n += 12;
    else return -1; // every word has to appear somewhere
  }
  if (hit.k === "page") n += 25;
  if (hit.status === "stub") n -= 60;
  return n;
}

export function Search() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState<Hit[] | null>(null);
  const [cur, setCur] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Index is a few hundred KB, so it loads on first open rather than on every
  // page view.
  useEffect(() => {
    if (!open || idx) return;
    fetch("/api/search").then((r) => r.json()).then(setIdx).catch(() => setIdx([]));
  }, [open, idx]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!idx || term.length < 2) return [];
    const words = term.split(/\s+/).filter(Boolean);
    return idx
      .map((h) => ({ h, n: score(h, term, words) }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 24)
      .map((r) => r.h);
  }, [idx, q]);

  const go = useCallback(
    (h: Hit) => {
      setOpen(false);
      setQ("");
      router.push(h.u ?? `/topics/${h.s}${h.a ? `#${h.a}` : ""}`);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCur((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && results[cur]) { e.preventDefault(); go(results[cur]); }
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cur}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-faint transition-colors hover:border-line-2 hover:text-muted sm:min-w-[240px]"
        aria-label="Search"
      >
        <SearchIcon className="size-3.5" />
        <span className="hidden flex-1 text-left md:inline">Search chapters…</span>
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] md:inline">⌘K</kbd>
      </button>

      {/* Portalled for the same reason as the mobile drawer: a fixed element
          inside the blurred header is positioned against the header. */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[70] bg-ink/25 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="glass fixed left-1/2 top-[12vh] z-[71] w-[min(94vw,640px)] -translate-x-1/2 overflow-hidden rounded-xl">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <SearchIcon className="size-4 shrink-0 text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => { setQ(e.target.value); setCur(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search chapters and sections…"
                className="w-full bg-transparent py-4 text-[15px] text-ink outline-none placeholder:text-faint"
              />
              <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">esc</kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-[13px] text-faint">
                  Type at least two characters. Sections are indexed separately, so
                  &ldquo;false sharing&rdquo; lands on the section, not just the chapter.
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-faint">
                  Nothing for &ldquo;{q}&rdquo;.
                </p>
              ) : (
                results.map((h, i) => (
                  <button
                    key={`${h.s}-${h.a ?? "page"}-${i}`}
                    data-i={i}
                    onMouseEnter={() => setCur(i)}
                    onClick={() => go(h)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      i === cur ? "bg-surface-2" : "hover:bg-surface-2/60",
                    )}
                  >
                    <span className="tnum mt-0.5 shrink-0 font-mono text-[11px] text-faint">{h.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{h.h ?? h.t}</span>
                      <span className="block truncate text-[11.5px] text-faint">
                        {h.h ? `${h.t} · ${h.g}` : h.g}
                        {h.status === "stub" && " · stub"}
                      </span>
                    </span>
                    {i === cur && <CornerDownLeft className="mt-1 size-3.5 shrink-0 text-faint" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
