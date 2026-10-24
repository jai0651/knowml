import type { Metadata } from "next";

/* One place for the facts every page's metadata repeats. */
export const SITE = {
  url: "https://knowml.vercel.app",
  name: "KnowML",
  title: "KnowML: machine learning, explained from first principles",
  description:
    "A free, in-depth course on machine learning: the maths, classical ML, neural networks, transformers, LLMs, generative models and the systems that train and serve them, taught step by step with runnable examples.",
  keywords: [
    "machine learning", "deep learning", "transformers", "large language models",
    "LLM inference", "ML system design", "neural networks", "learn machine learning",
    "ML interview preparation",
  ],
};

/** Canonical URL plus share-card tags for a page. Pages that set none inherit
 *  the layout's, which name the homepage, so a shared link to /labs would
 *  preview as the homepage and tell crawlers it's a copy of "/". */
export function pageMeta(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE.name, locale: "en_US", url: path, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}
