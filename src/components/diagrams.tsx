import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   Diagram primitives.

   Four shapes cover most of what a systems chapter needs to draw: a layout of
   bytes, a path something takes, a conversation between machines, and a tree.
   Building them as components rather than as one-off SVGs means they share a
   visual language, they theme with the palette (every colour is a CSS var, so
   all four palettes work with no per-diagram effort), and a fix to the arrow
   heads is a fix everywhere.

   All of these are server components. No canvas, no layout library, no
   client JS — a diagram is path data, and path data is cheap.
   ────────────────────────────────────────────────────────────────────────── */


/** Push a set of desired label positions apart until none overlap, then clamp
 *  back inside the frame. Two sweeps: left-to-right pushing right, then
 *  right-to-left pulling back. Without this, any diagram with narrow fields
 *  stacks its annotations on top of each other and becomes unreadable. */
function spread(desired: { x: number; w: number }[], min: number, max: number) {
  const idx = desired.map((d, i) => i).sort((a, b) => desired[a].x - desired[b].x);
  const out = desired.map((d) => d.x);

  let edge = min;
  for (const i of idx) {
    const half = desired[i].w / 2;
    out[i] = Math.max(out[i], edge + half);
    edge = out[i] + half + 10;
  }
  edge = max;
  for (const i of [...idx].reverse()) {
    const half = desired[i].w / 2;
    out[i] = Math.min(out[i], edge - half);
    edge = out[i] - half - 10;
  }
  return out;
}

/** Monospace at a given size is predictable enough to measure without a DOM. */
const textW = (s: string, size: number) => s.length * size * 0.6;

function Defs() {
  return (
    <defs>
      <marker id="kd-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
        <path d="M0 1 L8 4.5 L0 8" fill="none" stroke="var(--faint)" strokeWidth="1.3"
          strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      <marker id="kd-arrow-a" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
        <path d="M0 1 L8 4.5 L0 8" fill="none" stroke="var(--accent)" strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>
  );
}

