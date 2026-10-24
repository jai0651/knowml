"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/* Views and likes. Degrades to nothing if DATABASE_URL is unset, so a local
   checkout without a database renders the chapter unchanged rather than
   showing a broken widget or a zero that looks like a real count. */
export function PageStats({ pageId }: { pageId: string }) {
  const [s, setS] = useState<{ views: number; likes: number } | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const counted = useRef(false);
  const key = `ks-liked::${pageId}`;

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(key) === "1");
    } catch {}
    if (counted.current) return;
    counted.current = true;

    /* One POST per page load registers the view and returns the fresh counts,
       so this is one request rather than a GET plus a POST. */
    fetch("/api/counters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId, action: "view" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.disabled && !d.error) setS({ views: d.views, likes: d.likes });
      })
      .catch(() => {});
  }, [pageId, key]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !liked;
    // optimistic, because a like that lags feels broken
    setLiked(next);
    setS((p) => (p ? { ...p, likes: Math.max(p.likes + (next ? 1 : -1), 0) } : p));
    try {
      localStorage.setItem(key, next ? "1" : "0");
      const r = await fetch("/api/counters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId, action: next ? "like" : "unlike" }),
      });
      const d = await r.json();
      if (!d.error && !d.disabled) setS({ views: d.views, likes: d.likes });
    } catch {
      setLiked(!next); // put it back
    } finally {
      setBusy(false);
    }
  }

  if (!s) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-1.5 px-1.5 py-1 text-[12.5px] text-faint">
        <Eye className="size-3.5" />
        <span className="tnum">{s.views.toLocaleString()}</span>
      </span>
      <button
        onClick={toggle}
        aria-pressed={liked}
        aria-label={liked ? "Remove like" : "Like this chapter"}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] transition-colors",
          liked
            ? "text-machine"
            : "text-faint hover:bg-surface-2 hover:text-ink",
        )}
      >
        <Heart className={cn("size-3.5", liked && "fill-current")} />
        <span className="tnum">{s.likes.toLocaleString()}</span>
      </button>
    </div>
  );
}
