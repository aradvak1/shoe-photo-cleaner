"use client";

import { useEffect, useRef, useState } from "react";
import { LogoSelect } from "@/components/LogoSelect";
import { MetadataFieldPicker } from "@/components/create/PhotoMetadataFields";
import { PresetBar } from "@/components/create/PresetBar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DraggableOverlay } from "@/components/design/DraggableOverlay";
import { useDragResizeLayout, FIELD_LABELS, TEXT_FIELD_KEYS } from "@/hooks/useDragResizeLayout";
import type { DraggableField, TextFieldKey } from "@/hooks/useDragResizeLayout";
import type { CreationRow } from "@/hooks/useImageCreationQueue";
import { findTemplate, mergeLayout, PHOTO_TEMPLATES } from "@/lib/photoTemplate";
import type { PhotoTemplate, TemplateLogoField, TemplateTextField } from "@/lib/photoTemplate";
import { saveTemplate } from "@/lib/templateApi";
import type { Logo, PhotoMode, Preset } from "@/types";

const NEW_TEMPLATE_VALUE = "__new__";

// Same starting slot positions/sizes as the standalone /templates builder —
// used only while building a brand-new template inline (buildingNew), as
// both the initial placement for a freshly-toggled field and the "100%"
// reference for its size slider.
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

const emptyDraft: PhotoTemplate = { id: "draft", label: "" };

/**
 * Stage B: the per-photo design canvas. Opened for exactly one AI-clean row
 * at a time — pick an existing template (built-in or saved) or build a new
 * one from scratch right here (reusing the same drag/resize mechanics the
 * standalone /templates builder uses, via useDragResizeLayout), fill in
 * this photo's own fields, and confirm to burn it. A from-scratch build is
 * always named and saved to the shared template library as part of
 * confirming, so it's immediately available for other photos too.
 *
 * The caller must render this keyed by `row?.id` (e.g.
 * `key={row?.id ?? "none"}`) — switching rows should reset this
 * component's local state (buildingNew/draft/draftName/confirmError)
 * instead of carrying one row's in-progress draft over to another, and a
 * key change is the idiomatic way to get that reset via a fresh mount
 * rather than a setState-in-effect.
 */
