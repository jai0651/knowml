import { cn } from "@/lib/utils";

/* A glass panel with a header strip. Used for code, quoted source and labs.
   The accent bar on the left of the header is the only chrome — no fake
   traffic lights, no window title bar. */
export function Panel({
  label, right, className, bodyClassName, tone = "accent", children,
}: {
  label: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "accent" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-[var(--code-bg)]", className)}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", tone === "accent" ? "bg-accent" : "bg-faint")} />
        <span className="truncate text-[12.5px] font-medium text-muted">{label}</span>
        <div className="flex-1" />
        {right}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Kept for the existing import surface. */
export const TerminalFrame = Panel;
