/* ──────────────────────────────────────────────────────────────────────────
   Chapter archetypes.

   One spine for every chapter produced sixteen chapters with byte-identical
   section lists. That reads as a template even when each sentence is fine, so
   the shape is now chosen per chapter from four options.

   The labels here are DEFAULTS, shown on stubs. A written chapter names its own
   sections — "One integer, three states" beats "The layout", and twenty-seven
   chapters sharing one set of abstract slot names is the template problem one
   level below the archetypes. Ids stay fixed so anchors and CI do not move.

   `cmd` is the shell line above each heading, and it gets the same treatment:
   a written chapter uses commands a reader could actually run against the
   thing being described.
   ────────────────────────────────────────────────────────────────────────── */

export type Archetype = "mechanism" | "phenomenon" | "decision" | "model";

export interface SpineSection {
  id: string;
  label: string;
  cmd: string;
  what: string;
}

export interface Shape {
  name: string;
  blurb: string;
  spine: SpineSection[];
  tail: SpineSection[];
}

/** Sections every chapter carries, so readers always know where to find them. */
const COMMON_TAIL: SpineSection[] = [
  { id: "in-the-wild", label: "Where you meet this in the wild", cmd: "grep -ri postmortem ./",
    what: "Named systems, named outages, named engineers who wrote it up." },
  { id: "interview", label: "Interview questions", cmd: "./drill --level all",
    what: "Questions tagged beginner, intermediate and deep, answered properly." },
  { id: "resources", label: "Go deeper", cmd: "cat REFERENCES.md",
    what: "Papers, source files and talks, every one opened before it was linked." },
];

export const SHAPES: Record<Archetype, Shape> = {
  /* A specific system you can open up and follow one operation through. */
  mechanism: {
    name: "Mechanism",
    blurb: "A system you can open up and trace one operation through.",
    spine: [
      { id: "contract", label: "What it promises", cmd: "man 7 guarantees",
        what: "What it promises, and what it explicitly does not." },
      { id: "layout", label: "What it looks like in memory", cmd: "hexdump -C ./state",
        what: "The data structures, as bytes. Not boxes and arrows." },
      { id: "hot-path", label: "What happens when you call it", cmd: "perf record ./one-operation",
        what: "One operation end to end, at source level, from the real implementation." },
      { id: "failure", label: "How it breaks", cmd: "dmesg | grep -i fail",
        what: "A disk lies, a node dies, a clock jumps. Partial failure is the subject." },
      { id: "cost", label: "What it costs", cmd: "perf stat ./bench",
        what: "Nanoseconds, cache lines, hops, dollars. Derived here or attributed." },
      { id: "operating", label: "Running it in production", cmd: "watch -n1 ./status",
        what: "How to see inside it, what to tune, what breaks only at scale." },
    ],
    tail: [
      { id: "build", label: "Build this", cmd: "git init ./weekend-project",
        what: "One weekend project that makes the mechanism impossible to forget." },
      { id: "tradeoffs", label: "What you give up", cmd: "diff --side-by-side a b",
        what: "The design decisions and the price of each. Choices, not failures." },
      ...COMMON_TAIL,
    ],
  },

  /* An emergent effect rather than a component. No single hot path exists. */
  phenomenon: {
    name: "Phenomenon",
    blurb: "An effect you can observe and reproduce, not a component you can open.",
    spine: [
      { id: "observe", label: "What you observe", cmd: "./reproduce --show",
        what: "The surprising behaviour, stated concretely enough to reproduce." },
      { id: "mechanism", label: "Why it happens", cmd: "objdump -d ./explain",
        what: "The hardware or kernel behaviour underneath, with evidence." },
      { id: "controls", label: "What controls it", cmd: "sysctl -a | grep .",
        what: "The variables that make it better or worse, and which you can reach." },
      { id: "measurements", label: "The measurements", cmd: "./sweep | tee curve.dat",
        what: "The sweep, the curve, the cliff. Numbers from named hardware." },
      { id: "act", label: "What to do about it", cmd: "patch -p1 < fix.diff",
        what: "Interventions ranked by leverage, not by cleverness." },
    ],
    tail: [
      { id: "reproduce", label: "Reproduce it yourself", cmd: "make bench && ./bench",
        what: "The experiment, small enough to run tonight, including how to get it wrong." },
      ...COMMON_TAIL,
    ],
  },

  /* Which of several options to use. The payload is the crossover. */
  decision: {
    name: "Decision",
    blurb: "Several viable options, and the measured point where one overtakes another.",
    spine: [
      { id: "choice", label: "The choice you're making", cmd: "cat DECISION.md",
        what: "What is actually being decided, and when the question comes up." },
      { id: "options", label: "The options", cmd: "ls ./options/",
        what: "Each one in the same four slots, so they compare by position." },
      { id: "crossover", label: "Where the crossover is", cmd: "./bench --compare",
        what: "Measured. The point where the ranking flips, on named hardware." },
      { id: "choosing", label: "How to choose", cmd: "./choose --explain",
        what: "A decision procedure short enough to remember." },
      { id: "mistakes", label: "What people get wrong", cmd: "git log --grep=revert",
        what: "The failure modes of the choice itself, not of the options." },
    ],
    tail: [
      { id: "worksheet", label: "Decide it for your case", cmd: "./worksheet",
        what: "The measurement to run on your own workload before committing." },
      ...COMMON_TAIL,
    ],
  },

  /* Theory with arithmetic. The payload is a model you can apply. */
  model: {
    name: "Model",
    blurb: "A small piece of theory that predicts something, and its limits.",
    spine: [
      { id: "question", label: "The question", cmd: "cat QUESTION.md",
        what: "What you are trying to predict, and why intuition fails at it." },
      { id: "model", label: "The model", cmd: "cat model.txt",
        what: "The rule or equation, stated plainly, with every term defined." },
      { id: "origin", label: "Where it comes from", cmd: "git log --follow model.txt",
        what: "The derivation or the source. Enough to trust it, not a proof." },
      { id: "breaks", label: "Where it breaks", cmd: "./validate --against-reality",
        what: "The assumptions, and what happens to the prediction when they fail." },
      { id: "applying", label: "Using it", cmd: "./solve --my-numbers",
        what: "Applied to real figures, arriving at a decision someone would make." },
    ],
    tail: [
      { id: "apply", label: "Apply it to your numbers", cmd: "./solve --interactive",
        what: "The arithmetic, laid out so a reader can substitute their own inputs." },
      ...COMMON_TAIL,
    ],
  },
};

export function shapeOf(a: Archetype | undefined): Shape {
  return SHAPES[a ?? "mechanism"];
}

/** Kept for the stub renderer, which still shows the default skeleton. */
export const SPINE_SECTIONS = SHAPES.mechanism.spine;
export const TAIL_SECTIONS = SHAPES.mechanism.tail;
export const ALL_SECTIONS = [...SPINE_SECTIONS, ...TAIL_SECTIONS];
