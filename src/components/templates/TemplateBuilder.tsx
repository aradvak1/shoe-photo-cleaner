"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useDbTemplates } from "@/hooks/useDbTemplates";
import type { PhotoTemplate, TemplateLogoField, TemplateTextField } from "@/lib/photoTemplate";

type FieldKey = "logo" | "modelNumber" | "price" | "sizes" | "color";
type TextFieldKey = Exclude<FieldKey, "logo">;

const FIELD_LABELS: Record<FieldKey, string> = {
  logo: "לוגו",
  modelNumber: "דגם",
  price: "מחיר",
  sizes: "מידות",
  color: "צבע",
};

const TEXT_FIELDS: TextFieldKey[] = ["modelNumber", "price", "sizes", "color"];

// Starting point/size for a field the moment it's toggled on — stacked in
// the bottom-right corner (matching the built-in grazia-donna layout's
// general shape) so a fresh template already looks reasonable before any
// dragging happens. Also doubles as the 100% reference for each field's
// size slider, same role baseTemplate plays in StudioDesignFlow.
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

  function toggleField(field: FieldKey) {
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

  // Same imperative-attach pattern proven in StudioDesignFlow: the
  // pointermove/pointerup listeners are wired up directly inside this
  // pointerdown handler (not a useEffect keyed on drag state), which is
  // what makes drags land reliably instead of intermittently dropping.
  function beginDrag(field: FieldKey, e: React.PointerEvent) {
    if (!canvasRef.current) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const rectWidth = rect.width;
    const rectHeight = rect.height;
    const base = layout[field];
    if (!base) return;

    function clamp(value: number, min: number, max: number) {
      return Math.min(max, Math.max(min, value));
    }
    function onMove(ev: PointerEvent) {
      const dxFrac = (ev.clientX - startX) / rectWidth;
      const dyFrac = (ev.clientY - startY) / rectHeight;
      if (field === "logo") {
        const logoBase = base as TemplateLogoField;
        const logo = {
          ...logoBase,
          leftFraction: clamp(logoBase.leftFraction + dxFrac, 0, 1 - logoBase.widthFraction),
          topFraction: clamp(logoBase.topFraction + dyFrac, 0, 1 - logoBase.heightFraction),
        };
        setLayout((prev) => ({ ...prev, logo }));
      } else {
        const fieldBase = base as TemplateTextField;
        const updated = {
          ...fieldBase,
          centerXFraction: clamp(fieldBase.centerXFraction + dxFrac, 0, 1),
          centerYFraction: clamp(fieldBase.centerYFraction + dyFrac, 0, 1),
        };
        setLayout((prev) => ({ ...prev, [field]: updated }));
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function setLogoScale(percent: number) {
    setLayout((prev) => {
      if (!prev.logo) return prev;
      const factor = percent / 100;
      const newWidth = DEFAULT_LOGO.widthFraction * factor;
      const newHeight = DEFAULT_LOGO.heightFraction * factor;
      const centerX = prev.logo.leftFraction + prev.logo.widthFraction / 2;
      const centerY = prev.logo.topFraction + prev.logo.heightFraction / 2;
      return {
        ...prev,
        logo: {
          leftFraction: centerX - newWidth / 2,
          topFraction: centerY - newHeight / 2,
          widthFraction: newWidth,
          heightFraction: newHeight,
        },
      };
    });
  }

  function setFieldScale(field: TextFieldKey, percent: number) {
    setLayout((prev) => {
      const base = prev[field];
      if (!base) return prev;
      const factor = percent / 100;
      return { ...prev, [field]: { ...base, fontSizeFraction: DEFAULT_TEXT[field].fontSizeFraction * factor } };
    });
  }

  function resetCanvas() {
    setLayout(emptyLayout);
    setName("");
    setSaveMessage(null);
    setSaveError(null);
  }

  async function saveTemplate() {
    if (!name.trim()) {
      setSaveError("צריך לתת שם לתבנית");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          logo: layout.logo ?? null,
          model_number: layout.modelNumber ?? null,
          price: layout.price ?? null,
          sizes: layout.sizes ?? null,
          color: layout.color ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "השמירה נכשלה");
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

  const activeFields = (["logo", ...TEXT_FIELDS] as FieldKey[]).filter((f) => Boolean(layout[f]));

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
            {layout.logo && (
              <div
                onPointerDown={(e) => beginDrag("logo", e)}
                title="גררו כדי להזיז את הלוגו"
                className="absolute cursor-move rounded-sm border-2 border-dashed border-accent/80 bg-accent/10 hover:bg-accent/20"
                style={{
                  left: `${layout.logo.leftFraction * 100}%`,
                  top: `${layout.logo.topFraction * 100}%`,
                  width: `${layout.logo.widthFraction * 100}%`,
                  height: `${layout.logo.heightFraction * 100}%`,
                }}
              >
                <span className="absolute -top-5 right-0 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] text-[#1c1108]">
                  לוגו
                </span>
              </div>
            )}
            {TEXT_FIELDS.filter((f) => layout[f]).map((field) => {
              const value = layout[field]!;
              return (
                <div
                  key={field}
                  onPointerDown={(e) => beginDrag(field, e)}
                  title="גררו כדי להזיז"
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border border-accent bg-ink/80 px-2 py-0.5 text-[10px] whitespace-nowrap text-white hover:bg-ink"
                  style={{
                    left: `${value.centerXFraction * 100}%`,
                    top: `${value.centerYFraction * 100}%`,
                  }}
                >
                  {value.label}
                  {field === "modelNumber" ? "1234" : field === "price" ? "199" : field === "sizes" ? "36-40" : "שחור"}
                </div>
              );
            })}
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
                {(["logo", ...TEXT_FIELDS] as FieldKey[]).map((field) => (
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

            {TEXT_FIELDS.filter((f) => layout[f]).map((field) => {
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
                <Button onClick={saveTemplate} disabled={saving || activeFields.length === 0}>
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
