import manifest from "../../content/manifest.json";
import type { Archetype } from "./spine";

export type Kind = "topic" | "lab";
export type Status = "stub" | "live";

export interface Page {
  id: string;
  slug: string;
  href: string;
  num: string;
  title: string;
  short: string;
  hook: string;
  kind: Kind;
  status: Status;
  group: string;
  groupSlug: string;
  /** Which section spine this chapter uses. Absent on labs. */
  archetype?: Archetype;
}

export interface Group {
  name: string;
  slug: string;
  colour: string;
  pages: Page[];
}

interface RawPage {
  id: string;
  href: string;
  num: string;
  title: string;
  hook: string;
  kind: string;
  short?: string;
}

const slugOf = (name: string) =>
  name.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The components name group colours by nine Tailwind keys (`text-machine`,
 *  `bg-cases`, …) that came from the sibling site. KnowML's groups map onto
 *  them here, so a group's colour is one lookup. Keys match `--color-*` in
 *  globals.css. */
const GROUP_COLOUR: Record<string, string> = {
  foundations: "machine",
  "neural-nets-vision": "os",
  "sequence-attention-llms": "conc",
  "generative-multimodal": "ops",
  "decision-retrieval-systems": "dist",
  "embodied-frontier": "data",
  "systems-safety-interview": "cloud",
  "hands-on": "data",
  "inference-serving": "cloud",
  "ml-system-design": "cases",
  "the-labs": "lab",
  "model-atlas": "conc",
  "grand-challenges": "machine",
};

function hrefOf(p: RawPage): string {
  return p.kind === "lab" ? `/labs/${p.id}` : `/topics/${p.id}`;
}

export const groups: Group[] = (manifest.groups as { name: string; pages: RawPage[] }[]).map((g) => {
  const slug = slugOf(g.name);
  return {
    name: g.name,
    slug,
    colour: GROUP_COLOUR[slug] ?? "accent",
    pages: g.pages.map((p) => ({
      id: p.id,
      slug: p.id,
      href: hrefOf(p),
      num: p.num,
      title: p.title,
      short: p.short ?? p.title,
      hook: p.hook,
      kind: p.kind === "lab" ? "lab" : "topic",
      status: "live",
      group: g.name,
      groupSlug: slug,
    })),
  };
});

export const allPages: Page[] = groups.flatMap((g) => g.pages);
export const topics: Page[] = allPages.filter((p) => p.kind === "topic");
export const labs: Page[] = allPages.filter((p) => p.kind === "lab");
export const livePages: Page[] = allPages.filter((p) => p.status === "live");

export function pageBySlug(slug: string): Page | undefined {
  return allPages.find((p) => p.slug === slug);
}

export function groupOf(page: Page): Group {
  return groups.find((g) => g.slug === page.groupSlug)!;
}

export function colourOf(page: Page): string {
  return GROUP_COLOUR[page.groupSlug] ?? "accent";
}

/** Previous and next in reading order, across group boundaries. Labs are
 *  excluded so a chapter's "next" is always another chapter. */
export function neighbours(slug: string): { prev?: Page; next?: Page } {
  const list = topics;
  const i = list.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return { prev: list[i - 1], next: list[i + 1] };
}

export function countOf(a: string): number {
  return topics.filter((p) => (p.archetype ?? "mechanism") === a).length;
}
