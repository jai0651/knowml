"use client";

import { useEffect } from "react";
import { loadScripts } from "../map/load-scripts";

export function AdminScripts() {
  useEffect(() => {
    const { done, cleanup } = loadScripts([{ src: "/assets/js/admin.js" }]);
    done.catch((e) => console.error(e));
    return cleanup;
  }, []);
  return null;
}
