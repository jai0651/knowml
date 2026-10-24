import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/* Open to every crawler, search and AI alike: the point of the site is to
   be found. The JSON endpoints aren't content, so they're left out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
