"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function BarButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, compact }: { text: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <BarButton
      title="Copy text"
      aria-label="Copy text"
      className={compact ? "px-2" : undefined}
      onClick={() => {
        navigator.clipboard?.writeText(text.replace(/\s+/g, " ").trim());
        setDone(true);
        setTimeout(() => setDone(false), 1300);
      }}
    >
      {done ? <Check className="size-[15px] text-accent" /> : <Copy className="size-[15px] text-muted" />}
      {!compact && (done ? "Copied" : "Copy")}
    </BarButton>
  );
}

/** A textarea that grows with its content and saves on ⌘/Ctrl+Enter. */
export function Composer({
  initial,
  onSave,
  onCancel,
  saveLabel = "Save",
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus({ preventScroll: true });
    t.setSelectionRange(t.value.length, t.value.length);
  }, []);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 240) + "px";
  }, [text]);
  const empty = !text.trim();
  return (
    <div>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !empty) {
            e.preventDefault();
            onSave(text);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder="Write a comment…"
        rows={2}
        className="block w-full resize-none rounded-lg border border-line-2 bg-bg px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="hidden text-[11px] text-faint sm:inline">
          <kbd className="font-mono">⌘↵</kbd> to save · <kbd className="font-mono">Esc</kbd> to cancel
        </span>
        <span className="flex-1" />
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(text)}
          disabled={empty && !initial}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export function IconButton({
  children,
  label,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-muted transition-colors",
        danger ? "hover:bg-machine/12 hover:text-machine" : "hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
