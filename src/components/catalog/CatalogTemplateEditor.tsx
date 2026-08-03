"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { CATALOG_TEMPLATE_META } from "@/lib/pdf/templates/meta";

export function CatalogTemplateEditor({
  catalogId,
  currentTemplateId,
}: {
  catalogId: string;
  currentTemplateId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(currentTemplateId);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalogs/${catalogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "העדכון נכשל");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        עריכה
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="עריכת קטלוג">
        <div className="space-y-4">
          <Select
            label="תבנית עמודי המוצרים"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {CATALOG_TEMPLATE_META.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted">
            שינוי התבנית יבנה מחדש את קובץ ה-PDF מאותן התמונות, ללא צורך לבחור אותן שוב.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={apply} disabled={applying} className="w-full">
            {applying ? "בונה מחדש…" : "עדכון PDF"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
