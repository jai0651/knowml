import katex from "katex";
import { createHighlighter, type Highlighter } from "shiki";

/* Chapters arrive as HTML bodies with raw TeX in them and unhighlighted code.
   The old site fixed both in the browser, after load, with KaTeX auto-render
   and a highlighter script, so every page reflowed once the maths appeared.
   Doing it here, at build time, ships finished HTML instead. */

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&");

let hl: Promise<Highlighter> | null = null;
function highlighter() {
  hl ??= createHighlighter({
    themes: ["github-dark-default", "github-light-default"],
    langs: ["python", "bash"],
  });
  return hl;
}

/** Shell if it reads like a terminal session, otherwise Python, which is what
 *  nearly every Try it block on the site is. */
function langOf(code: string): "bash" | "python" {
  const first = code.trimStart().split("\n")[0];
  if (/^(\$ |pip |curl |git |npm |ollama |llama|vllm |docker |nvidia-smi|export |cd |#!\/bin\/(ba)?sh)/.test(first)) return "bash";
  return "python";
}

function tex(src: string, display: boolean): string {
  try {
    return katex.renderToString(unescape(src), { displayMode: display, throwOnError: false, strict: false, output: "html" });
  } catch {
    return src;
  }
}

export async function renderChapterHtml(body: string): Promise<string> {
  const h = await highlighter();

  /* Code first, and park it behind placeholders so a `$` in a shell prompt or
     an f-string is never mistaken for maths. */
  const parked: string[] = [];
  let out = body.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, code: string) => {
    const raw = unescape(code);
    const html = h.codeToHtml(raw, {
      lang: langOf(raw),
      themes: { dark: "github-dark-default", light: "github-light-default" },
      defaultColor: false,
    });
    parked.push(html);
    return `\u0000${parked.length - 1}\u0000`;
  });
  out = out.replace(/<code>([\s\S]*?)<\/code>/g, (m) => {
    parked.push(m);
    return `\u0000${parked.length - 1}\u0000`;
  });

  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => tex(t, true));
  out = out.replace(/\$([^$\n]+?)\$/g, (_, t: string) => tex(t, false));

  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => parked[Number(i)]);
}
