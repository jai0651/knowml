import { cn } from "@/lib/utils";

const LABEL = ["", "Weekend", "Beginner-friendly", "Intermediate", "Ambitious", "Serious side project"];

export function Difficulty({ level, showLabel = true }: { level: number; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" title={`Difficulty ${level} of 5`}>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn("h-1.5 w-3.5 rounded-full", i <= level ? "bg-gradient-to-r from-accent to-accent-2" : "bg-line-2")} />
        ))}
      </span>
      {showLabel && <span className="text-[12.5px] text-muted">{LABEL[level]}</span>}
    </span>
  );
}
