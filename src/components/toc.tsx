import type { SpineSection } from "@/lib/spine";

export function Toc({ sections }: { sections: SpineSection[] }) {
  return (
    <aside className="hidden w-[240px] shrink-0 xl:block">
      <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-10 pr-6">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.09em] text-faint">
          On this page
        </div>
        <nav className="border-l border-line">
          {sections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="-ml-px block border-l border-transparent py-[5px] pl-3 text-[13px] leading-snug text-muted transition-colors hover:border-accent hover:text-ink"
            >
              <span className="mr-2 font-mono text-[11px] text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
