"use client";

import { useEffect } from "react";

/* The few behaviours a chapter body needs that HTML can't do on its own.
   Today that's one: the Pause button on animated diagrams, which toggles a
   class the stylesheet uses to stop the SVG animations. Readers who asked
   their OS for reduced motion start with every diagram paused. */
export function ChapterEnhance() {
  useEffect(() => {
    const root = document.getElementById("chapter-body");
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const label = (btn: Element, paused: boolean) => {
      btn.textContent = paused ? "▶ Play" : "⏸ Pause";
      btn.setAttribute("aria-pressed", String(paused));
    };
    root.querySelectorAll<HTMLButtonElement>("[data-diagram-toggle]").forEach((btn) => {
      const d = btn.closest(".diagram");
      if (!d) return;
      btn.type = "button";
      if (reduce) d.classList.add("paused");
      label(btn, d.classList.contains("paused"));
    });
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element).closest("[data-diagram-toggle]");
      const d = btn?.closest(".diagram");
      if (!btn || !d) return;
      label(btn, d.classList.toggle("paused"));
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);
  return null;
}
