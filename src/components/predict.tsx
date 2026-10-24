"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Predict, then reveal. The reader has to commit to an answer before the page
   gives one away, which is most of what makes a question stick. The
   explanation is shown whichever option they chose, since a right guess for
   the wrong reason is worth correcting too. */
export function Predict({
  q, options, answer, children,
}: {
  q: string;
  options: string[];
  /** index into options */
  answer: number;
  children: React.ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const right = picked === answer;

  return (
    <div className="my-9 rounded-xl border border-line bg-surface p-5 font-[family-name:var(--font-inter)] shadow-[var(--shadow)]">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.07em] text-accent">
        Predict before you read on
      </div>
      <p className="mb-4 font-[family-name:var(--font-serif)] text-[18.5px] leading-snug text-ink">{q}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => {
          const isAns = i === answer;
          const isPick = i === picked;
          return (
            <button
              key={i}
              disabled={done}
              onClick={() => setPicked(i)}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[14.5px] leading-snug transition-colors",
                !done && "border-line-2 hover:border-accent hover:bg-accent-soft",
                done && isAns && "border-data bg-data/10 text-ink",
                done && isPick && !isAns && "border-machine bg-machine/10 text-ink",
                done && !isAns && !isPick && "border-line text-faint",
              )}
            >
              <span
                className={cn(
                  "mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                  done && isAns ? "border-data bg-data text-bg" : done && isPick ? "border-machine bg-machine text-bg" : "border-line-2 text-muted",
                )}
              >
                {done && isAns ? <Check className="size-3" /> : done && isPick ? <X className="size-3" /> : String.fromCharCode(65 + i)}
              </span>
              {o}
            </button>
          );
        })}
      </div>

      {done && (
        <div className="mt-4 border-t border-line pt-4">
          <div className={cn("mb-1.5 text-[13.5px] font-semibold", right ? "text-data" : "text-machine")}>
            {right ? "Right." : "Not quite."}
          </div>
          <div className="text-[15px] leading-relaxed text-muted [&>p:last-child]:mb-0 [&>p]:mb-2">{children}</div>
          <button onClick={() => setPicked(null)} className="mt-3 text-[13px] text-faint underline decoration-line-2 underline-offset-2 hover:text-ink">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
