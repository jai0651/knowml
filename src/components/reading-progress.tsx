"use client";

import { useEffect, useRef } from "react";

/* A 2px bar under the nav that fills as you read the article. Driven by a
   transform on scroll, not by state, so it never re-renders React. */
export function ReadingProgress({ target = "chapter-body" }: { target?: string }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.getElementById(target);
    if (!el || !bar.current) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      const done = Math.min(Math.max(-r.top + 80, 0) / Math.max(total, 1), 1);
      bar.current!.style.transform = `scaleX(${done})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [target]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 h-[2px]" aria-hidden>
      <div ref={bar} className="reading-progress h-full bg-gradient-to-r from-accent to-accent-2" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
