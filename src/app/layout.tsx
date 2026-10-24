import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SITE } from "@/lib/site";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/* Plus Jakarta Sans everywhere, for interface and prose alike: a modern
   humanist sans with open counters that stays readable at 17px over a long
   chapter. JetBrains Mono for code. */
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s · KnowML" },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: SITE.keywords,
  authors: [{ name: "KnowML" }],
  creator: "KnowML",
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    url: "/",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0a16" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaff" },
  ],
};

/* Mode is set before first paint so there's no flash. Dark unless the reader
   has switched to light; their choice is remembered in localStorage. */
const boot = `
try {
  var m = localStorage.getItem("np-theme");
  document.documentElement.setAttribute("data-theme", m === "light" ? "light" : "dark");
} catch (e) {}
`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* The font variables must live on <html>, not <body>. Tailwind declares
       --font-sans: var(--font-inter) at :root, and a nested var() resolves in
       the scope where the OUTER property was declared. With the classes on
       <body>, --font-inter was undefined at :root, --font-sans became invalid,
       the whole font-family declaration dropped, and every page rendered in
       the system font. */
    <html
      lang="en"
      data-theme="dark"
      className={`${jakarta.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body className="min-h-screen">
        {children}
        {/* Page views and referrers, cookieless. Reader notes and streaks
            stay in the browser and are not part of it. */}
        <Analytics />
      </body>
    </html>
  );
}
