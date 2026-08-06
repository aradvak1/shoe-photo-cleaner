"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Downloads every photo in a catalog as a ZIP (+ CSV) via the same
 * /api/export endpoint PhotoWorkflow uses — lets the seller send just the
 * raw images to a customer/WhatsApp group without forwarding the whole PDF.
 * Fetch+blob (not a plain download link) so a failed export shows an error
 * instead of silently downloading a JSON error body as a fake ".zip".
 */
export function ExportImagesButton({ photoIds }: { photoIds: string[] }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/export?ids=${photoIds.join(",")}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error || "הייצוא נכשל");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "catalog-images.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הייצוא נכשל");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={handleExport} disabled={exporting || photoIds.length === 0}>
        {exporting ? "מייצא…" : "הורדת תמונות (ZIP)"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
