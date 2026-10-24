import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

/* Plus Jakarta Sans (OFL), the site's own face. The renderer's built-in font
   has only one weight, so titles came out regular without these. */
const font = (w: number) => fs.readFileSync(path.join(process.cwd(), "src/lib/og-fonts", `jakarta-${w}.woff`));
const FONTS = [400, 600, 800].map((w) => ({ name: "Jakarta", data: font(w), weight: w as 400 | 600 | 800, style: "normal" as const }));
/* Jakarta has no ₹, which the UPI and Zerodha cards need. Noto Sans's
   latin-ext subset (OFL) covers the currency signs and is used only for
   glyphs Jakarta lacks. */
FONTS.push({ name: "Noto Sans", data: fs.readFileSync(path.join(process.cwd(), "src/lib/og-fonts", "noto-sans-latin-ext-400.woff")), weight: 400, style: "normal" });

export const OG_SIZE = { width: 1200, height: 630 };

/* The share card: the brand mark, a kicker, the title and one line of dek,
   on the dark violet theme. Rendered at build time for every page. */
export function ogImage({ kicker, title, dek }: { kicker: string; title: string; dek?: string }) {
  const long = title.length > 48;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "64px 72px", color: "#e6f4f3", fontFamily: "Jakarta",
          background: "radial-gradient(circle at 12% 0%, rgba(167,139,250,0.30), transparent 45%), radial-gradient(circle at 95% 10%, rgba(244,114,182,0.22), transparent 40%), #0c0a16",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 36, fontWeight: 800 }}>K</div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>KnowML</div>
          <div style={{ marginLeft: 18, fontSize: 24, fontWeight: 600, color: "#c4b5fd", padding: "6px 16px", borderRadius: 999, background: "rgba(167,139,250,0.14)" }}>{kicker}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: long ? 64 : 78, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1040 }}>{title}</div>
          {dek && <div style={{ fontSize: 28, lineHeight: 1.4, color: "#a3c2c0", maxWidth: 1000 }}>{dek.length > 150 ? dek.slice(0, 147).replace(/\s+\S*$/, "") + "…" : dek}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#6f8f8e" }}>
          <span>knowml.vercel.app</span>
          <span style={{ display: "flex", width: 220, height: 6, borderRadius: 3, background: "linear-gradient(90deg,#a78bfa,#f472b6)" }} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: FONTS },
  );
}
