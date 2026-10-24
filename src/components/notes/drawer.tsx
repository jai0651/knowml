"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Download, Highlighter, MessageSquarePlus, Pencil, Search, Trash2, X } from "lucide-react";
import { ago, toMarkdown, type Highlight, type PageNotes } from "./store";
import { Composer, IconButton } from "./ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "comments" | "highlights";

/* The heading each highlight sits under, read from the painted page. Lets the
   list follow the chapter's own outline instead of being one long column. */
function sectionsOf(list: Highlight[]): Map<string, string> {
  const out = new Map<string, string>();
  const body = document.getElementById("chapter-body");
  if (!body) return out;
  const heads = Array.from(body.querySelectorAll<HTMLElement>("h2"));
  for (const h of list) {
    const m = body.querySelector(`mark.hl[data-hid="${h.id}"]`);
    if (!m) continue;
    let name = "Introduction";
    for (const hd of heads) {
      if (hd.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) name = hd.textContent?.replace(/^\s*\d+(\.\d+)*\s*/, "").replace(/#\s*$/, "").trim() || name;
      else break;
    }
    out.set(h.id, name);
  }
  return out;
}

export function Drawer({
  title,
  path,
  notes,
  update,
  onClose,
  onJump,
  onRemove,
  onSaveNote,
}: {
  title: string;
  path: string;
  notes: PageNotes;
  update: (fn: (p: PageNotes) => PageNotes) => void;
  onClose: () => void;
  onJump: (id: string) => void;
  onRemove: (id: string) => void;
  onSaveNote: (id: string, text: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const all = notes.highlights;
  const withNotes = all.filter((h) => h.note).length;
  const sections = useMemo(() => sectionsOf(all), [all]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = [...all]
      .filter((h) => (filter === "comments" ? h.note : filter === "highlights" ? !h.note : true))
      .filter((h) => !needle || h.text.toLowerCase().includes(needle) || h.note?.toLowerCase().includes(needle))
      .sort((a, b) => a.start - b.start);
    const g: { name: string; items: Highlight[] }[] = [];
    for (const h of shown) {
      const name = sections.get(h.id) ?? "Not found on the page";
      const last = g[g.length - 1];
      if (last?.name === name) last.items.push(h);
      else g.push({ name, items: [h] });
    }
    return g;
  }, [all, filter, q, sections]);

  const md = () => toMarkdown(title, location.href, notes);
  const empty = !all.length && !notes.freeNotes.trim();

  return (
    <>
      <div className="notes-scrim fixed inset-0 z-[55] bg-deep/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        data-notes-ui
        role="dialog"
        aria-label="Notes"
        className="notes-drawer glass-panel fixed right-0 top-0 z-[60] flex h-full w-full max-w-[440px] flex-col"
      >
        <header className="border-b border-line px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-accent-soft">
              <Highlighter className="size-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">Your notes</div>
              <div className="truncate text-[12px] text-faint">{title}</div>
            </div>
            <IconButton onClick={onClose} label="Close">
              <X className="size-4" />
            </IconButton>
          </div>

          {all.length > 0 && (
            <>
              <div className="mt-3.5 flex gap-1 rounded-lg bg-surface-2 p-1 text-[12.5px]">
                {(
                  [
                    ["all", "All", all.length],
                    ["comments", "Comments", withNotes],
                    ["highlights", "Highlights", all.length - withNotes],
                  ] as const
                ).map(([k, label, n]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors",
                      filter === k ? "bg-bg text-ink shadow-sm" : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                    <span className={cn("tnum text-[11px]", filter === k ? "text-accent" : "text-faint")}>{n}</span>
                  </button>
                ))}
              </div>
              {all.length > 4 && (
                <label className="mt-2.5 flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5 focus-within:border-accent">
                  <Search className="size-3.5 text-faint" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search your notes"
                    className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
                  />
                </label>
              )}
            </>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {all.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 px-5 py-7 text-center">
              <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-accent-soft">
                <MessageSquarePlus className="size-5 text-accent" />
              </div>
              <div className="mb-1 text-[14px] font-semibold text-ink">Select text to start</div>
              <p className="text-[12.5px] leading-relaxed text-faint">
                Highlight a passage with <kbd className="rounded border border-line px-1 font-mono">H</kbd>, or
                comment on it with <kbd className="rounded border border-line px-1 font-mono">C</kbd>. Notes stay on
                this device.
              </p>
            </div>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-faint">Nothing matches.</p>
          ) : (
            groups.map((g) => (
              <section key={g.name} className="mb-5">
                <div className="mb-2 truncate text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">{g.name}</div>
                <div className="space-y-2">
                  {g.items.map((h) => (
                    <article
                      key={h.id}
                      className={cn("notes-item group rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-2", `edge-${h.colour}`)}
                    >
                      <button
                        onClick={() => onJump(h.id)}
                        title="Show in chapter"
                        className="line-clamp-4 w-full text-left text-[13px] leading-relaxed text-ink hover:text-accent"
                      >
                        {h.text.replace(/\s+/g, " ").trim()}
                      </button>

                      {editing === h.id ? (
                        <div className="mt-2.5">
                          <Composer
                            initial={h.note ?? ""}
                            onSave={(t) => {
                              onSaveNote(h.id, t);
                              setEditing(null);
                            }}
                            onCancel={() => setEditing(null)}
                          />
                        </div>
                      ) : h.note ? (
                        <p className="mt-2.5 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink">
                          {h.note}
                        </p>
                      ) : null}

                      {editing !== h.id && (
                        <div className="mt-2 flex items-center gap-1 text-[11.5px] text-faint">
                          <span>{ago(h.edited ?? h.created)}</span>
                          <span className="flex-1" />
                          <button
                            onClick={() => setEditing(h.id)}
                            className="flex items-center gap-1 rounded-md px-1.5 py-1 opacity-70 transition hover:bg-surface-2 hover:text-ink group-hover:opacity-100"
                          >
                            {h.note ? <Pencil className="size-3" /> : <MessageSquarePlus className="size-3" />}
                            {h.note ? "Edit" : "Comment"}
                          </button>
                          <button
                            onClick={() => onRemove(h.id)}
                            aria-label="Delete"
                            className="rounded-md p-1 opacity-70 transition hover:bg-machine/12 hover:text-machine group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}

          <div className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">Page notes</div>
          <textarea
            value={notes.freeNotes}
            onChange={(e) => update((p) => ({ ...p, freeNotes: e.target.value }))}
            placeholder="Anything not tied to a passage: a number to remember, a gap to revisit…"
            className="min-h-[110px] w-full resize-y rounded-xl border border-line bg-surface p-3 text-[13.5px] leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-3.5">
          {confirmClear ? (
            <>
              <span className="flex-1 text-[12.5px] text-ink">Delete everything on this page?</span>
              <button onClick={() => setConfirmClear(false)} className="rounded-lg px-3 py-2 text-[12.5px] text-muted hover:bg-surface-2">
                Keep
              </button>
              <button
                onClick={() => {
                  update(() => ({ freeNotes: "", highlights: [] }));
                  setConfirmClear(false);
                }}
                className="rounded-lg bg-machine px-3 py-2 text-[12.5px] font-semibold text-white"
              >
                Delete all
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(md());
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                }}
                disabled={empty}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line py-2 text-[12.5px] text-ink transition-colors hover:border-line-2 hover:bg-surface-2 disabled:opacity-40"
              >
                <ClipboardCopy className="size-3.5" /> {copied ? "Copied" : "Copy as Markdown"}
              </button>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([md()], { type: "text/markdown" }));
                  a.download = `${path.split("/").pop() || "notes"}.md`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                disabled={empty}
                aria-label="Download .md"
                title="Download .md"
                className="grid size-9 place-items-center rounded-lg border border-line text-ink transition-colors hover:border-line-2 hover:bg-surface-2 disabled:opacity-40"
              >
                <Download className="size-3.5" />
              </button>
              <button
                onClick={() => setConfirmClear(true)}
                disabled={empty}
                className="rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-machine/50 hover:text-machine disabled:opacity-40"
              >
                Clear
              </button>
            </>
          )}
        </footer>
      </aside>
    </>
  );
}
