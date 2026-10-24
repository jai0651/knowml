"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { Group } from "@/lib/manifest";
import { cn } from "@/lib/utils";

/* Below the lg breakpoint the sidebar is hidden, so this is the only way to
   reach another chapter on a phone. A sheet from the left with the same list. */
export function MobileMenu({ groups }: { groups: Pick<Group, "slug" | "name" | "pages">[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return () => { document.body.style.overflow = ""; };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    // Open at the chapter you're on, not at the top of a 48-item list.
    requestAnimationFrame(() => document.querySelector('[data-mobile-current="true"]')?.scrollIntoView({ block: "center" }));
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open contents"
        className="-ml-1.5 grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
      >
        <Menu className="size-[19px]" />
      </button>
      {/* Portalled to <body>: the header's backdrop-filter makes it the
          containing block for fixed children, which trapped this drawer inside
          the 64px bar where nobody could see it. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Contents">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <nav onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }} className="absolute inset-y-0 left-0 w-[min(86vw,340px)] overflow-y-auto border-r border-line bg-bg px-5 pb-10 pt-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-[family-name:var(--font-serif)] text-[20px] font-semibold text-ink">Contents</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2">
                <X className="size-[18px]" />
              </button>
            </div>
            <div className="mb-5 flex gap-4 border-b border-line pb-4 text-[14.5px]">
              <Link href="/sections" className="text-muted hover:text-ink">All chapters</Link>
              <Link href="/blog" className="text-muted hover:text-ink">Field notes</Link>
              <Link href="/projects" className="text-muted hover:text-ink">Projects</Link>
              <Link href="/labs" className="text-muted hover:text-ink">Labs</Link>
            </div>
            {groups.map((g) => (
              <div key={g.slug} className="mb-5">
                <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{g.name}</div>
                {g.pages.map((p) => (
                  <Link
                    key={p.slug}
                    href={p.href}
                    data-mobile-current={p.href === path ? "true" : undefined}
                    className={cn(
                      "block py-1.5 text-[15px] leading-snug",
                      p.href === path ? "font-medium text-accent" : p.status === "live" ? "text-ink" : "text-faint",
                    )}
                  >
                    <span className="tnum mr-2 text-[12px] text-faint">{p.num}</span>
                    {p.short}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
