import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Chapters used to be static files at /topics/NN-slug.html, and those URLs
     are in search indexes, bookmarks and shared links. They are routes now, so
     each old address redirects permanently to its new one. The technique map
     is still a static file under public/topics/, so the pattern only matches
     numbered chapters. */
  async redirects() {
    return [
      { source: "/topics/:slug(\\d{2}-[a-z0-9-]+)\\.html", destination: "/topics/:slug", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/sections.html", destination: "/sections", permanent: true },
    ];
  },
};

export default nextConfig;
