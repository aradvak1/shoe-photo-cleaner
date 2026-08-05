import type { PhotoTemplate, PhotoTemplateRow } from "@/lib/photoTemplate";

/**
 * POSTs a from-scratch layout to /api/templates, saving it to the shared
 * template library. Used by both the standalone /templates builder and the
 * per-photo design canvas's "build new template" path — a layout built
 * inline while designing one photo always gets saved here too, so it's
 * immediately reusable on other photos rather than a disposable one-off.
 */
export async function saveTemplate(layout: PhotoTemplate, name: string): Promise<PhotoTemplateRow> {
  const res = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      logo: layout.logo ?? null,
      model_number: layout.modelNumber ?? null,
      price: layout.price ?? null,
      sizes: layout.sizes ?? null,
      color: layout.color ?? null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "השמירה נכשלה");
  return data.template as PhotoTemplateRow;
}
