"use client";

import { Check, Circle, Play } from "lucide-react";
import { setDone, useDone } from "@/lib/progress";
import { cn } from "@/lib/utils";

export function ChapterActions({ slug, firstId }: { slug: string; firstId?: string }) {
  const done = useDone().includes(slug);
  return (
    <div className="mt-6 flex flex-wrap gap-2.5">
      {firstId && (
        <a
          href={`#${firstId}`}
          className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-[14px] font-semibold text-on-accent shadow-[0_8px_24px_-10px_var(--accent)] transition-opacity hover:opacity-90"
        >
          <Play className="size-3.5 fill-current" /> Start reading
        </a>
      )}
      <button
        onClick={() => setDone(slug, !done)}
        className={cn(
          "inline-flex items-center gap-2 rounded-[10px] border px-4 py-2.5 text-[14px] font-semibold transition-colors",
          done ? "border-transparent bg-ok text-white" : "border-line-2 bg-surface text-ink hover:border-accent",
        )}
      >
        {done ? <Check className="size-4" /> : <Circle className="size-3.5" />}
        {done ? "Completed" : "Mark as complete"}
      </button>
    </div>
  );
}
