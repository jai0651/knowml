import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Chapters used to be static files at /topics/NN-slug.html, and those URLs
     are in search indexes, bookmarks and shared links. They are routes now, so
     each old address redirects permanently to its new one. */
  async redirects() {
    return [
      { source: "/topics/:slug(\\d{2}-[a-z0-9-]+)\\.html", destination: "/topics/:slug", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/sections.html", destination: "/sections", permanent: true },
      /* The tools that used to be standalone pages are routes now too. */
      { source: "/:lab(attention-lab|backprop-lab|tokenizer-lab|sampling-lab|quantization-lab)\\.html", destination: "/labs/:lab", permanent: true },
      { source: "/labs.html", destination: "/labs", permanent: true },
      { source: "/review.html", destination: "/review", permanent: true },
      { source: "/roadmaps.html", destination: "/roadmaps", permanent: true },
      { source: "/practice.html", destination: "/practice", permanent: true },
      { source: "/map.html", destination: "/map", permanent: true },
      { source: "/admin.html", destination: "/admin", permanent: true },
      { source: "/topics/technique-map.html", destination: "/technique-map", permanent: true },
    ];
  },
};

export default nextConfig;
