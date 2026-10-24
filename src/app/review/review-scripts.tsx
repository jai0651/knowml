"use client";

import { useEffect } from "react";

/* The review engine and drill UI are plain scripts that initialise when they
   run. A <Script> tag runs once per page load, so on a client-side return to
   /review they would never start. Instead, every mount appends fresh script
   elements in order and every unmount removes them. */
const LOCAL = ["/assets/js/kml-modal.js", "/assets/js/review.js", "/assets/js/question-bank.js", "/assets/js/review-page.js"];
const KATEX = [
  { src: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js", has: () => "katex" in window },
  { src: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js", has: () => "renderMathInElement" in window },
];

function load(src: string, added: HTMLScriptElement[], cancelled: () => boolean) {
  return new Promise<void>((resolve) => {
    if (cancelled()) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    added.push(s);
    document.body.appendChild(s);
  });
}

export function ReviewScripts() {
  useEffect(() => {
    let dead = false;
    const added: HTMLScriptElement[] = [];
    (async () => {
      for (const k of KATEX) if (!k.has()) await load(k.src, [], () => dead);
      for (const src of LOCAL) await load(src, added, () => dead);
    })();
    return () => {
      dead = true;
      added.forEach((s) => s.remove());
      document.body.classList.remove("in-session");
      document.querySelectorAll(".kml-modal-overlay").forEach((n) => n.remove());
      document.body.style.overflow = "";
    };
  }, []);
  return null;
}
