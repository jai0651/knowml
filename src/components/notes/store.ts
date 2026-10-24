"use client";

import { useCallback, useEffect, useState } from "react";

export const COLOURS = ["mint", "sky", "amber", "rose"] as const;
export type Colour = (typeof COLOURS)[number];

export interface Highlight {
  id: string;
  colour: Colour;
  note?: string;
  /** anchor */
  text: string;
  occurrence: number;
  start: number;
  end: number;
  created: number;
  /** last time the note text changed */
  edited?: number;
}

export interface PageNotes {
  freeNotes: string;
  highlights: Highlight[];
}

const EMPTY: PageNotes = { freeNotes: "", highlights: [] };
const key = (path: string) => `ks-notes::${path}`;

export function read(path: string): PageNotes {
  try {
    const raw = localStorage.getItem(key(path));
    if (!raw) return EMPTY;
    const v = JSON.parse(raw);
    /* The old "Note" button saved a single space as a placeholder note. */
    const highlights = (v.highlights ?? []).map((h: Highlight) => (h.note?.trim() ? h : { ...h, note: undefined }));
    return { freeNotes: v.freeNotes ?? "", highlights };
  } catch {
    return EMPTY;
  }
}

function write(path: string, v: PageNotes) {
  try {
    if (!v.freeNotes && !v.highlights.length) localStorage.removeItem(key(path));
    else localStorage.setItem(key(path), JSON.stringify(v));
  } catch {
    /* quota, or private mode. Losing a note is better than throwing mid-read. */
  }
}

/** Per-page notes, persisted to localStorage. Nothing leaves the device. */
export function useNotes(path: string) {
  const [notes, setNotes] = useState<PageNotes>(EMPTY);
  const [ready, setReady] = useState(false);

  // Hydration: the server has no localStorage, so the first paint must match
  // the server's empty state and the real value arrives on the next tick.
  useEffect(() => {
    setNotes(read(path));
    setReady(true);
  }, [path]);

  const update = useCallback(
    (fn: (prev: PageNotes) => PageNotes) => {
      setNotes((prev) => {
        const next = fn(prev);
        write(path, next);
        return next;
      });
    },
    [path],
  );

  return { notes, ready, update };
}

/** One highlight per line, grouped under the chapter title. Deliberately plain
 *  Markdown so it pastes into Obsidian, Notion or a PR description. */
export function toMarkdown(title: string, url: string, n: PageNotes): string {
  const lines = [`# ${title}`, "", url, ""];
  if (n.highlights.length) {
    lines.push("## Highlights", "");
    for (const h of [...n.highlights].sort((a, b) => a.start - b.start)) {
      lines.push(`> ${h.text.replace(/\s+/g, " ").trim()}`);
      if (h.note) lines.push("", `${h.note}`);
      lines.push("");
    }
  }
  if (n.freeNotes.trim()) {
    lines.push("## Notes", "", n.freeNotes.trim(), "");
  }
  return lines.join("\n");
}

/** "just now", "12 min ago", "yesterday", then a date. */
export function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "yesterday";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: s > 31536000 ? "numeric" : undefined });
}