export function PhotoDesignDialog({
  row,
  open,
  onClose,
  mode,
  updateRow,
  confirmDesign,
  logos,
  onLogoAdded,
  dbTemplates,
  refreshDbTemplates,
  customPrompt,
}: {
  row: CreationRow | null;
  open: boolean;
  onClose: () => void;
  mode: PhotoMode;
  updateRow: (id: string, patch: Partial<CreationRow>) => void;
  confirmDesign: (rowId: string, overrides?: Partial<CreationRow>) => Promise<void>;
  logos: Logo[];
  onLogoAdded: (logo: Logo) => void;
  dbTemplates: PhotoTemplate[];
  refreshDbTemplates: () => Promise<void>;
  customPrompt: string;
}) {
  const [buildingNew, setBuildingNew] = useState(false);
  const [draft, setDraft] = useState<PhotoTemplate>(emptyDraft);
  const [draftName, setDraftName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedTemplate: PhotoTemplate | null = buildingNew
    ? draft
    : row
      ? (findTemplate(row.templateId) ?? dbTemplates.find((t) => t.id === row.templateId) ?? null)
      : null;
  const effectiveLayout: PhotoTemplate | null = !row || !selectedTemplate
    ? null
    : buildingNew
      ? draft
      : mergeLayout(selectedTemplate, row.customLayout);

  const { beginDrag, setLogoScale, setFieldScale } = useDragResizeLayout({
    containerRef: canvasRef,
    getFieldValue: (field) => effectiveLayout?.[field],
    getReferenceField: (field) =>
      buildingNew ? (field === "logo" ? DEFAULT_LOGO : DEFAULT_TEXT[field]) : selectedTemplate?.[field],
    setField: (field, value) => {
      if (buildingNew) {
        setDraft((prev) => ({ ...prev, [field]: value }));
      } else if (row) {
        updateRow(row.id, { customLayout: { ...row.customLayout, [field]: value } });
      }
    },
  });

  function toggleDraftField(field: DraggableField) {
    setDraft((prev) => {
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

  function isFieldActive(field: TextFieldKey): boolean {
    if (!row || !effectiveLayout?.[field]) return false;
    // While building a template from scratch, a toggled-on slot is
    // draggable regardless of whether THIS photo happens to have a value
    // for it yet — you're designing the template's shape (for use on many
    // future photos), not just this one photo's caption.
    if (buildingNew) return true;
    if (field === "modelNumber") return Boolean(row.modelNumber);
    if (field === "price") return Boolean(row.price);
    if (field === "sizes") return Boolean(row.sizeMin || row.sizeMax);
    return Boolean(row.color);
  }

  const activeTextFields: Partial<Record<TextFieldKey, TemplateTextField>> = {};
  if (effectiveLayout) {
    TEXT_FIELD_KEYS.forEach((f) => {
      if (isFieldActive(f)) activeTextFields[f] = effectiveLayout[f];
    });
  }

  // Live-renders exactly what confirming would burn — template/logo/fields
  // on top of the already AI-clean photo, plus the zoom crop. Unlike the
  // old pre-AI design step, this is a pure render (no AI call), so it can
  // be re-previewed freely while trying different templates/positions.
  //
  // Skipped entirely while buildingNew: a from-scratch draft has no
  // template_id yet (it isn't saved until confirm), and preview-overlay
  // only knows how to resolve a real template id — passing none would
  // silently fall back to auto-placement, rendering burned text in the
  // wrong spot and misleading the user about where their draft's fields
  // will actually end up. DraggableOverlay's own drag boxes (with a
  // placeholder value, same as the standalone /templates builder) are the
  // only preview while building; the real render only exists once saved.
  useEffect(() => {
    if (!row || !row.imageUrl || !open || buildingNew) return;
    const r = row;
    const templateIdForPreview = r.templateId;
    const customLayoutForPreview = r.customLayout;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/preview-overlay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: r.imageUrl,
            modelNumber: r.modelNumber || null,
            sku: r.sku || null,
            price: r.price ? Number(r.price) : null,
            sizeMin: r.sizeMin ? Number(r.sizeMin) : null,
            sizeMax: r.sizeMax ? Number(r.sizeMax) : null,
            color: r.color || null,
            logo_id: r.logoId || null,
            template_id: templateIdForPreview || null,
            zoom: r.zoom,
            custom_layout: customLayoutForPreview,
          }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = url;
        setPreviewUrl(url);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    row?.id,
    row?.imageUrl,
    row?.modelNumber,
    row?.sku,
    row?.price,
    row?.sizeMin,
    row?.sizeMax,
    row?.color,
    row?.logoId,
    row?.zoom,
    row?.templateId,
    row?.customLayout,
    buildingNew,
    draft,
    open,
  ]);

  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  async function handleConfirm() {
    if (!row) return;
    setConfirmError(null);
    setConfirming(true);
    try {
      if (buildingNew) {
        if (!draftName.trim()) throw new Error("צריך לתת שם לתבנית לפני השמירה");
        const saved = await saveTemplate(draft, draftName.trim());
        await refreshDbTemplates();
        await confirmDesign(row.id, { templateId: saved.id, customLayout: {} });
      } else {
        await confirmDesign(row.id);
      }
      onClose();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setConfirming(false);
    }
  }

  function handlePresetApply(preset: Preset) {
    if (!row) return;
    setBuildingNew(false);
    updateRow(row.id, {
      templateId: preset.template_id ?? "",
      modelNumber: preset.model_number ?? "",
      sku: preset.sku ?? "",
      price: preset.price != null ? String(preset.price) : "",
      sizeMin: preset.size_min != null ? String(preset.size_min) : "",
      sizeMax: preset.size_max != null ? String(preset.size_max) : "",
      color: preset.color ?? "",
      logoId: preset.logo_id ?? row.logoId,
      zoom: preset.zoom ?? 100,
      customLayout: preset.custom_layout ?? {},
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={row ? `עיצוב: ${row.modelNumber || row.file.name}` : "עיצוב"}
      size="lg"
    >
      {row && (
        <div className="grid gap-6 md:grid-cols-2">
          <div ref={canvasRef} className="relative select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? row.imageUrl ?? row.originalPreviewUrl}
              alt={row.file.name}
              className="w-full rounded-sm border border-border bg-white object-contain"
              draggable={false}
            />
            {previewLoading && (
              <div className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-xs text-white">
                מעדכן תצוגה מקדימה…
              </div>
            )}
            <DraggableOverlay
              logo={(buildingNew || row.logoId) ? effectiveLayout?.logo : undefined}
              textFields={activeTextFields}
              onBeginDrag={beginDrag}
              textFieldContent={
                buildingNew
                  ? (field, value) => `${value.label}${PLACEHOLDER_VALUES[field]}`
                  : undefined
              }
            />
          </div>

          <div className="space-y-4">
            <PresetBar
              mode={mode}
              disabled={false}
              currentPrompt={customPrompt}
              currentLogoId={row.logoId}
              currentBurnText={true}
              currentTemplateId={row.templateId}
              currentDefaults={row}
              currentZoom={row.zoom}
              currentCustomLayout={row.customLayout}
              onApply={handlePresetApply}
            />

            <Select
              label="תבנית תמונה"
              value={buildingNew ? NEW_TEMPLATE_VALUE : row.templateId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === NEW_TEMPLATE_VALUE) {
                  setBuildingNew(true);
                  setDraft(emptyDraft);
                  setDraftName("");
                } else {
                  setBuildingNew(false);
                  // A different template has different base positions —
                  // dragged overrides from the previous one would land in
                  // the wrong spot, so start fresh.
                  updateRow(row.id, { templateId: v, customLayout: {} });
                }
              }}
            >
              <option value="">ללא תבנית (מיקום אוטומטי לפי התמונה)</option>
              {PHOTO_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              {dbTemplates.length > 0 && (
                <optgroup label="תבניות שלי">
                  {dbTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={NEW_TEMPLATE_VALUE}>+ בניית תבנית חדשה</option>
            </Select>

            {buildingNew && (
              <div className="space-y-2 rounded-sm border border-border p-3">
                <p className="text-xs font-medium text-muted">שדות בתבנית החדשה</p>
                <div className="flex flex-wrap gap-2">
                  {(["logo", ...TEXT_FIELD_KEYS] as DraggableField[]).map((field) => (
                    <Button
                      key={field}
                      type="button"
                      variant={draft[field] ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => toggleDraftField(field)}
                    >
                      {FIELD_LABELS[field]}
                    </Button>
                  ))}
                </div>
                <Input
                  label="שם התבנית החדשה"
                  placeholder='לדוגמה: "תבנית 1"'
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
                <p className="text-[10px] text-muted">
                  התבנית תישמר לספריית התבניות שלכם ברגע שתאשרו את העיצוב, וגם תהיה זמינה לתמונות אחרות.
                </p>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>גודל המוצר בתוך התמונה</span>
                <span>{row.zoom}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={160}
                step={5}
                value={row.zoom}
                onChange={(e) => updateRow(row.id, { zoom: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted">לוגו</p>
              <LogoSelect
                logos={logos}
                value={row.logoId}
                onChange={(logoId) => updateRow(row.id, { logoId })}
                onLogoAdded={onLogoAdded}
              />
              {row.logoId && effectiveLayout?.logo && selectedTemplate?.logo && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                    <span>גודל הלוגו</span>
                    <span>
                      {Math.round(
                        (effectiveLayout.logo.widthFraction / selectedTemplate.logo.widthFraction) * 100
                      )}
                      %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    step={5}
                    value={Math.round(
                      (effectiveLayout.logo.widthFraction / selectedTemplate.logo.widthFraction) * 100
                    )}
                    onChange={(e) => setLogoScale(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted">פרטים על התמונה</p>
              <MetadataFieldPicker
                values={row}
                onChange={(patch) => updateRow(row.id, patch)}
                logos={logos}
                onLogoAdded={onLogoAdded}
                burnsPrice={Boolean(effectiveLayout?.price)}
              />
              {effectiveLayout && (
                <>
                  <p className="mt-2 text-[10px] text-muted">
                    ניתן לגרור את הלוגו ואת התוויות (דגם/מחיר/מידות/צבע) ישירות על התמונה כדי להזיז אותם.
                  </p>
                  <div className="mt-2 space-y-2">
                    {TEXT_FIELD_KEYS.filter(isFieldActive).map((field) => {
                      const current = effectiveLayout[field]!.fontSizeFraction;
                      const base = selectedTemplate?.[field]?.fontSizeFraction;
                      if (!base) return null;
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
                  </div>
                </>
              )}
            </div>

            {confirmError && <p className="text-sm text-danger">{confirmError}</p>}
            <Button onClick={handleConfirm} disabled={confirming} className="w-full">
              {confirming ? "מאשר…" : row.designed ? "עדכון העיצוב" : "אישור עיצוב לתמונה זו"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
