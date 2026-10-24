"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadScripts } from "./load-scripts";

export function MapScripts() {
  const router = useRouter();
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.KML_MAP_NAV = (href: string) => router.push(href);
    const { done, cleanup } = loadScripts([
      { src: "/assets/vendor/cytoscape.min.js", skipIf: "cytoscape" },
      { src: "/assets/js/map-data.js" },
      { src: "/assets/js/mindmap.js" },
    ]);
    done.catch((e) => console.error(e));
    return () => {
      cleanup();
      const cy = w.KML_MAP_CY as { destroy?: () => void } | undefined;
      cy?.destroy?.();
      delete w.KML_MAP_CY;
      delete w.KML_MAP_NAV;
    };
  }, [router]);
  return null;
}
