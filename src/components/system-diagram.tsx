"use client";

import { useMemo } from "react";
import {
  Archive, Boxes, Cloud, Cpu, Database, Globe, KeyRound, Laptop, ListOrdered,
  Network, Server, Smartphone, Users, Zap,
} from "lucide-react";
import { Frame, useStepper } from "./steps";

/* ── SystemDiagram: an architecture drawing, optionally animated ─────────
   Nodes are the parts of a system, each drawn by kind (a database is a
   cylinder, a queue is a striped box, a fleet of servers is a stack), placed
   on a grid and grouped into dashed zones (tiers, data centres). Edges are
   the connections between them.

   With `steps`, the diagram becomes a step-through: each step names a path
   through the nodes, the path lights up, and a dot travels along it while
   the caption explains the hop. Without `steps` it's a static figure. */

type Kind =
  | "phone" | "laptop" | "client" | "lb" | "service" | "db" | "cache" | "queue"
  | "blob" | "cdn" | "external" | "registry" | "keys" | "users" | "compute";

export interface SysNode {
  id: string;
  label: string;
  sub?: string;
  kind: Kind;
  col: number;
  row: number;
  /** draw as a fleet: "×150" */
  count?: string;
}

export interface SysEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  /** arrowheads at both ends */
  both?: boolean;
}

export interface SysStep {
  caption: string;
  /** node ids the request travels through, in order */
  path?: string[];
  /** label shown on the moving dot's path */
  label?: string;
  /** extra nodes to highlight */
  focus?: string[];
}

const ICON: Record<Kind, typeof Server> = {
  phone: Smartphone, laptop: Laptop, client: Globe, lb: Network, service: Server, db: Database,
  cache: Zap, queue: ListOrdered, blob: Archive, cdn: Cloud, external: Cloud, registry: Boxes,
  keys: KeyRound, users: Users, compute: Cpu,
};

const HUE: Record<Kind, string> = {
  phone: "#a78bfa", laptop: "#a78bfa", client: "#a78bfa", users: "#a78bfa",
  lb: "#22d3ee", cdn: "#22d3ee",
  service: "#60a5fa", compute: "#60a5fa", registry: "#60a5fa",
  db: "#34d399", blob: "#34d399", keys: "#34d399",
  cache: "#fbbf24", queue: "#f472b6", external: "#94a3b8",
};

const W = 940, PAD = 18, NW = 140, NH = 58, ROWH = 116, ZPAD = 12;

function clip(cx: number, cy: number, dx: number, dy: number, w: number, h: number) {
  // point where the ray from (cx,cy) along (dx,dy) leaves a w×h box centred there
  const tx = dx === 0 ? Infinity : (w / 2) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (h / 2) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

function Shape({ kind, x, y, w, h, stroke, fill }: { kind: Kind; x: number; y: number; w: number; h: number; stroke: string; fill: string }) {
  const sw = 1.4;
  if (kind === "db" || kind === "keys") {
    const ry = 7;
    return (
      <g>
        <path d={`M${x} ${y + ry} v${h - 2 * ry} a${w / 2} ${ry} 0 0 0 ${w} 0 v${-(h - 2 * ry)}`} fill={fill} stroke={stroke} strokeWidth={sw} />
        <ellipse cx={x + w / 2} cy={y + ry} rx={w / 2} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw} />
      </g>
    );
  }
  if (kind === "queue") {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />
        {[0.62, 0.72, 0.82].map((f) => (
          <line key={f} x1={x + w * f} y1={y + 8} x2={x + w * f} y2={y + h - 8} stroke={stroke} strokeOpacity={0.5} strokeWidth={4} />
        ))}
      </g>
    );
  }
  if (kind === "external" || kind === "cdn") {
    return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={kind === "external" ? "5 4" : undefined} />;
  }
  if (kind === "lb") {
    const c = 14;
    return <path d={`M${x + c} ${y} H${x + w - c} L${x + w} ${y + h / 2} L${x + w - c} ${y + h} H${x + c} L${x} ${y + h / 2} Z`} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
  return <rect x={x} y={y} width={w} height={h} rx={kind === "phone" || kind === "laptop" || kind === "client" || kind === "users" ? 14 : 9} fill={fill} stroke={stroke} strokeWidth={sw} />;
}

