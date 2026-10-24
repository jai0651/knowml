import { cn } from "@/lib/utils";

/* A numbered chapter section: "02  The receive path, step by step". The
   number is set in mono in the accent colour so a reader can find their place
   by eye. `cmd` is still accepted from older MDX and simply not shown. */
export function SectionHeading({
  n, id, children, className,
}: {
  n?: string;
  cmd?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "mb-5 mt-20 flex scroll-mt-24 items-baseline gap-3.5 text-[28px] font-bold leading-[1.2] tracking-[-0.025em] text-ink first:mt-0 sm:text-[31px]",
        className,
      )}
    >
      {n && <span className="tnum shrink-0 font-mono text-[15px] font-medium text-accent">{n}</span>}
      <span>{children}</span>
    </h2>
  );
}

/* "Why not one interrupt per packet?" The question a learner would ask next,
   as its own small heading, answered by the paragraphs under it. */
export function Why({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 mt-8 flex items-center gap-2.5 text-[17.5px] font-bold leading-snug tracking-[-0.01em] text-ink">
      <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-accent-soft text-[12px] font-extrabold text-accent">?</span>
      {children}
    </h4>
  );
}
