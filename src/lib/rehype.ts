import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode, { type Options } from "rehype-pretty-code";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

/* Dual themes so the toggle is a CSS swap, not a re-highlight. The CSS in
   globals.css picks --shiki-dark or --shiki-light off each token. */
const prettyCode: Options = {
  theme: { dark: "github-dark-default", light: "github-light-default" },
  keepBackground: false,
  /* Blocks default to C++, the house language. Inline code is left alone:
     highlighting `count++` in the middle of a sentence as C++ made every
     inline span a different colour from the words around it. */
  defaultLang: { block: "cpp" },
};

export const mdxOptions: {
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
} = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: "wrap", properties: { className: "no-underline" } }],
    [rehypePrettyCode, prettyCode],
  ],
};
