"use client";

import { Button } from "@/components/ui/Button";
import { PhotoWorkflow } from "@/components/create/PhotoWorkflow";
import { CATALOG_STYLE_CATEGORIES } from "@/lib/catalogLooks";
import type { CatalogStyleCategory, PhotoMode } from "@/types";

export function PhotosStep({
  category,
  resolvedPrompt,
  onBack,
  onSaved,
}: {
  category: CatalogStyleCategory;
  resolvedPrompt: string;
  onBack: () => void;
  onSaved: (batchId: string) => void;
}) {
  const categoryMeta = CATALOG_STYLE_CATEGORIES.find((c) => c.id === category)!;
  // Only two generation modes exist today (studio = plain backdrop, no
  // model; atmosphere = human model + scene) — "atmosphere" and
  // "studio_model" both need a model, so both route through the atmosphere
  // endpoint, differing only in the resolved prompt's scene description.
  const mode: PhotoMode = categoryMeta.endpoint === "/api/process-atmosphere" ? "atmosphere" : "studio";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          גררו את כל תמונות הנעליים לעריכה יחד — כולן ייצרו באותו סגנון שנבחר בשלב הקודם, אחרי אישור דוגמה
          אחת. לאחר מכן תוכלו לעצב כל תמונה בנפרד.
        </p>
        <Button variant="ghost" size="sm" onClick={onBack}>
          חזרה לבחירת סגנון
        </Button>
      </div>
      <PhotoWorkflow
        mode={mode}
        endpoint={categoryMeta.endpoint}
        initialPrompt={resolvedPrompt}
        onSaved={onSaved}
      />
    </div>
  );
}
