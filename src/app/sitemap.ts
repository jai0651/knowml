import type { MetadataRoute } from "next";
import { topics, labs } from "@/lib/manifest";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const u = (path: string) => `${SITE.url}${path}`;
  /* No lastmod: chapters don't carry a reliable updated date yet, and stamping
     every page with the build time tells crawlers the whole site changed on
     every deploy. */
  return [
    { url: u("/"), changeFrequency: "weekly", priority: 1 },
    { url: u("/sections"), changeFrequency: "weekly", priority: 0.8 },
    { url: u("/labs"), changeFrequency: "monthly", priority: 0.7 },
    ...topics.map((p) => ({ url: u(p.href), changeFrequency: "monthly" as const, priority: 0.9 })),
    ...labs.map((l) => ({ url: u(l.href), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
