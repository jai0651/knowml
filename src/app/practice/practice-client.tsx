"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Sends internal links in the server-rendered markup through the router. */
export function PracticeClient() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.(".pg-practice a[href]") as HTMLAnchorElement | null;
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
