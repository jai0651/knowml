"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Runs the legacy roadmap-map.js on every mount. A <Script> would load once and
   never re-run after client-side navigation, so the script element is appended
   fresh each time and removed on unmount, along with the classes it puts on
   <html>. Internal links inside the server-rendered markup go through the
   router instead of a full page load. */
export function RoadmapClient() {
  const router = useRouter();

  useEffect(() => {
    const s = document.createElement("script");
    s.src = "/assets/js/roadmap-map.js";
    document.body.appendChild(s);
    const root = document.documentElement;
    return () => {
      s.remove();
      root.classList.remove("js-roadmap", "rm-text-mode");
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.(".pg-roadmaps a[href]") as HTMLAnchorElement | null;
      if (!a || a.target) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      e.preventDefault();
      router.push(href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  return null;
}
