"use client";

import { useEffect } from "react";
import { loadScripts } from "../map/load-scripts";

export function TechmapScripts() {
  useEffect(() => {
    const w = window as unknown as {
      KMLTechTree?: {
        render: (c: HTMLElement, d: unknown, base: string) => void;
        attachFilter: (c: HTMLElement, i: HTMLInputElement) => void;
        expandAll: (c: HTMLElement, open: boolean) => void;
      };
      KML_TECHTREE?: unknown;
    };
    const container = document.getElementById("ttContainer");
    const filter = document.getElementById("ttFilter") as HTMLInputElement | null;
    const expand = document.getElementById("ttExpandAll");
    const collapse = document.getElementById("ttCollapseAll");
    const onExpand = () => container && w.KMLTechTree?.expandAll(container, true);
    const onCollapse = () => container && w.KMLTechTree?.expandAll(container, false);
    const { done, cleanup } = loadScripts([
      { src: "/assets/js/techtree.js" },
      { src: "/assets/js/techtree-data.js" },
    ]);
    done
      .then((ok) => {
        if (!ok || !container || !filter || !w.KMLTechTree) return;
        w.KMLTechTree.render(container, w.KML_TECHTREE, "/topics/");
        w.KMLTechTree.attachFilter(container, filter);
        expand?.addEventListener("click", onExpand);
        collapse?.addEventListener("click", onCollapse);
      })
      .catch((e) => console.error(e));
    return () => {
      cleanup();
      expand?.removeEventListener("click", onExpand);
      collapse?.removeEventListener("click", onCollapse);
    };
  }, []);
  return null;
}
