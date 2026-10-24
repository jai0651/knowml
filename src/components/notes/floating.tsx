"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* The top nav is sticky and 64px tall; a popover tucked under it is invisible. */
const TOP = 72;
const EDGE = 10;
const GAP = 10;

interface Pos {
  left: number;
  top: number;
  side: "above" | "below";
  arrow: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   A popover pinned to a piece of text. The old toolbar took one
   getBoundingClientRect() when it opened and stayed at those viewport
   coordinates, so scrolling slid the text away from it. This re-measures on
   every scroll and resize, flips to the other side when there is no room, and
   centres on the first line (above) or the last line (below) of a multi-line
   selection rather than on the bounding box of the whole thing.
   ────────────────────────────────────────────────────────────────────────── */

export function Floating({
  rects,
  prefer = "above",
  className,
  children,
}: {
  /** client rects of the anchored text, in document order */
  rects: () => DOMRect[];
  prefer?: "above" | "below";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const el = ref.current;
      const rs = rects().filter((r) => r.width > 0 || r.height > 0);
      if (!el || !rs.length) return setPos(null);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const first = rs[0];
      const last = rs[rs.length - 1];

      const fitsAbove = first.top - h - GAP >= TOP;
      const fitsBelow = last.bottom + h + GAP <= vh - EDGE;
      const side = prefer === "above" ? (fitsAbove || !fitsBelow ? "above" : "below") : fitsBelow || !fitsAbove ? "below" : "above";
      const r = side === "above" ? first : last;
      const cx = r.left + r.width / 2;
      const left = Math.min(Math.max(cx - w / 2, EDGE), vw - w - EDGE);
      const top = side === "above" ? first.top - h - GAP : last.bottom + GAP;
      setPos({ left, top, side, arrow: Math.min(Math.max(cx - left, 14), w - 14) });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [rects, prefer]);

  return (
    <div
      ref={ref}
      data-notes-ui
      className={cn("notes-pop fixed z-[60]", className)}
      data-side={pos?.side}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        /* Not visibility:hidden: the composer focuses its textarea on mount,
           and a hidden element can't take focus. */
        opacity: pos ? 1 : 0,
        pointerEvents: pos ? undefined : "none",
        ["--arrow-x" as string]: `${pos?.arrow ?? 0}px`,
      }}
    >
      {children}
    </div>
  );
}
