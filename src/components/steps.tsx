"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* Step-through diagrams. A reader moves one step at a time (buttons, arrow
   keys when focused, or play), and each step lights part of the picture and
   explains it in a sentence. Two shapes cover most of what a systems chapter
   needs to show moving:

     <Steps>         a pipeline: one thing travels through fixed stages
     <StepSequence>  messages between actors over time (handshakes, protocols)

   Captions take a tiny markdown subset, **bold** and `code`, so MDX authors
   can write them as plain strings. */

const LANE = ["#60a5fa", "#c084fc", "#fbbf24", "#34d399", "#f472b6", "#22d3ee", "#fb923c", "#a3e635"];

export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <b key={i} className="font-semibold text-white">{p.slice(2, -2)}</b>
        ) : p.startsWith("`") ? (
          <code key={i} className="rounded bg-white/10 px-1.5 py-px font-mono text-[12.5px] text-slate-200">{p.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function useStepper(n: number) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d))), [n]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setI((x) => {
        if (x >= n - 1) { setPlaying(false); return x; }
        return x + 1;
      });
    }, 1900);
    return () => clearInterval(t);
  }, [playing, n]);

  return { i, go, playing, setPlaying, reset: () => { setPlaying(false); setI(0); } };
}

export function Frame({
  title, hint, i, n, go, playing, setPlaying, reset, caption, children,
}: {
  title: string;
  hint?: string;
  i: number;
  n: number;
  go: (d: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  reset: () => void;
  caption: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const btn = "grid size-[34px] place-items-center rounded-[9px] border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/10 disabled:opacity-30";
  return (
    <figure
      ref={ref}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        if (e.key === " ") { e.preventDefault(); setPlaying(!playing); }
      }}
      className="not-prose my-10 overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--diagram-bg)] font-[family-name:var(--font-jakarta)] text-slate-200 shadow-[var(--shadow)] outline-none focus-visible:ring-2 focus-visible:ring-accent lg:-mx-10"
    >
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-3.5 text-[13.5px]">
        <b className="font-semibold text-white">{title}</b>
        <span className="hidden shrink-0 font-mono text-[11.5px] text-slate-400 sm:inline">{hint ?? "step through it · ← →"}</span>
      </header>
      <div className="px-5 pt-6">{children}</div>
      <div className="mx-5 mt-4 min-h-[76px] rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3.5 text-[14.5px] leading-relaxed text-slate-200" aria-live="polite">
        <b className="font-semibold text-white">Step {i + 1}.</b> <Inline text={caption} />
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-2 pt-4">
        <button className={btn} onClick={reset} aria-label="Reset"><RotateCcw className="size-3.5" /></button>
        <button className={btn} onClick={() => go(-1)} disabled={i === 0} aria-label="Previous step"><ChevronLeft className="size-4" /></button>
        <button className={btn} onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <button className={btn} onClick={() => go(1)} disabled={i === n - 1} aria-label="Next step"><ChevronRight className="size-4" /></button>
        <span className="tnum ml-2 min-w-[44px] text-center font-mono text-[12.5px] text-slate-400">{i + 1} / {n}</span>
      </div>
      <div className="flex justify-center gap-1.5 pb-5">
        {Array.from({ length: n }, (_, k) => (
          <span key={k} className={cn("h-[7px] rounded-full transition-all duration-300", k === i ? "w-5 bg-white" : "w-[7px] bg-white/20")} />
        ))}
      </div>
    </figure>
  );
}

/* ── Steps: a pipeline ───────────────────────────────────────────────── */

