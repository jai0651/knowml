"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

const LANG: Record<string, string> = {
  cpp: "C++", c: "C", sh: "Shell", bash: "Shell", shell: "Shell", console: "Shell",
  go: "Go", rust: "Rust", python: "Python", py: "Python", asm: "Assembly",
  js: "JavaScript", ts: "TypeScript", sql: "SQL", ini: "Config", yaml: "YAML",
  json: "JSON", text: "Output", txt: "Output", diff: "Diff", swift: "Swift",
};

/* Every fenced block gets a header with its language and a copy button.
   Copying reads the rendered text, so what lands on the clipboard is exactly
   what's on the page. */
export function CodeBlock(props: React.ComponentProps<"pre"> & { "data-language"?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const [done, setDone] = useState(false);
  const lang = props["data-language"];

  async function copy() {
    const text = ref.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ""));
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {}
  }

  return (
    <div className="code-block group/code relative my-7 overflow-hidden rounded-xl border border-line bg-[var(--code-bg)]">
      <div className="code-head flex h-9 items-center justify-between border-b border-line px-4 text-[11.5px] text-faint">
        <span className="font-medium">{(lang && LANG[lang]) ?? lang ?? "Code"}</span>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 opacity-70 transition hover:bg-surface-2 hover:text-ink hover:opacity-100"
        >
          {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        {...props}
        ref={ref}
        className="overflow-x-auto py-4 text-[13.5px] leading-[1.65]"
      />
    </div>
  );
}
