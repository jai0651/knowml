"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Highlighter, MessageSquarePlus, MessageSquareText, Pencil, Trash2, X } from "lucide-react";
import { occurrenceAt, paint, rangeToOffsets, unwrap, type Anchor } from "@/lib/anchor";
import { COLOURS, ago, useNotes, type Colour, type Highlight } from "./store";
import { Floating } from "./floating";
import { Drawer } from "./drawer";
import { BarButton, Composer, CopyButton, IconButton } from "./ui";
import { cn } from "@/lib/utils";

const ROOT_ID = "chapter-body";
const LAST_COLOUR = "ks-notes-colour";
const uid = () => "h" + Math.random().toString(36).slice(2, 10);
const root = () => document.getElementById(ROOT_ID);
const marksOf = (id: string) =>
  Array.from(root()?.querySelectorAll<HTMLElement>(`mark.hl[data-hid="${id}"]`) ?? []);
const isField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/* ──────────────────────────────────────────────────────────────────────────
   Highlights are painted into server-rendered MDX by direct DOM mutation, not
   by React. That is safe here precisely because the article is a server
   component that never re-renders: React has no virtual DOM opinion about the
   <mark> elements, so it will not fight them or throw them away.

   The interaction follows Confluence's inline comments. Selecting text raises
   a small bar: highlight in a colour, or comment. Commenting marks the text
   straight away and opens a composer pinned to it. Clicking a highlight later
   opens its card, where the comment reads as text until you choose to edit it.
   Noted highlights also get a bubble in the right margin, so they can be found
   by scanning the page.
   ────────────────────────────────────────────────────────────────────────── */

type Card = { id: string; editing: boolean; fresh?: boolean };