export function Steps({
  title, hint, lanes, steps,
}: {
  title: string;
  hint?: string;
  lanes: { t: string; s?: string; icon?: string }[];
  /** [laneIndex, caption] */
  steps: [number, string][];
}) {
  const st = useStepper(steps.length);
  const [lane, caption] = steps[st.i];
  const cols = lanes.length;

  return (
    <Frame title={title} hint={hint} caption={caption} n={steps.length} {...st}>
      <div className="relative">
        <div className="grid grid-cols-3 gap-2.5 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ ["--cols" as string]: Math.min(cols, 6) } as React.CSSProperties}>
          {lanes.map((l, k) => {
            const c = LANE[k % LANE.length];
            const on = k === lane;
            const past = k < lane;
            return (
              <div
                key={k}
                className="relative rounded-xl border px-2.5 pb-3.5 pt-3 text-center transition-all duration-500"
                style={{
                  borderColor: on ? c : past ? `${c}66` : "rgba(255,255,255,.07)",
                  background: on ? `${c}29` : "rgba(255,255,255,.035)",
                  transform: on ? "translateY(-4px)" : undefined,
                  boxShadow: on ? `0 0 0 1px ${c}, 0 12px 34px -12px ${c}` : undefined,
                }}
              >
                {on && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md bg-white px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-slate-900 shadow-[0_0_16px_2px_rgba(255,255,255,.35)]">
                    ●
                  </span>
                )}
                <div className="mx-auto mb-2 grid size-[34px] place-items-center rounded-[10px] text-[16px]" style={{ background: `${c}38` }}>
                  {l.icon ?? k + 1}
                </div>
                <div className="text-[12.5px] font-semibold leading-tight text-white">{l.t}</div>
                {l.s && <div className="mt-1 text-[11px] leading-snug text-slate-400">{l.s}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

/* ── StepSequence: messages between actors ──────────────────────────── */

export function StepSequence({
  title, hint, actors, messages,
}: {
  title: string;
  hint?: string;
  actors: string[];
  /** from/to are actor indexes; note is the step's caption */
  messages: { from: number; to: number; label: string; note: string; dashed?: boolean }[];
}) {
  const st = useStepper(messages.length);
  const W = 640, colW = W / actors.length, rowH = 44, top = 58;
  const x = (a: number) => colW * a + colW / 2;
  const H = top + messages.length * rowH + 18;

  return (
    <Frame title={title} hint={hint} caption={messages[st.i].note} n={messages.length} {...st}>
      <div className="-mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[680px]" style={{ minWidth: Math.max(actors.length * 128, 320) }} role="img" aria-label={title}>
        <defs>
          <marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#e2e8f0" />
          </marker>
          <marker id="seq-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#38bdf8" />
          </marker>
        </defs>
        {actors.map((a, k) => (
          <g key={a}>
            <rect x={x(k) - 58} y={4} width={116} height={34} rx={9} fill={`${LANE[k % LANE.length]}33`} stroke={LANE[k % LANE.length]} strokeWidth={1.2} />
            <text x={x(k)} y={26} textAnchor="middle" fill="#fff" fontSize={13.5} fontWeight={600}>{a}</text>
            <line x1={x(k)} y1={40} x2={x(k)} y2={H - 6} stroke="rgba(255,255,255,.14)" strokeDasharray="3 5" />
          </g>
        ))}
        {messages.map((m, k) => {
          const y = top + k * rowH + 20;
          const shown = k <= st.i;
          const on = k === st.i;
          const self = m.from === m.to;
          return (
            <g key={k} style={{ opacity: shown ? 1 : 0.08, transition: "opacity .45s" }}>
              {self ? (
                <path d={`M${x(m.from)} ${y - 8} h36 v16 h-36`} fill="none" stroke={on ? "#38bdf8" : "#e2e8f0"} strokeWidth={on ? 2.4 : 1.6} markerEnd={`url(#${on ? "seq-arrow-on" : "seq-arrow"})`} />
              ) : (
                <line
                  x1={x(m.from)} y1={y} x2={x(m.to) + (m.to > m.from ? -4 : 4)} y2={y}
                  stroke={on ? "#38bdf8" : "#e2e8f0"} strokeWidth={on ? 2.4 : 1.6}
                  strokeDasharray={m.dashed ? "6 5" : undefined}
                  markerEnd={`url(#${on ? "seq-arrow-on" : "seq-arrow"})`}
                />
              )}
              <text
                x={self ? x(m.from) + 44 : (x(m.from) + x(m.to)) / 2}
                y={y - 8}
                textAnchor={self ? "start" : "middle"}
                fill={on ? "#fff" : "#cbd5e1"}
                fontSize={12.5}
                fontWeight={on ? 700 : 500}
                fontFamily="var(--font-jetbrains), monospace"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </Frame>
  );
}
