"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useDbTemplates } from "@/hooks/useDbTemplates";
import { useDragResizeLayout, FIELD_LABELS, TEXT_FIELD_KEYS } from "@/hooks/useDragResizeLayout";
import type { DraggableField, TextFieldKey } from "@/hooks/useDragResizeLayout";
import { DraggableOverlay } from "@/components/design/DraggableOverlay";
import { saveTemplate } from "@/lib/templateApi";
import type { PhotoTemplate, TemplateLogoField, TemplateTextField } from "@/lib/photoTemplate";

// Starting point/size for a field the moment it's toggled on — stacked in
// the bottom-right corner (matching the built-in grazia-donna layout's
// general shape) so a fresh template already looks reasonable before any
// dragging happens. Also doubles as the 100% reference for each field's
// size slider (see useDragResizeLayout's getReferenceField).
const DEFAULT_LOGO: TemplateLogoField = {
  leftFraction: 0.08,
  topFraction: 0.08,
  widthFraction: 0.34,
  heightFraction: 0.26,
};
const DEFAULT_TEXT: Record<TextFieldKey, TemplateTextField> = {
  modelNumber: { centerXFraction: 0.75, centerYFraction: 0.76, fontSizeFraction: 0.055, label: "דגם : " },
  sizes: { centerXFraction: 0.75, centerYFraction: 0.82, fontSizeFraction: 0.042, label: "מידות : " },
  color: { centerXFraction: 0.75, centerYFraction: 0.87, fontSizeFraction: 0.042, label: "צבע : " },
  price: { centerXFraction: 0.75, centerYFraction: 0.92, fontSizeFraction: 0.042, label: "מחיר : " },
};

const PLACEHOLDER_VALUES: Record<TextFieldKey, string> = {
  modelNumber: "1234",
  price: "199",
  sizes: "36-40",
  color: "שחור",
};

const emptyLayout: PhotoTemplate = { id: "draft", label: "" };

export function TemplateBuilder() {
  const { templates: savedTemplates, refresh } = useDbTemplates();
  const [layout, setLayout] = useState<PhotoTemplate>(emptyLayout);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { beginDrag, setLogoScale, setFieldScale } = useDragResizeLayout({
    containerRef: canvasRef,
    getFieldValue: (field) => layout[field],
    getReferenceField: (field) => (field === "logo" ? DEFAULT_LOGO : DEFAULT_TEXT[field]),
    setField: (field, value) => setLayout((prev) => ({ ...prev, [field]: value })),
  });

  function toggleField(field: DraggableField) {
    setLayout((prev) => {
      const next = { ...prev };
      if (next[field]) {
        delete next[field];
        return next;
      }
      if (field === "logo") next.logo = { ...DEFAULT_LOGO };
      else next[field] = { ...DEFAULT_TEXT[field] };
      return next;
    });
  }

  function resetCanvas() {
    setLayout(emptyLayout);
    setName("");
    setSaveMessage(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setSaveError("צריך לתת שם לתבנית");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await saveTemplate(layout, name.trim());
      setSaveMessage(`התבנית "${name.trim()}" נשמרה`);
      await refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    await refresh();
  }

  const activeFields = (["logo", ...TEXT_FIELD_KEYS] as DraggableField[]).filter((f) => Boolean(layout[f]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">בניית תבנית</h1>
        <p className="mt-1 text-sm text-muted">
          התחילו מקנבס לבן, הוסיפו לוגו/דגם/מחיר/מידות/צבע אחד אחד וגררו כל אחד למקום שאתם רוצים —
          בדיוק כמו בקנבה. כשהתבנית מוכנה, שמרו אותה בשם, והיא תופיע לבחירה בכל מקום שיוצרים תמונה או קטלוג.
        </p>
      </div>

      <Card>
        <CardBody className="grid gap-6 md:grid-cols-2">
          <div
            ref={canvasRef}
            className="relative aspect-square w-full select-none rounded-sm border border-border bg-white"
          >
            <DraggableOverlay
              logo={layout.logo}
              textFields={layout}
              onBeginDrag={beginDrag}
              textFieldContent={(field, value) => `${value.label}${PLACEHOLDER_VALUES[field]}`}
            />
            {activeFields.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                בחרו שדה מהצד כדי להתחיל
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">שדות בתבנית</p>
              <div className="flex flex-wrap gap-2">
                {(["logo", ...TEXT_FIELD_KEYS] as DraggableField[]).map((field) => (
                  <Button
                    key={field}
                    type="button"
                    variant={layout[field] ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => toggleField(field)}
                  >
                    {FIELD_LABELS[field]}
                  </Button>
                ))}
              </div>
            </div>

            {layout.logo && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                  <span>גודל הלוגו</span>
                  <span>{Math.round((layout.logo.widthFraction / DEFAULT_LOGO.widthFraction) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={200}
                  step={5}
                  value={Math.round((layout.logo.widthFraction / DEFAULT_LOGO.widthFraction) * 100)}
                  onChange={(e) => setLogoScale(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            )}

            {TEXT_FIELD_KEYS.filter((f) => layout[f]).map((field) => {
              const current = layout[field]!.fontSizeFraction;
              const base = DEFAULT_TEXT[field].fontSizeFraction;
              return (
                <div key={field}>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                    <span>גודל {FIELD_LABELS[field]}</span>
                    <span>{Math.round((current / base) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round((current / base) * 100)}
                    onChange={(e) => setFieldScale(field, Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              );
            })}

            <div className="space-y-2 border-t border-border pt-4">
              <Input
                label="שם התבנית"
                placeholder='לדוגמה: "תבנית 1"'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSave} disabled={saving || activeFields.length === 0}>
                  {saving ? "שומר…" : "שמירת תבנית"}
                </Button>
                <Button variant="secondary" onClick={resetCanvas}>
                  ניקוי הקנבס
                </Button>
              </div>
              {saveError && <p className="text-sm text-danger">{saveError}</p>}
              {saveMessage && <p className="text-sm text-muted">{saveMessage}</p>}
            </div>
          </div>
        </CardBody>
      </Card>

      {savedTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">התבניות השמורות שלי</p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {savedTemplates.map((t) => (
              <Card key={t.id}>
                <CardBody className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">{t.label}</span>
                  <Button
                    variant={confirmDeleteId === t.id ? "danger" : "ghost"}
                    size="sm"
                    className="px-1.5 py-0.5 text-xs"
                    onClick={() => deleteTemplate(t.id)}
                  >
                    {confirmDeleteId === t.id ? "לאשר מחיקה" : "מחיקה"}
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
