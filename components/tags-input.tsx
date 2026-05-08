"use client";

import { useRef, useState } from "react";
import { Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagsInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add tag — Enter to add",
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function normalize(s: string) {
    return s.trim();
  }

  function add(tag: string) {
    const t = normalize(tag);
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  const q = draft.trim().toLowerCase();
  const filtered = suggestions
    .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    .filter((s) => (!q ? true : s.toLowerCase().includes(q)))
    .slice(0, 8);

  const showCreate =
    q.length > 0 &&
    !suggestions.some((s) => s.toLowerCase() === q) &&
    !value.some((v) => v.toLowerCase() === q);

  const open = focused && (filtered.length > 0 || showCreate);

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm shadow-none",
          focused && "border-primary/60 ring-1 ring-primary/30"
        )}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-xs"
          >
            <Tag className="size-3 text-muted-foreground" />
            {tag}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                remove(tag);
              }}
              aria-label={`Remove ${tag}`}
              className="ml-0.5 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 100);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Escape") {
              setFocused(false);
              inputRef.current?.blur();
            } else if (
              e.key === "Backspace" &&
              draft.length === 0 &&
              value.length > 0
            ) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
                inputRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <Tag className="size-3 text-muted-foreground" />
              {s}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(draft);
                inputRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-primary hover:bg-primary/10"
            >
              <Tag className="size-3" />
              Create &quot;{draft.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
