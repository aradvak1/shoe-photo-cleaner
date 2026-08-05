"use client";

import { useCallback, useEffect, useState } from "react";
import { rowToTemplate } from "@/lib/photoTemplate";
import type { PhotoTemplate, PhotoTemplateRow } from "@/lib/photoTemplate";

/** Templates designed in-app via /templates, layered alongside the
 * built-in PHOTO_TEMPLATES array wherever a template picker is shown. */
export function useDbTemplates() {
  const [templates, setTemplates] = useState<PhotoTemplate[]>([]);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data: { templates?: PhotoTemplateRow[] }) => {
        setTemplates((data.templates ?? []).map(rowToTemplate));
      });
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (!res.ok) return;
    const data: { templates?: PhotoTemplateRow[] } = await res.json();
    setTemplates((data.templates ?? []).map(rowToTemplate));
  }, []);

  return { templates, refresh };
}
