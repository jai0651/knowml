"use client";

import { Fragment, useMemo } from "react";
import { Frame, useStepper } from "./steps";

/* ── Scene: the state of a system, animated step by step ────────────────
   A Scene draws the places where things live (regions: your program, the
   page cache, the disk, a server, a queue) and the things themselves (items:
   pages, blocks, requests, messages, rows). Each step says where every item
   is and what state it's in, and items glide from region to region between
   steps. The reader sees the system's state change and not just a label
   light up.

   Every frame either lists all its items (`items`), or describes changes
   from the previous frame (`add`, `change`, `remove`). An item keeps its
   identity through `id`, which is what makes it move instead of vanish and
   reappear. */

type Tone = "default" | "accent" | "new" | "dirty" | "ok" | "bad" | "dim";

export interface SceneRegion {
  id: string;
  label: string;
  /** small grey text under the label: "RAM", "~45 µs per read" */
  sub?: string;
  col: number;
  row: number;
  /** number of columns the region spans (default 1) */
  span?: number;
}

export interface SceneItem {
  id: string;
  /** region id */
  at: string;
  label: string;
  sub?: string;
  tone?: Tone;
}

export interface SceneFrame {
  caption: string;
  items?: SceneItem[];
  add?: SceneItem[];
  change?: (Partial<SceneItem> & { id: string })[];
  remove?: string[];
  /** region ids to highlight in this step */
  focus?: string[];
  /** an arrow between two regions, for a request or a copy in flight */
  arrow?: { from: string; to: string; label?: string };
}

const TONE: Record<Tone, { fill: string; stroke: string; text: string }> = {
  default: { fill: "rgba(148,163,184,.14)", stroke: "rgba(203,213,225,.45)", text: "#e2e8f0" },
  accent:  { fill: "rgba(56,189,248,.20)",  stroke: "#38bdf8", text: "#e0f2fe" },
  new:     { fill: "rgba(192,132,252,.22)", stroke: "#c084fc", text: "#f3e8ff" },
  dirty:   { fill: "rgba(251,191,36,.22)",  stroke: "#fbbf24", text: "#fef3c7" },
  ok:      { fill: "rgba(52,211,153,.20)",  stroke: "#34d399", text: "#d1fae5" },
  bad:     { fill: "rgba(251,113,133,.22)", stroke: "#fb7185", text: "#ffe4e6" },
  dim:     { fill: "rgba(148,163,184,.05)", stroke: "rgba(148,163,184,.25)", text: "#64748b" },
};

const W = 720, PAD = 12, GAP = 16, RGAP = 46, HEAD = 40, IGAP = 8, INSET = 12;

function resolveFrames(frames: SceneFrame[]): SceneItem[][] {
  const out: SceneItem[][] = [];
  let cur: SceneItem[] = [];
  for (const f of frames) {
    let next = f.items ? f.items.map((x) => ({ ...x })) : cur.map((x) => ({ ...x }));
    if (f.remove) next = next.filter((x) => !f.remove!.includes(x.id));
    if (f.change) for (const c of f.change) next = next.map((x) => (x.id === c.id ? { ...x, ...c } : x));
    if (f.add) next = [...next.filter((x) => !f.add!.some((a) => a.id === x.id)), ...f.add.map((x) => ({ ...x }))];
    out.push(next);
    cur = next;
  }
  return out;
}