export function SystemDiagram({
  title, hint, nodes, edges = [], zones = [], steps, caption,
}: {
  title: string;
  hint?: string;
  nodes: SysNode[];
  edges?: SysEdge[];
  zones?: { label: string; nodes: string[] }[];
  steps?: SysStep[];
  /** caption for a static diagram */
  caption?: string;
}) {
  const st = useStepper(steps?.length ?? 1);
  const step = steps?.[st.i];

  const geo = useMemo(() => {
    const cols = Math.max(...nodes.map((n) => n.col)) + 1;
    const rows = Math.max(...nodes.map((n) => n.row)) + 1;
    const cw = (W - 2 * PAD) / cols;
    const top = PAD + (zones.length ? 22 : 0);
    const pos: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) pos[n.id] = { x: PAD + (n.col + 0.5) * cw, y: top + (n.row + 0.5) * ROWH };
    const H = top + rows * ROWH + PAD;
    return { pos, H };
  }, [nodes, zones.length]);

  const seg = (a: string, b: string) => {
    const A = geo.pos[a], B = geo.pos[b];
    if (!A || !B) return null;
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const s = clip(A.x, A.y, ux, uy, NW + 10, NH + 10);
    const e = clip(B.x, B.y, -ux, -uy, NW + 12, NH + 12);
    return { s, e };
  };

  const onPath = new Set<string>();
  const pathPairs: [string, string][] = [];
  if (step?.path) {
    step.path.forEach((p) => onPath.add(p));
    for (let k = 0; k + 1 < step.path.length; k++) pathPairs.push([step.path[k], step.path[k + 1]]);
  }
  for (const f of step?.focus ?? []) onPath.add(f);
  const edgeOn = (e: SysEdge) => pathPairs.some(([a, b]) => (a === e.from && b === e.to) || (a === e.to && b === e.from));

  // The moving dot's route: through every hop of the path.
  let motion = "";
  if (pathPairs.length) {
    const pts: string[] = [];
    pathPairs.forEach(([a, b], k) => {
      const sgm = seg(a, b);
      if (!sgm) return;
      pts.push(`${k === 0 ? "M" : "L"}${sgm.s.x.toFixed(1)} ${sgm.s.y.toFixed(1)} L${sgm.e.x.toFixed(1)} ${sgm.e.y.toFixed(1)}`);
    });
    motion = pts.join(" ");
  }
  const extra = pathPairs.filter(([a, b]) => !edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)));

  const svg = (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <svg viewBox={`0 0 ${W} ${geo.H}`} className="mx-auto block w-full" style={{ minWidth: 700 }} role="img" aria-label={title}>
        <defs>
          <marker id="sd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
          </marker>
          <marker id="sd-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#38bdf8" />
          </marker>
        </defs>

        {zones.map((z) => {
          const ps = z.nodes.map((id) => geo.pos[id]).filter(Boolean);
          if (!ps.length) return null;
          const x0 = Math.min(...ps.map((p) => p.x)) - NW / 2 - ZPAD, x1 = Math.max(...ps.map((p) => p.x)) + NW / 2 + ZPAD;
          const y0 = Math.min(...ps.map((p) => p.y)) - NH / 2 - ZPAD - 16, y1 = Math.max(...ps.map((p) => p.y)) + NH / 2 + ZPAD;
          return (
            <g key={z.label}>
              <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={14} fill="rgba(255,255,255,.018)" stroke="rgba(148,163,184,.35)" strokeDasharray="6 5" />
              <text x={x0 + 12} y={y0 + 16} fill="#94a3b8" fontSize={10.5} fontWeight={700} letterSpacing="0.08em">{z.label.toUpperCase()}</text>
            </g>
          );
        })}

        {edges.map((e, k) => {
          const sgm = seg(e.from, e.to);
          if (!sgm) return null;
          const on = edgeOn(e);
          const mx = (sgm.s.x + sgm.e.x) / 2, my = (sgm.s.y + sgm.e.y) / 2;
          return (
            <g key={k} style={{ transition: "opacity .4s" }} opacity={step?.path && !on ? 0.45 : 1}>
              <line
                x1={sgm.s.x} y1={sgm.s.y} x2={sgm.e.x} y2={sgm.e.y}
                stroke={on ? "#38bdf8" : "#64748b"} strokeWidth={on ? 2.4 : 1.4}
                strokeDasharray={e.dashed ? "5 5" : undefined}
                markerEnd={`url(#${on ? "sd-arrow-on" : "sd-arrow"})`}
                markerStart={e.both ? `url(#${on ? "sd-arrow-on" : "sd-arrow"})` : undefined}
              />
              {e.label && (
                <g>
                  <rect x={mx - e.label.length * 3.6 - 6} y={my - 10} width={e.label.length * 7.2 + 12} height={20} rx={5} fill="var(--diagram-bg, #0b1220)" opacity={0.92} />
                  <text x={mx} y={my + 4} textAnchor="middle" fill={on ? "#e0f2fe" : "#94a3b8"} fontSize={11.5} fontFamily="var(--font-jetbrains), monospace">{e.label}</text>
                </g>
              )}
            </g>
          );
        })}

        {extra.map(([a, b], k) => {
          const sgm = seg(a, b);
          if (!sgm) return null;
          return <line key={`x${k}`} x1={sgm.s.x} y1={sgm.s.y} x2={sgm.e.x} y2={sgm.e.y} stroke="#38bdf8" strokeWidth={2.2} strokeDasharray="6 5" markerEnd="url(#sd-arrow-on)" />;
        })}

        {nodes.map((n) => {
          const p = geo.pos[n.id];
          const hue = HUE[n.kind];
          const on = onPath.has(n.id);
          const Icon = ICON[n.kind];
          const x = p.x - NW / 2, y = p.y - NH / 2;
          const fill = on ? `${hue}30` : `${hue}14`;
          const stroke = on ? "#38bdf8" : `${hue}aa`;
          return (
            <g key={n.id} style={{ transition: "opacity .4s" }} opacity={step?.path && !on ? 0.55 : 1}>
              {n.count && (
                <>
                  <rect x={x + 8} y={y - 8} width={NW} height={NH} rx={9} fill={`${hue}0c`} stroke={`${hue}55`} />
                  <rect x={x + 4} y={y - 4} width={NW} height={NH} rx={9} fill={`${hue}10`} stroke={`${hue}77`} />
                </>
              )}
              <Shape kind={n.kind} x={x} y={y} w={NW} h={NH} stroke={stroke} fill={fill} />
              <Icon x={x + 10} y={p.y - (n.sub ? 16 : 9)} width={17} height={17} color={hue} strokeWidth={2} />
              <text x={x + 32} y={n.sub ? p.y - 2 : p.y + 4.5} fill="#f1f5f9" fontSize={14} fontWeight={650}>{n.label}</text>
              {n.sub && <text x={x + 32} y={p.y + 14} fill="#94a3b8" fontSize={11.5}>{n.sub}</text>}
              {n.count && (
                <text x={x + NW - 6} y={y + 13} textAnchor="end" fill={hue} fontSize={10.5} fontWeight={700} fontFamily="var(--font-jetbrains), monospace">{n.count}</text>
              )}
            </g>
          );
        })}

        {motion && (
          <g key={`dot-${st.i}`}>
            <circle r={6.5} fill="#38bdf8" opacity={0.25}>
              <animateMotion dur={`${Math.max(1.2, pathPairs.length * 0.9)}s`} repeatCount="indefinite" path={motion} />
            </circle>
            <circle r={4} fill="#e0f2fe" stroke="#38bdf8" strokeWidth={2}>
              <animateMotion dur={`${Math.max(1.2, pathPairs.length * 0.9)}s`} repeatCount="indefinite" path={motion} />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );

  if (!steps?.length) {
    return (
      <figure className="not-prose my-10 overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--diagram-bg)] font-[family-name:var(--font-jakarta)] text-slate-200 shadow-[var(--shadow)] lg:-mx-10">
        <header className="border-b border-white/[0.08] px-5 py-3.5 text-[13.5px]"><b className="font-semibold text-white">{title}</b></header>
        <div className="px-5 py-5">{svg}</div>
        {caption && <figcaption className="border-t border-white/[0.07] px-5 py-3.5 text-[14px] leading-relaxed text-slate-300">{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <Frame title={title} hint={hint} caption={step!.caption} n={steps.length} {...st}>
      {svg}
    </Frame>
  );
}

