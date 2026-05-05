"use client";

import { useEffect } from "react";

const SUFFIX = "Projectly";
export const PAGE_TITLE_EVENT = "projectly:page-title";

export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.title;
    const next = title ? `${title} · ${SUFFIX}` : SUFFIX;
    document.title = next;
    window.dispatchEvent(
      new CustomEvent(PAGE_TITLE_EVENT, { detail: { title: next } })
    );
    return () => {
      document.title = prev;
      window.dispatchEvent(
        new CustomEvent(PAGE_TITLE_EVENT, { detail: { title: prev } })
      );
    };
  }, [title]);
}
