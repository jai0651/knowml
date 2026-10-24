"use client";

import { useEffect } from "react";

/* The lab scripts are plain browser scripts that build the page on load and
   register document-level listeners. A <Script> would run once per full page
   load, so Home -> lab -> Home -> lab would find an empty shell. Instead each
   mount appends fresh script elements in order and each unmount removes them
   and tears the listeners down. KaTeX comes from the npm package rather than a
   CDN, and is exposed on window because the lab scripts look for it there. */
export function LabRunner({ scripts }: { scripts: string[] }) {
  useEffect(() => {
    let cancelled = false;
    const added: HTMLScriptElement[] = [];

    function load(src: string) {
      return new Promise<void>((resolve, reject) => {
        const el = document.createElement("script");
        el.src = `/assets/js/${src}`;
        el.async = false;
        el.dataset.kmlLab = "1";
        el.onload = () => resolve();
        el.onerror = () => reject(new Error(`failed to load ${src}`));
        added.push(el);
        document.body.appendChild(el);
      });
    }

    (async () => {
      const [katex, autoRender] = await Promise.all([
        import("katex"),
        // @ts-expect-error katex ships no types for its contrib entry
        import("katex/contrib/auto-render"),
      ]);
      if (cancelled) return;
      const w = window as unknown as Record<string, unknown>;
      w.katex = katex.default ?? katex;
      w.renderMathInElement = autoRender.default ?? autoRender;
      for (const src of scripts) {
        if (cancelled) return;
        await load(src);
      }
    })().catch((e) => console.error(e));

    return () => {
      cancelled = true;
      const w = window as unknown as { __kmlLabTeardown?: (() => void) | null; KML_LAB?: unknown };
      w.__kmlLabTeardown?.();
      added.forEach((el) => el.remove());
      delete w.KML_LAB;
    };
  }, [scripts]);

  return null;
}