function Svg({
  vw, vh, className, children,
}: {
  vw: number;
  vh: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      className={cn("w-full", className)}
      style={{ fontFamily: "var(--font-jetbrains), ui-monospace, monospace" }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
    >
      <Defs />
      {children}
    </svg>
  );
}

/* ══ MemoryLayout ═════════════════════════════════════════════════════════
   A struct, a page header, a packet — anything whose meaning is "these bits
   sit next to those bits". Widths are proportional to the real field sizes,
   which is the whole point: a 4-bit field should look like a 4-bit field. */

export interface LayoutField {
  name: string;
  bits: number;
  note?: string;
  accent?: boolean;
  dim?: boolean;
}

export function MemoryLayout({
  fields, caption, unit = "bits",
}: {
  fields: LayoutField[];
  caption?: string;
  unit?: "bits" | "bytes";
}) {
  const W = 900;
  const BAR_Y = 58;
  const BAR_H = 52;
  const total = fields.reduce((a, f) => a + f.bits, 0);

  let x = 0;
  const placed = fields.map((f) => {
    const w = (f.bits / total) * W;
    const seg = { ...f, x, w, cx: x + w / 2 };
    x += w;
    return seg;
  });

  const NOTE_SIZE = 10.5;
  const NAME_SIZE = 10.5;

  // Fields too narrow to hold their own name get it placed above, spread out.
  const narrow = placed.filter((f) => f.w <= 60);
  const narrowX = spread(
    narrow.map((f) => ({ x: f.cx, w: textW(`${f.name} ${f.bits}b`, NAME_SIZE) })),
    2, W - 2,
  );

  const noted = placed.filter((f) => f.note);
  // Two tiers, alternating, so dense annotations have somewhere to go.
  const tierA = noted.filter((_, i) => i % 2 === 0);
  const tierB = noted.filter((_, i) => i % 2 === 1);
  const tierAX = spread(tierA.map((f) => ({ x: f.cx, w: textW(f.note!, NOTE_SIZE) })), 4, W - 4);
  const tierBX = spread(tierB.map((f) => ({ x: f.cx, w: textW(f.note!, NOTE_SIZE) })), 4, W - 4);

  const NOTE_Y_A = BAR_Y + BAR_H + 30;
  const NOTE_Y_B = BAR_Y + BAR_H + 56;
  const H = (tierB.length ? NOTE_Y_B : tierA.length ? NOTE_Y_A : BAR_Y + BAR_H) + (caption ? 26 : 12);

  function leader(fromX: number, toX: number, toY: number, key: string) {
    const bend = BAR_Y + BAR_H + 11;
    return (
      <path
        key={key}
        d={`M${fromX} ${BAR_Y + BAR_H} L${fromX} ${bend} L${toX} ${bend} L${toX} ${toY - 10}`}
        stroke="var(--line-2)" strokeWidth="1" fill="none"
      />
    );
  }

  return (
    <Svg vw={W} vh={H}>
      {/* offset ruler */}
      {placed.map((f, i) => (
        <text key={`o${i}`} x={f.x} y={30} fill="var(--faint)" fontSize="10">
          {unit === "bits" ? f.bits && placed.slice(0, i).reduce((a, p) => a + p.bits, 0) : placed.slice(0, i).reduce((a, p) => a + p.bits, 0) / 8}
        </text>
      ))}
      <text x={W} y={30} textAnchor="end" fill="var(--faint)" fontSize="10">
        {unit === "bits" ? total : total / 8}
      </text>

      {placed.map((f, i) => {
        const wide = f.w > 60;
        return (
          <g key={i}>
            <rect
              x={f.x + 1} y={BAR_Y} width={Math.max(f.w - 2, 3)} height={BAR_H} rx="6"
              fill={f.accent ? "var(--accent-soft)" : f.dim ? "transparent" : "var(--surface-2)"}
              stroke={f.accent ? "var(--accent)" : "var(--line-2)"}
              strokeWidth={f.accent ? 1.7 : 1}
              strokeDasharray={f.dim ? "4 3" : undefined}
            />
            {wide && (
              <>
                <text x={f.cx} y={BAR_Y + 24} textAnchor="middle"
                  fill={f.accent ? "var(--accent)" : "var(--ink)"} fontSize="12.5" fontWeight="600">
                  {f.name}
                </text>
                <text x={f.cx} y={BAR_Y + 40} textAnchor="middle" fill="var(--faint)" fontSize="10.5">
                  {f.bits}b
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* names for fields too narrow to hold them, above the bar */}
      {narrow.map((f, i) => (
        <g key={`nm${i}`}>
          <line x1={f.cx} y1={BAR_Y - 4} x2={narrowX[i]} y2={BAR_Y - 13}
            stroke="var(--line-2)" strokeWidth="1" />
          <text x={narrowX[i]} y={BAR_Y - 17} textAnchor="middle"
            fill={f.accent ? "var(--accent)" : "var(--muted)"} fontSize={NAME_SIZE}>
            {f.name} <tspan fill="var(--faint)">{f.bits}b</tspan>
          </text>
        </g>
      ))}

      {tierA.map((f, i) => (
        <g key={`ta${i}`}>
          {leader(f.cx, tierAX[i], NOTE_Y_A, `la${i}`)}
          <text x={tierAX[i]} y={NOTE_Y_A} textAnchor="middle" fill="var(--muted)" fontSize={NOTE_SIZE}>
            {f.note}
          </text>
        </g>
      ))}
      {tierB.map((f, i) => (
        <g key={`tb${i}`}>
          {leader(f.cx, tierBX[i], NOTE_Y_B, `lb${i}`)}
          <line x1={tierBX[i]} y1={NOTE_Y_A + 4} x2={tierBX[i]} y2={NOTE_Y_B - 10}
            stroke="var(--line-2)" strokeWidth="1" />
          <text x={tierBX[i]} y={NOTE_Y_B} textAnchor="middle" fill="var(--muted)" fontSize={NOTE_SIZE}>
            {f.note}
          </text>
        </g>
      ))}

      {caption && <text x={0} y={H - 4} fill="var(--faint)" fontSize="11">{caption}</text>}
    </Svg>
  );
}

/* ══ Flow ═════════════════════════════════════════════════════════════════
   A path through stages. Optionally with a return edge, which is how you draw
   an event loop without it looking like a flowchart from 1998. */

export interface FlowStep {
  label: string;
  sub?: string;
  accent?: boolean;
}

export function Flow({
  steps, loop, wrap = 4,
}: {
  steps: FlowStep[];
  loop?: string;
  wrap?: number;
}) {
  const BH = 58;
  const GAP = 40;
  const ROW_GAP = 74;
  const LEFT = loop ? 26 : 0;          // gutter the return path routes through

  /* Width is driven by the longest label plus room for the step number, so a
     name like readQueryFromClient does not run under the 02 in the corner. */
  const longest = Math.max(...steps.map((s) => textW(s.label, 13)), ...steps.map((s) => textW(s.sub ?? "", 10.5)));
  const BW = Math.max(168, Math.ceil(longest) + 62);

  const rows = Math.ceil(steps.length / wrap);
  const perRow = Math.min(steps.length, wrap);
  const W = LEFT + perRow * BW + (perRow - 1) * GAP;
  const H = rows * BH + (rows - 1) * ROW_GAP + (loop ? 50 : 12);
  const xOf = (c: number) => LEFT + c * (BW + GAP);
  const yOf = (r: number) => r * (BH + ROW_GAP);

  const lastR = Math.floor((steps.length - 1) / wrap);
  const lastC = (steps.length - 1) % wrap;

  return (
    <Svg vw={W} vh={H}>
      {steps.map((s, i) => {
        const r = Math.floor(i / wrap);
        const c = i % wrap;
        const x = xOf(c);
        const y = yOf(r);
        const last = i === steps.length - 1;
        const endOfRow = c === perRow - 1;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={BW} height={BH} rx="11"
              fill={s.accent ? "var(--accent-soft)" : "var(--surface-2)"}
              stroke={s.accent ? "var(--accent)" : "var(--line-2)"}
              strokeWidth={s.accent ? 1.7 : 1}
            />
            <text x={x + 14} y={y + (s.sub ? 25 : 34)}
              fill={s.accent ? "var(--accent)" : "var(--ink)"} fontSize="13" fontWeight="600">
              {s.label}
            </text>
            {s.sub && (
              <text x={x + 14} y={y + 42} fill="var(--faint)" fontSize="10.5">{s.sub}</text>
            )}
            <text x={x + BW - 12} y={y + 17} textAnchor="end" fill="var(--faint)" fontSize="10">
              {String(i + 1).padStart(2, "0")}
            </text>

            {!last && !endOfRow && (
              <line x1={x + BW + 6} y1={y + BH / 2} x2={x + BW + GAP - 6} y2={y + BH / 2}
                stroke="var(--faint)" strokeWidth="1.2" markerEnd="url(#kd-arrow)" />
            )}
            {!last && endOfRow && (
              <path
                d={`M${x + BW / 2} ${y + BH + 6} L${x + BW / 2} ${y + BH + 26} L${xOf(0) + BW / 2} ${y + BH + 26} L${xOf(0) + BW / 2} ${y + BH + ROW_GAP - 6}`}
                stroke="var(--faint)" strokeWidth="1.2" fill="none" markerEnd="url(#kd-arrow)" />
            )}
          </g>
        );
      })}

      {/* The loop returns to step 01, routed down and around the left gutter. */}
      {loop && (
        <>
          <path
            d={`M${xOf(lastC) + BW / 2} ${yOf(lastR) + BH + 6} L${xOf(lastC) + BW / 2} ${H - 30} L${10} ${H - 30} L${10} ${BH / 2} L${xOf(0) - 8} ${BH / 2}`}
            stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="5 4" fill="none"
            markerEnd="url(#kd-arrow-a)" />
          <text x={W} y={H - 12} textAnchor="end" fill="var(--accent)" fontSize="11">{loop}</text>
        </>
      )}
    </Svg>
  );
}

/* ══ Sequence ═════════════════════════════════════════════════════════════
   Lifelines and messages. The right shape for replication, consensus, a
   handshake, two-phase commit — anything where the interesting part is the
   order things happen in and what a gap in the middle means. */

export interface SeqMessage {
  from: number;
  to: number;
  label: string;
  dashed?: boolean;
  accent?: boolean;
  note?: string;
}

export function Sequence({
  actors, messages, gap,
}: {
  actors: string[];
  messages: SeqMessage[];
  /** highlight a contiguous run of messages as one window */
  gap?: { from: number; to: number; label: string };
}) {
  const W = 880;
  const TOP = 46;
  const STEP = 48;
  const H = TOP + messages.length * STEP + 12;
  const lane = W / actors.length;
  const cx = (i: number) => lane * i + lane / 2;

  return (
    <Svg vw={W} vh={H}>
      {actors.map((a, i) => (
        <g key={i}>
          <rect
            x={cx(i) - 76} y={4} width="152" height="32" rx="8"
            fill="var(--surface-2)" stroke="var(--line-2)"
          />
          <text x={cx(i)} y={25} textAnchor="middle" fill="var(--ink)" fontSize="12.5" fontWeight="600">
            {a}
          </text>
          <line
            x1={cx(i)} y1={40} x2={cx(i)} y2={H - 6}
            stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5"
          />
        </g>
      ))}

      {gap && (
        <>
          <rect
            x={0} y={TOP + gap.from * STEP - 4} width={W}
            height={(gap.to - gap.from + 1) * STEP} rx="8"
            fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="1"
          />
          <text
            x={W - 10} y={TOP + gap.from * STEP + 12} textAnchor="end"
            fill="var(--accent)" fontSize="10.5"
          >
            {gap.label}
          </text>
        </>
      )}

      {messages.map((m, i) => {
        const y = TOP + i * STEP + 14;
        const x1 = cx(m.from);
        const x2 = cx(m.to);
        const self = m.from === m.to;
        const stroke = m.accent ? "var(--accent)" : "var(--faint)";
        const marker = m.accent ? "url(#kd-arrow-a)" : "url(#kd-arrow)";
        return (
          <g key={i}>
            {self ? (
              <path
                d={`M${x1} ${y} L${x1 + 46} ${y} L${x1 + 46} ${y + 18} L${x1 + 5} ${y + 18}`}
                stroke={stroke} strokeWidth="1.3" fill="none" markerEnd={marker}
                strokeDasharray={m.dashed ? "5 4" : undefined}
              />
            ) : (
              <line
                x1={x1 + (x2 > x1 ? 6 : -6)} y1={y} x2={x2 + (x2 > x1 ? -8 : 8)} y2={y}
                stroke={stroke} strokeWidth="1.3" markerEnd={marker}
                strokeDasharray={m.dashed ? "5 4" : undefined}
              />
            )}
            <text
              x={self ? x1 + 54 : (x1 + x2) / 2} y={y - 8}
              textAnchor={self ? "start" : "middle"}
              fill={m.accent ? "var(--accent)" : "var(--muted)"} fontSize="11.5"
            >
              {m.label}
            </text>
            {m.note && (
              <text
                x={self ? x1 + 54 : (x1 + x2) / 2} y={y + 15}
                textAnchor={self ? "start" : "middle"} fill="var(--faint)" fontSize="10"
              >
                {m.note}
              </text>
            )}
          </g>
        );
      })}
    </Svg>
  );
}

/* ══ Tree ═════════════════════════════════════════════════════════════════
   B-trees, radix tries, skiplist levels, a process hierarchy. Tidy layout:
   leaves are placed left to right, every parent is centred over its children,
   so the picture doesn't drift the way a naive layout does. */

export interface TreeNode {
  label: string;
  sub?: string;
  accent?: boolean;
  dim?: boolean;
  children?: TreeNode[];
}

interface Placed {
  node: TreeNode;
  x: number;
  depth: number;
  w: number;
}

export function Tree({ root, nodeWidth = 96 }: { root: TreeNode; nodeWidth?: number }) {
  const NW = nodeWidth;
  const NH = 42;
  const HGAP = 18;
  const VGAP = 56;

  const placed: Placed[] = [];
  const edges: [Placed, Placed][] = [];
  let cursor = 0;

  function walk(node: TreeNode, depth: number): Placed {
    if (!node.children?.length) {
      const p = { node, x: cursor, depth, w: NW };
      cursor += NW + HGAP;
      placed.push(p);
      return p;
    }
    const kids = node.children.map((c) => walk(c, depth + 1));
    const x = (kids[0].x + kids[kids.length - 1].x) / 2;
    const p = { node, x, depth, w: NW };
    placed.push(p);
    kids.forEach((k) => edges.push([p, k]));
    return p;
  }
  walk(root, 0);

  const maxDepth = Math.max(...placed.map((p) => p.depth));
  const W = Math.max(cursor - HGAP, NW);
  const H = (maxDepth + 1) * NH + maxDepth * VGAP + 8;
  const yOf = (d: number) => d * (NH + VGAP);

  return (
    <Svg vw={W} vh={H}>
      {edges.map(([a, b], i) => {
        const ax = a.x + NW / 2;
        const ay = yOf(a.depth) + NH;
        const bx = b.x + NW / 2;
        const by = yOf(b.depth);
        const mid = (ay + by) / 2;
        return (
          <path
            key={i}
            d={`M${ax} ${ay} C${ax} ${mid}, ${bx} ${mid}, ${bx} ${by}`}
            stroke={b.node.accent ? "var(--accent)" : "var(--line-2)"}
            strokeWidth={b.node.accent ? 1.5 : 1}
            fill="none"
          />
        );
      })}

      {placed.map((p, i) => (
        <g key={i}>
          <rect
            x={p.x} y={yOf(p.depth)} width={NW} height={NH} rx="9"
            fill={p.node.accent ? "var(--accent-soft)" : p.node.dim ? "transparent" : "var(--surface-2)"}
            stroke={p.node.accent ? "var(--accent)" : "var(--line-2)"}
            strokeWidth={p.node.accent ? 1.6 : 1}
            strokeDasharray={p.node.dim ? "4 3" : undefined}
          />
          <text
            x={p.x + NW / 2} y={yOf(p.depth) + (p.node.sub ? 19 : 26)} textAnchor="middle"
            fill={p.node.accent ? "var(--accent)" : p.node.dim ? "var(--faint)" : "var(--ink)"}
            fontSize="12" fontWeight="600"
          >
            {p.node.label}
          </text>
          {p.node.sub && (
            <text x={p.x + NW / 2} y={yOf(p.depth) + 33} textAnchor="middle" fill="var(--faint)" fontSize="10">
              {p.node.sub}
            </text>
          )}
        </g>
      ))}
    </Svg>
  );
}

/* ══ Cells ════════════════════════════════════════════════════════════════
   An indexed array with an optional cursor. Hash buckets, a ring buffer, log
   segments, a slot map, page table entries — the shape turns up constantly,
   and what matters is almost always "which cell is the pointer on and what is
   behind it". Two rows render as before/after, which is exactly the picture
   an incremental migration needs. */

export interface CellRow {
  label: string;
  cells: (string | null)[];
  /** index the cursor sits on, if any */
  cursor?: number;
  cursorLabel?: string;
  dimBefore?: number;
  dimFrom?: number;
}

export function Cells({
  rows, caption, cellWidth = 62,
}: {
  rows: CellRow[];
  caption?: string;
  cellWidth?: number;
}) {
  const CW = cellWidth;
  const CH = 42;
  const LABEL_W = 96;
  const ROW_GAP = 62;
  const cols = Math.max(...rows.map((r) => r.cells.length));
  const W = LABEL_W + cols * CW;
  const TOP = 22;
  const H = TOP + rows.length * (CH + ROW_GAP) - ROW_GAP + (caption ? 26 : 10);

  return (
    <Svg vw={W} vh={H}>
      {/* index ruler */}
      {Array.from({ length: cols }, (_, i) => (
        <text
          key={`i${i}`} x={LABEL_W + i * CW + CW / 2} y={12}
          textAnchor="middle" fill="var(--faint)" fontSize="10"
        >
          {i}
        </text>
      ))}

      {rows.map((row, r) => {
        const y = TOP + r * (CH + ROW_GAP);
        return (
          <g key={r}>
            <text x={0} y={y + 26} fill="var(--muted)" fontSize="11.5" fontWeight="600">
              {row.label}
            </text>

            {row.cells.map((c, i) => {
              const dim =
                (row.dimBefore !== undefined && i < row.dimBefore) ||
                (row.dimFrom !== undefined && i >= row.dimFrom);
              const on = row.cursor === i;
              return (
                <g key={i}>
                  <rect
                    x={LABEL_W + i * CW + 1} y={y} width={CW - 3} height={CH} rx="6"
                    fill={on ? "var(--accent-soft)" : dim ? "transparent" : "var(--surface-2)"}
                    stroke={on ? "var(--accent)" : "var(--line-2)"}
                    strokeWidth={on ? 1.7 : 1}
                    strokeDasharray={dim ? "4 3" : undefined}
                  />
                  {c && (
                    <text
                      x={LABEL_W + i * CW + CW / 2} y={y + 26} textAnchor="middle"
                      fill={on ? "var(--accent)" : dim ? "var(--faint)" : "var(--ink)"}
                      fontSize="11.5"
                    >
                      {c}
                    </text>
                  )}
                </g>
              );
            })}

            {row.cursor !== undefined && (
              <g>
                <path
                  d={`M${LABEL_W + row.cursor * CW + CW / 2} ${y + CH + 20} L${LABEL_W + row.cursor * CW + CW / 2} ${y + CH + 4}`}
                  stroke="var(--accent)" strokeWidth="1.4" markerEnd="url(#kd-arrow-a)"
                />
                <text
                  x={LABEL_W + row.cursor * CW + CW / 2} y={y + CH + 34}
                  textAnchor="middle" fill="var(--accent)" fontSize="10.5"
                >
                  {row.cursorLabel ?? "cursor"}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {caption && (
        <text x={0} y={H - 4} fill="var(--faint)" fontSize="11">
          {caption}
        </text>
      )}
    </Svg>
  );
}

/* ══ Plot ═════════════════════════════════════════════════════════════════
   A line chart. Systems writing needs exactly one chart shape often enough to
   justify a primitive: something against something else, usually with an
   asymptote the reader is supposed to notice. Log scale on y because latency
   distributions span four orders of magnitude and a linear axis hides the
   part that matters. */

export interface Series {
  name: string;
  points: [number, number][];
  colour?: string;
  dashed?: boolean;
}

export function Plot({
  series, xLabel, yLabel, logY = false, asymptote, xTicks, height = 300,
}: {
  series: Series[];
  xLabel: string;
  yLabel: string;
  logY?: boolean;
  /** vertical marker, e.g. the utilisation where the curve goes vertical */
  asymptote?: { x: number; label: string };
  xTicks?: number[];
  height?: number;
}) {
  const W = 860;
  const H = height;
  const L = 74, R = 118, T = 18, B = 46;   // margins
  const pw = W - L - R, ph = H - T - B;

  const xs = series.flatMap((s) => s.points.map((p) => p[0]));
  const ys = series.flatMap((s) => s.points.map((p) => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const lo = Math.max(Math.min(...ys), logY ? 1e-9 : -Infinity);
  const hi = Math.max(...ys);

  const px = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * pw;
  const py = (y: number) =>
    logY
      ? T + ph - ((Math.log10(Math.max(y, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo) || 1)) * ph
      : T + ph - ((y - lo) / (hi - lo || 1)) * ph;

  const yTicks = logY
    ? Array.from(
        { length: Math.floor(Math.log10(hi)) - Math.floor(Math.log10(lo)) + 1 },
        (_, i) => 10 ** (Math.floor(Math.log10(lo)) + i),
      ).filter((v) => v >= lo && v <= hi * 1.001)
    : Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);

  const fmt = (v: number) =>
    v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}k` : String(Math.round(v * 100) / 100);

  const PALETTE = ["var(--accent)", "var(--c-os)", "var(--c-dist)", "var(--c-conc)"];

  return (
    <Svg vw={W} vh={H}>
      {yTicks.map((v, i) => (
        <g key={`y${i}`}>
          <line x1={L} y1={py(v)} x2={L + pw} y2={py(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={L - 10} y={py(v) + 4} textAnchor="end" fill="var(--faint)" fontSize="10.5">
            {fmt(v)}
          </text>
        </g>
      ))}

      {(xTicks ?? series[0].points.map((p) => p[0])).map((v, i) => (
        <text key={`x${i}`} x={px(v)} y={T + ph + 20} textAnchor="middle" fill="var(--faint)" fontSize="10.5">
          {fmt(v)}
        </text>
      ))}

      <line x1={L} y1={T + ph} x2={L + pw} y2={T + ph} stroke="var(--line-2)" strokeWidth="1" />
      <line x1={L} y1={T} x2={L} y2={T + ph} stroke="var(--line-2)" strokeWidth="1" />

      <text x={L + pw / 2} y={H - 8} textAnchor="middle" fill="var(--muted)" fontSize="11">
        {xLabel}
      </text>
      <text x={14} y={T + ph / 2} textAnchor="middle" fill="var(--muted)" fontSize="11"
        transform={`rotate(-90 14 ${T + ph / 2})`}>
        {yLabel}
      </text>

      {asymptote && (
        <>
          <line x1={px(asymptote.x)} y1={T} x2={px(asymptote.x)} y2={T + ph}
            stroke="var(--c-machine)" strokeWidth="1.2" strokeDasharray="5 4" />
          <text x={px(asymptote.x) - 6} y={T + 12} textAnchor="end"
            fill="var(--c-machine)" fontSize="10.5">
            {asymptote.label}
          </text>
        </>
      )}

      {series.map((s, i) => {
        const c = s.colour ?? PALETTE[i % PALETTE.length];
        const d = s.points.map((p, j) => `${j ? "L" : "M"}${px(p[0])} ${py(p[1])}`).join("");
        const last = s.points[s.points.length - 1];
        return (
          <g key={i}>
            <path d={d} stroke={c} strokeWidth="1.9" fill="none"
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((p, j) => (
              <circle key={j} cx={px(p[0])} cy={py(p[1])} r="2.6" fill={c} />
            ))}
            <text x={px(last[0]) + 9} y={py(last[1]) + 4} fill={c} fontSize="11" fontWeight="600">
              {s.name}
            </text>
          </g>
        );
      })}
    </Svg>
  );
}
