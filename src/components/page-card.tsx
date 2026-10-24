import Link from "next/link";
import type { Page } from "@/lib/manifest";
import { cn } from "@/lib/utils";
import { BrandLogo, hasBrandLogo } from "./brand-logo";

const TEXT: Record<string, string> = {
  machine: "text-machine", os: "text-os", conc: "text-conc", data: "text-data",
  dist: "text-dist", cloud: "text-cloud", ops: "text-ops", cases: "text-cases", lab: "text-lab",
};
const FROM: Record<string, string> = {
  machine: "from-machine", os: "from-os", conc: "from-conc", data: "from-data",
  dist: "from-dist", cloud: "from-cloud", ops: "from-ops", cases: "from-cases", lab: "from-lab",
};

export function PageCard({ page, colour }: { page: Page; colour: string }) {
  return (
    <Link
      href={page.href}
      className={cn("glass glass-hover group relative flex flex-col overflow-hidden rounded-xl p-4", page.status === "stub" && "opacity-60 shadow-none")}
    >
      {/* group colour as a hairline across the top, lighting up on hover */}
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent opacity-50 transition-opacity group-hover:opacity-100",
          FROM[colour],
        )}
      />

      <div className="mb-2 flex items-center gap-2 text-[12.5px]">
        {hasBrandLogo(page.slug) && <BrandLogo slug={page.slug} size={26} />}
        <span className={cn("tnum font-semibold", TEXT[colour])}>{page.num}</span>
        {page.status === "stub" && <span className="text-faint">· not written yet</span>}
      </div>

      <div className="mb-1.5 text-[15.5px] font-semibold leading-snug text-ink">{page.title}</div>
      <div className="text-[13.2px] leading-relaxed text-muted">{page.hook}</div>
    </Link>
  );
}
