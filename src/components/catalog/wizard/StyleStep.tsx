"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { Reveal } from "@/components/motion/Reveal";
import { CATALOG_STYLE_CATEGORIES, looksForCategory } from "@/lib/catalogLooks";
import type { CatalogLook } from "@/lib/catalogLooks";
import type { CatalogStyleCategory } from "@/types";

export function StyleStep({
  category,
  look,
  freeText,
  onCategoryChange,
  onLookChange,
  onFreeTextChange,
  onNext,
}: {
  category: CatalogStyleCategory | null;
  look: CatalogLook | null;
  freeText: string;
  onCategoryChange: (category: CatalogStyleCategory) => void;
  onLookChange: (look: CatalogLook | null) => void;
  onFreeTextChange: (text: string) => void;
  onNext: () => void;
}) {
  const [previewLook, setPreviewLook] = useState<CatalogLook | null>(null);
  const looks = category ? looksForCategory(category) : [];
  // A style choice needs SOME direction — either a picked example or the
  // user's own free text describing the character they want.
  const canContinue = Boolean(category) && (Boolean(look) || freeText.trim().length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">בחירת סגנון לקטלוג</h1>
        <p className="mt-1 text-sm text-muted">
          הסגנון שתבחרו כאן ישפיע ישירות על יצירת התמונות עצמן בשלב הבא — לא רק על העיצוב הסופי.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">קטגוריה</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {CATALOG_STYLE_CATEGORIES.map((cat, i) => (
            <Reveal key={cat.id} index={i}>
              <Card
                interactive
                onClick={() => onCategoryChange(cat.id)}
                className={category === cat.id ? "border-accent ring-1 ring-accent" : ""}
              >
                <CardBody>
                  <p className="font-medium">{cat.label}</p>
                  <p className="mt-1 text-xs text-muted">{cat.description}</p>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>

      {category && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">
            דוגמאות (לא חובה לבחור — אפשר גם רק מלל חופשי למטה)
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {looks.map((l, i) => (
              <Reveal key={l.id} index={i}>
                <Card
                  className={`overflow-hidden ${
                    look?.id === l.id ? "border-accent ring-1 ring-accent" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewLook(l)}
                    className="block w-full"
                    title="תצוגה מקדימה"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.thumbnail} alt={l.label} className="h-40 w-full object-cover" />
                  </button>
                  <CardBody>
                    <p className="font-medium">{l.label}</p>
                    <p className="mt-1 text-xs text-muted">{l.description}</p>
                    <Button
                      size="sm"
                      variant={look?.id === l.id ? "primary" : "secondary"}
                      className="mt-3 w-full"
                      onClick={() => onLookChange(look?.id === l.id ? null : l)}
                    >
                      {look?.id === l.id ? "נבחר ✓" : "בחירת הדוגמה הזו"}
                    </Button>
                  </CardBody>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      )}

      <Textarea
        label="מלל חופשי — האופי המדויק שאתם רוצים"
        caption='אפשר בנוסף לדוגמה שנבחרה למעלה, או לבד. לדוגמה: "צילומים בעיר שמזכירה את אירופה, בגווני חום וכתום"'
        placeholder='לדוגמה: "צילומים בים" או "עיר אירופאית, גווני חום וכתום"'
        value={freeText}
        onChange={(e) => onFreeTextChange(e.target.value)}
        rows={2}
      />

      <Button onClick={onNext} disabled={!canContinue}>
        המשך לעריכת תמונות
      </Button>

      <Dialog
        open={previewLook !== null}
        onClose={() => setPreviewLook(null)}
        title={previewLook?.label ?? "דוגמה"}
        size="lg"
      >
        {previewLook && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewLook.thumbnail}
              alt={previewLook.label}
              className="max-h-[70vh] w-full rounded-sm object-contain"
            />
            <p className="text-sm text-muted">{previewLook.description}</p>
            <Button
              className="w-full"
              onClick={() => {
                onLookChange(previewLook);
                setPreviewLook(null);
              }}
            >
              בחירת הדוגמה הזו
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
