"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PAGE_TITLE_EVENT } from "@/hooks/use-page-title";

const SUFFIX = " · Projectly";
const FALLBACK = "Projectly";
const PLACEHOLDERS = new Set([
  "Loading project…",
  "Loading task…",
  "Loading…",
  "Project not found",
  "Task not found",
]);

function readTitle(raw?: string): string {
  const t = raw ?? (typeof document !== "undefined" ? document.title : "");
  if (!t) return FALLBACK;
  const stripped = t.endsWith(SUFFIX) ? t.slice(0, -SUFFIX.length) : t;
  if (!stripped || PLACEHOLDERS.has(stripped)) return FALLBACK;
  return stripped;
}

export function DashboardHeaderTitle() {
  const pathname = usePathname();
  const [title, setTitle] = useState<string>(FALLBACK);

  useEffect(() => {
    setTitle(readTitle());
  }, [pathname]);

  useEffect(() => {
    function onTitleChange(e: Event) {
      const detail = (e as CustomEvent<{ title?: string }>).detail;
      setTitle(readTitle(detail?.title));
    }
    window.addEventListener(PAGE_TITLE_EVENT, onTitleChange);
    return () => window.removeEventListener(PAGE_TITLE_EVENT, onTitleChange);
  }, []);

  return (
    <span className="truncate text-base font-semibold tracking-tight text-foreground">
      {title}
    </span>
  );
}