export function Notes({ title }: { title: string }) {
  const path = usePathname();
  const { notes, ready, update } = useNotes(path);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<{ range: Range; anchor: Anchor } | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [colour, setColour] = useState<Colour>("amber");
  const [undo, setUndo] = useState<Highlight | null>(null);
  const [markers, setMarkers] = useState<{ id: string; top: number; left: number; n: number }[]>([]);

  useEffect(() => {
    const c = localStorage.getItem(LAST_COLOUR) as Colour | null;
    if (c && COLOURS.includes(c)) setColour(c);
  }, []);

  /* ── paint ──────────────────────────────────────────────────────────── */
  const placeMarkers = useCallback((list: Highlight[]) => {
    const el = root();
    if (!el) return;
    const box = el.getBoundingClientRect();
    /* Only where the gutter right of the column can hold a bubble. */
    if (window.innerWidth - box.right < 40) return setMarkers([]);
    const out: { id: string; top: number; left: number; n: number }[] = [];
    for (const h of list) {
      if (!h.note) continue;
      const m = el.querySelector<HTMLElement>(`mark.hl[data-hid="${h.id}"]`);
      if (!m) continue;
      const top = m.getBoundingClientRect().top + window.scrollY;
      /* Two notes on one line share a bubble rather than stacking on top. */
      const near = out.find((o) => Math.abs(o.top - top) < 22);
      if (near) near.n++;
      else out.push({ id: h.id, top, left: box.right + window.scrollX + 12, n: 1 });
    }
    setMarkers(out);
  }, []);

  const repaint = useCallback(
    (list: Highlight[]) => {
      const el = root();
      if (!el) return;
      el.querySelectorAll("mark.hl").forEach((m) => unwrap(m as HTMLElement));
      for (const h of list) {
        const pieces = paint(el, h, () => {
          const m = document.createElement("mark");
          m.className = `hl hl-${h.colour}${h.note ? " has-note" : ""}`;
          m.dataset.hid = h.id;
          return m;
        });
        /* A highlight crossing inline markup paints as several <mark>s. Round
           only the outer edges so the run reads as one band, not a row of pills. */
        if (pieces.length) {
          pieces[0].classList.add("hl-first");
          pieces[pieces.length - 1].classList.add("hl-last");
        }
      }
      placeMarkers(list);
    },
    [placeMarkers],
  );

  useEffect(() => {
    if (ready) repaint(notes.highlights);
  }, [ready, notes.highlights, repaint]);

  /* Images and diagrams load late and push text down; keep bubbles in line. */
  useEffect(() => {
    const el = root();
    if (!el) return;
    const ro = new ResizeObserver(() => placeMarkers(notes.highlights));
    ro.observe(el);
    return () => ro.disconnect();
  }, [notes.highlights, placeMarkers]);

  /* The open card's highlight gets a ring, so it's clear which text it's about. */
  useEffect(() => {
    root()?.querySelectorAll("mark.hl-active").forEach((m) => m.classList.remove("hl-active"));
    if (card) marksOf(card.id).forEach((m) => m.classList.add("hl-active"));
  }, [card, notes.highlights]);

  /* ── selection ──────────────────────────────────────────────────────── */
  useEffect(() => {
    let timer = 0;
    function read() {
      const s = window.getSelection();
      const el = root();
      if (!s || s.isCollapsed || !s.rangeCount || !el) return setSel(null);
      const range = s.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return setSel(null);
      const at = rangeToOffsets(el, range);
      if (!at || at.text.trim().length < 2) return setSel(null);
      closeRef.current();
      setSel({ range: range.cloneRange(), anchor: { ...at, occurrence: occurrenceAt(el, at.start, at.text) } });
    }
    /* mouseup covers the mouse; selectionchange covers touch handles and
       shift+arrow selection, which never fire a mouseup. */
    let down = false;
    function onUp(e: PointerEvent) {
      down = false;
      if ((e.target as HTMLElement)?.closest?.("[data-notes-ui]")) return;
      setTimeout(read, 0);
    }
    function onChange() {
      if (down) return;
      clearTimeout(timer);
      timer = window.setTimeout(read, 280);
    }
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement;
      if (t?.closest?.("[data-notes-ui]")) return;
      down = true;
      setSel(null);
      const mark = t?.closest?.("mark.hl") as HTMLElement | null;
      closeRef.current();
      if (mark?.dataset.hid) setCard({ id: mark.dataset.hid, editing: false });
    }
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("selectionchange", onChange);
    };
  }, []);

  /* ── mutations ──────────────────────────────────────────────────────── */
  function add(c: Colour, comment = false) {
    if (!sel) return;
    const h: Highlight = { id: uid(), colour: c, ...sel.anchor, created: Date.now() };
    update((p) => ({ ...p, highlights: [...p.highlights, h] }));
    setColour(c);
    localStorage.setItem(LAST_COLOUR, c);
    window.getSelection()?.removeAllRanges();
    setSel(null);
    if (comment) setCard({ id: h.id, editing: true, fresh: true });
  }
  function remove(id: string) {
    const h = notes.highlights.find((x) => x.id === id);
    update((p) => ({ ...p, highlights: p.highlights.filter((x) => x.id !== id) }));
    if (card?.id === id) setCard(null);
    if (h) setUndo(h);
  }
  function restore() {
    if (!undo) return;
    const h = undo;
    update((p) => ({ ...p, highlights: [...p.highlights, h] }));
    setUndo(null);
  }
  function recolour(id: string, c: Colour) {
    update((p) => ({ ...p, highlights: p.highlights.map((h) => (h.id === id ? { ...h, colour: c } : h)) }));
  }
  function setNote(id: string, note: string) {
    const text = note.trim() ? note.trim() : undefined;
    update((p) => ({
      ...p,
      highlights: p.highlights.map((h) => (h.id === id ? { ...h, note: text, edited: text ? Date.now() : undefined } : h)),
    }));
  }
  function jump(id: string) {
    const ms = marksOf(id);
    ms[0]?.scrollIntoView({ block: "center", behavior: "smooth" });
    ms.forEach((m) => m.classList.add("hl-flash"));
    setTimeout(() => ms.forEach((m) => m.classList.remove("hl-flash")), 1400);
  }

  /* A comment abandoned before it was written leaves the plain highlight
     behind only if the reader chose a colour on purpose; from "Comment" it
     goes away, the way Confluence drops an empty inline comment. */
  function closeCard() {
    if (card?.fresh) {
      const h = notes.highlights.find((x) => x.id === card.id);
      if (h && !h.note) update((p) => ({ ...p, highlights: p.highlights.filter((x) => x.id !== card.id) }));
    }
    setCard(null);
  }
  const closeRef = useRef(closeCard);
  closeRef.current = closeCard;

  /* ── keyboard ───────────────────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (sel) {
          window.getSelection()?.removeAllRanges();
          setSel(null);
        } else if (card && !card.editing) setCard(null);
        else if (open && !card) setOpen(false);
        return;
      }
      if (!sel || isField(e.target)) return;
      if (e.key === "h") {
        e.preventDefault();
        add(colour);
      } else if (e.key === "c" || e.key === "n") {
        e.preventDefault();
        add(colour, true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const selRects = useCallback(() => (sel ? Array.from(sel.range.getClientRects()) : []), [sel]);
  const cardId = card?.id;
  const cardRects = useCallback(
    () => (cardId ? marksOf(cardId).flatMap((m) => Array.from(m.getClientRects())) : []),
    [cardId],
  );

  const count = notes.highlights.length;
  const active = card && notes.highlights.find((h) => h.id === card.id);

  return (
    <>
      {/* ── the launcher, bottom right ─────────────────────────────────── */}
      <button
        data-notes-ui
        onClick={() => setOpen((o) => !o)}
        aria-label="Notes and highlights"
        className="glass glass-hover fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] text-ink"
      >
        <Highlighter className="size-4 text-accent" />
        <span className="hidden sm:inline">Notes</span>
        {count > 0 && (
          <span className="tnum grid min-w-[20px] place-items-center rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-on-accent">
            {count}
          </span>
        )}
      </button>

      {/* ── margin bubbles for highlights that carry a comment ─────────── */}
      {markers.map((m) => (
        <button
          key={m.id}
          data-notes-ui
          onClick={() => setCard({ id: m.id, editing: false })}
          aria-label="Open comment"
          className={cn(
            "notes-marker absolute z-30 flex h-6 items-center gap-0.5 rounded-md border px-1.5 text-[10.5px] font-semibold transition-colors",
            card?.id === m.id ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted hover:border-accent hover:text-accent",
          )}
          style={{ top: m.top - 2, left: m.left }}
        >
          <MessageSquareText className="size-3.5" />
          {m.n > 1 && <span className="tnum">{m.n}</span>}
        </button>
      ))}

      {/* ── selection bar ──────────────────────────────────────────────── */}
      {sel && (
        <Floating rects={selRects} prefer="above">
          <div role="toolbar" aria-label="Highlight or comment" className="notes-bar flex items-center gap-0.5 rounded-xl p-1">
            <div className="flex items-center gap-1 px-1">
              {COLOURS.map((c) => (
                <button
                  key={c}
                  onClick={() => add(c)}
                  aria-label={`Highlight ${c}`}
                  title={c === colour ? "Highlight (H)" : `Highlight ${c}`}
                  className={cn(
                    "size-[22px] rounded-full ring-inset transition-transform hover:scale-110",
                    `swatch-${c}`,
                    c === colour ? "ring-2 ring-ink/70" : "ring-1 ring-white/20",
                  )}
                />
              ))}
            </div>
            <span className="mx-1 h-5 w-px bg-line-2" />
            <BarButton onClick={() => add(colour, true)} title="Comment (C)">
              <MessageSquarePlus className="size-[15px]" /> Comment
            </BarButton>
            <CopyButton text={sel.anchor.text} compact />
          </div>
        </Floating>
      )}

      {/* ── comment card ───────────────────────────────────────────────── */}
      {card && active && (
        <Floating key={card.id} rects={cardRects} prefer="below">
          <CommentCard
            h={active}
            editing={card.editing}
            onEdit={() => setCard({ ...card, editing: true })}
            onSave={(text) => {
              setNote(active.id, text);
              setCard({ id: active.id, editing: false });
            }}
            onCancel={() => (card.fresh ? closeCard() : setCard({ ...card, editing: false }))}
            onRecolour={(c) => recolour(active.id, c)}
            onRemove={() => remove(active.id)}
            onClose={closeCard}
          />
        </Floating>
      )}

      {/* ── undo ───────────────────────────────────────────────────────── */}
      {undo && (
        <div
          data-notes-ui
          role="status"
          className="notes-toast fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line-2 bg-surface px-4 py-2.5 text-[13px] text-ink shadow-[var(--shadow)]"
        >
          {undo.note ? "Comment deleted" : "Highlight removed"}
          <button onClick={restore} className="font-semibold text-accent hover:underline">
            Undo
          </button>
        </div>
      )}

      {open && (
        <Drawer
          title={title}
          path={path}
          notes={notes}
          update={update}
          onClose={() => setOpen(false)}
          onJump={(id) => {
            if (window.innerWidth < 1024) setOpen(false);
            jump(id);
          }}
          onRemove={remove}
          onSaveNote={setNote}
        />
      )}
    </>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function CommentCard({
  h,
  editing,
  onEdit,
  onSave,
  onCancel,
  onRecolour,
  onRemove,
  onClose,
}: {
  h: Highlight;
  editing: boolean;
  onEdit: () => void;
  onSave: (text: string) => void;
  onCancel: () => void;
  onRecolour: (c: Colour) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const quote = h.text.replace(/\s+/g, " ").trim();
  return (
    <div className="notes-card w-[min(360px,calc(100vw-20px))] overflow-hidden rounded-xl">
      <div className="flex items-center gap-1 border-b border-line px-2.5 py-1.5">
        {COLOURS.map((c) => (
          <button
            key={c}
            onClick={() => onRecolour(c)}
            aria-label={`Recolour ${c}`}
            className={cn(
              "size-[18px] rounded-full ring-inset transition-transform hover:scale-110",
              `swatch-${c}`,
              h.colour === c ? "ring-2 ring-ink/70" : "ring-1 ring-white/20",
            )}
          />
        ))}
        <span className="flex-1" />
        <CopyButton text={h.text} compact />
        <IconButton onClick={onRemove} label="Delete highlight" danger>
          <Trash2 className="size-[15px]" />
        </IconButton>
        <IconButton onClick={onClose} label="Close">
          <X className="size-[15px]" />
        </IconButton>
      </div>

      <div className="px-3.5 pb-3.5 pt-3">
        <blockquote className={cn("mb-3 line-clamp-3 border-l-[3px] pl-2.5 text-[12.5px] leading-relaxed text-muted", `quote-${h.colour}`)}>
          {quote}
        </blockquote>

        {editing ? (
          <Composer initial={h.note ?? ""} onSave={onSave} onCancel={onCancel} saveLabel={h.note ? "Save" : "Comment"} />
        ) : h.note ? (
          <div className="group">
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{h.note}</p>
            <div className="mt-2 flex items-center gap-2 text-[11.5px] text-faint">
              <span>{ago(h.edited ?? h.created)}</span>
              <span>·</span>
              <button onClick={onEdit} className="flex items-center gap-1 font-medium text-muted hover:text-accent">
                <Pencil className="size-3" /> Edit
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line-2 px-3 py-2 text-left text-[13px] text-faint transition-colors hover:border-accent hover:text-accent"
          >
            <MessageSquarePlus className="size-4" /> Add a comment
          </button>
        )}
      </div>
    </div>
  );
}