export function Scene({
  title, hint, regions, frames, itemWidth = 96,
}: {
  title: string;
  hint?: string;
  regions: SceneRegion[];
  frames: SceneFrame[];
  itemWidth?: number;
}) {
  const st = useStepper(frames.length);
  const states = useMemo(() => resolveFrames(frames), [frames]);
  const hasSub = useMemo(() => states.some((s) => s.some((x) => x.sub)), [states]);
  const IW = itemWidth, IH = hasSub ? 44 : 32;

  const layout = useMemo(() => {
    const cols = Math.max(...regions.map((r) => r.col + (r.span ?? 1)));
    const colW = (W - 2 * PAD - (cols - 1) * GAP) / cols;
    const box: Record<string, { x: number; y: number; w: number; h: number; cap: number }> = {};
    const rows = Math.max(...regions.map((r) => r.row)) + 1;
    const rowH: number[] = Array(rows).fill(0);
    for (const r of regions) {
      const w = (r.span ?? 1) * colW + ((r.span ?? 1) - 1) * GAP;
      const cap = Math.max(1, Math.floor((w - 2 * INSET + IGAP) / (IW + IGAP)));
      const most = Math.max(1, ...states.map((s) => s.filter((x) => x.at === r.id).length));
      const lines = Math.ceil(most / cap);
      const h = HEAD + lines * (IH + IGAP) - IGAP + INSET;
      rowH[r.row] = Math.max(rowH[r.row], h);
      box[r.id] = { x: PAD + r.col * (colW + GAP), y: 0, w, h, cap };
    }
    const rowY: number[] = [];
    let y = PAD;
    for (let k = 0; k < rows; k++) { rowY.push(y); y += rowH[k] + RGAP; }
    for (const r of regions) { box[r.id].y = rowY[r.row]; box[r.id].h = rowH[r.row]; }
    return { box, H: y - RGAP + PAD + 44 };
  }, [regions, states, IW, IH]);

  // Where every item sits in every frame (null when absent).
  const ids = useMemo(() => {
    const seen: string[] = [];
    for (const s of states) for (const x of s) if (!seen.includes(x.id)) seen.push(x.id);
    return seen;
  }, [states]);

  const place = (frame: number, id: string) => {
    const s = states[frame];
    const it = s.find((x) => x.id === id);
    if (!it) return null;
    const b = layout.box[it.at];
    if (!b) return null;
    const k = s.filter((x) => x.at === it.at).findIndex((x) => x.id === id);
    const lineW = Math.min(b.cap, s.filter((x) => x.at === it.at).length) * (IW + IGAP) - IGAP;
    const x0 = b.x + (b.w - lineW) / 2;
    return {
      it,
      x: x0 + (k % b.cap) * (IW + IGAP),
      y: b.y + HEAD + Math.floor(k / b.cap) * (IH + IGAP),
    };
  };

  const f = frames[st.i];
  const focus = new Set(f.focus ?? []);

  let arrow: { d: string; lx: number; ly: number; label?: string } | null = null;
  if (f.arrow && layout.box[f.arrow.from] && layout.box[f.arrow.to]) {
    const a = layout.box[f.arrow.from], b = layout.box[f.arrow.to];
    const sameRow = Math.abs(a.y - b.y) < 1;
    if (sameRow) {
      // Dip below the row, so the label sits in the gap under the boxes
      // and never covers a region's header or its items.
      const right = b.x > a.x;
      const sx = a.x + a.w * (right ? 0.72 : 0.28), ex = b.x + b.w * (right ? 0.28 : 0.72);
      const sy = a.y + a.h, ey = b.y + b.h, mx = (sx + ex) / 2;
      arrow = { d: `M${sx} ${sy} C${sx} ${sy + 40} ${ex} ${ey + 40} ${ex} ${ey + 2}`, lx: mx, ly: sy + 30, label: f.arrow.label };
    } else {
      const down = b.y > a.y;
      const sx = a.x + a.w / 2, sy = down ? a.y + a.h : a.y;
      const ex = b.x + b.w / 2, ey = down ? b.y : b.y + b.h;
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      arrow = { d: `M${sx} ${sy} C${sx} ${my} ${ex} ${my} ${ex} ${ey}`, lx: mx, ly: my, label: f.arrow.label };
    }
  }

  return (
    <Frame title={title} hint={hint} caption={f.caption} n={frames.length} {...st}>
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <svg viewBox={`0 0 ${W} ${layout.H}`} className="mx-auto block w-full" style={{ minWidth: 540 }} role="img" aria-label={title}>
          <defs>
            <marker id="scene-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#38bdf8" />
            </marker>
          </defs>

          {regions.map((r) => {
            const b = layout.box[r.id];
            const on = focus.has(r.id);
            return (
              <g key={r.id}>
                <rect
                  x={b.x} y={b.y} width={b.w} height={b.h} rx={12}
                  fill={on ? "rgba(56,189,248,.07)" : "rgba(255,255,255,.025)"}
                  stroke={on ? "#38bdf8" : "rgba(255,255,255,.10)"}
                  strokeWidth={on ? 1.6 : 1}
                  style={{ transition: "fill .4s, stroke .4s" }}
                />
                <text x={b.x + 14} y={b.y + 22} fill={on ? "#fff" : "#cbd5e1"} fontSize={13} fontWeight={650} style={{ transition: "fill .4s" }}>
                  {r.label}
                </text>
                {r.sub && (
                  <text x={b.x + b.w - 14} y={b.y + 22} textAnchor="end" fill="#94a3b8" fontSize={11} fontFamily="var(--font-jetbrains), monospace">
                    {r.sub}
                  </text>
                )}
              </g>
            );
          })}

          {ids.map((id) => {
            const now = place(st.i, id);
            // An absent item fades out where it was last seen (or will first appear).
            let p = now;
            if (!p) for (let k = st.i - 1; k >= 0 && !p; k--) p = place(k, id);
            if (!p) for (let k = st.i + 1; k < frames.length && !p; k++) p = place(k, id);
            if (!p) return null;
            const t = TONE[p.it.tone ?? "default"];
            return (
              <g
                key={id}
                style={{
                  transform: `translate(${p.x}px, ${p.y}px)`,
                  opacity: now ? 1 : 0,
                  transition: "transform .7s cubic-bezier(.2,.75,.25,1), opacity .45s",
                }}
              >
                <rect
                  width={IW} height={IH} rx={8}
                  fill={t.fill} stroke={t.stroke} strokeWidth={1.3}
                  style={{ transition: "fill .45s, stroke .45s" }}
                />
                <text
                  x={IW / 2} y={p.it.sub ? 19 : IH / 2 + 4.5} textAnchor="middle"
                  fill={t.text} fontSize={12} fontWeight={600}
                  fontFamily="var(--font-jetbrains), monospace"
                  style={{ transition: "fill .45s" }}
                >
                  {p.it.label}
                </text>
                {p.it.sub && (
                  <text x={IW / 2} y={34} textAnchor="middle" fill="#94a3b8" fontSize={10.5}>
                    {p.it.sub}
                  </text>
                )}
              </g>
            );
          })}

          {arrow && (
            <g key={`${st.i}-arrow`} className="scene-arrow">
              <path d={arrow.d} fill="none" stroke="#38bdf8" strokeWidth={2.2} strokeDasharray="7 6" markerEnd="url(#scene-arrow)">
                <animate attributeName="stroke-dashoffset" from="26" to="0" dur="0.9s" repeatCount="indefinite" />
              </path>
              {arrow.label && (
                <Fragment>
                  <rect x={arrow.lx - arrow.label.length * 3.7 - 8} y={arrow.ly - 11} width={arrow.label.length * 7.4 + 16} height={22} rx={6} fill="#0b1220" stroke="#38bdf8" strokeWidth={1} />
                  <text x={arrow.lx} y={arrow.ly + 4} textAnchor="middle" fill="#e0f2fe" fontSize={11.5} fontWeight={600} fontFamily="var(--font-jetbrains), monospace">
                    {arrow.label}
                  </text>
                </Fragment>
              )}
            </g>
          )}
        </svg>
      </div>
    </Frame>
  );
}
