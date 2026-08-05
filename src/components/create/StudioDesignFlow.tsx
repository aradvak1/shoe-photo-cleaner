"use client";

import { useEffect, useRef, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { LogoSelect, useLogos } from "@/components/LogoSelect";
import { MetadataFieldPicker } from "@/components/create/PhotoMetadataFields";
import { PresetBar } from "@/components/create/PresetBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useDbTemplates } from "@/hooks/useDbTemplates";
import { useImageCreationQueue } from "@/hooks/useImageCreationQueue";
import { downloadFile } from "@/lib/downloadFile";
import { findTemplate, mergeLayout, PHOTO_TEMPLATES } from "@/lib/photoTemplate";
import type { PhotoTemplate, TemplateLogoField, TemplateTextField } from "@/lib/photoTemplate";
import type { Preset } from "@/types";

// The only template defined today — used as the generic starting layout
// when dragging/resizing without an explicit template selected (dragging
// needs *some* fixed base to nudge from). See renderPhoto.ts, which
// falls back to the same template server-side for the actual burn.
const GENERIC_BASE_TEMPLATE_ID = "grazia-donna";
type DraggableField = "logo" | "modelNumber" | "price" | "sizes" | "color";

/**
 * The studio creation screen, redesigned per user request around a single
 * "design toolbar" (modeled on a reference product-card tool they shared):
 * you lay out everything — template, product size/zoom, logo, fields — on
 * the raw uploaded photo BEFORE it ever goes to the AI, with a live
 * preview the whole time. One "אישור ועיבוד" click then runs the AI
 * generation and burns your exact design in a single step, reusing the
 * existing sample-approval flow so the rest of a batch only spends AI
 * credits once you've confirmed the resulting photographic style.
 */
export function StudioDesignFlow() {
  const { logos, setLogos } = useLogos();
  const { templates: dbTemplates } = useDbTemplates();
  const {
    rows,
    updateRow,
    addFiles,
    saveAll,
    saving,
    saveMessage,
    batchId,
    total,
    doneCount,
    readyCount,
    customPrompt,
    setCustomPrompt,
    templateId,
    setTemplateId,
    applyDefaults,
    defaultLogoId,
    setDefaultLogoId,
    startProcessing,
    sample,
    approveSample,
    rejectSample,
    retryRow,
  } = useImageCreationQueue({ endpoint: "/api/process-image", mode: "studio", autoProcess: false });

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [errorRow, setErrorRow] = useState<string | null>(null);

  // The one row currently being designed — always the first not-yet-sent
  // photo. Once the batch's sample is approved, the rest process
  // automatically with these same settings (see hook's startProcessing),
  // so there's never a second design step to show mid-batch.
  const designRow = rows.find((r) => r.status === "pending") ?? null;
  const sampleDialogOpen = sample.phase === "generating" || sample.phase === "awaiting-approval";

  const [designPreviewUrl, setDesignPreviewUrl] = useState<string | null>(null);
  const [designPreviewLoading, setDesignPreviewLoading] = useState(false);
  const designPreviewBlobRef = useRef<string | null>(null);

  const baseTemplate: PhotoTemplate =
    findTemplate(templateId) ??
    dbTemplates.find((t) => t.id === templateId) ??
    findTemplate(GENERIC_BASE_TEMPLATE_ID)!;
  const effectiveLayout: PhotoTemplate = mergeLayout(baseTemplate, designRow?.customLayout);

  // Drag-to-move + slide-to-resize for the logo box and each active text
  // field's position, directly on the live preview — the toolbar's last
  // missing control per the user's request. Position is dragged on the
  // image itself; size is a slider (a corner-resize handle would need the
  // same pixel-to-fraction math twice, and gains little over a slider for
  // fine-tuning a single number).
  const imgRef = useRef<HTMLImageElement>(null);

  // Listeners are attached imperatively, right inside the same pointerdown
  // handler that starts the drag — not via a useEffect keyed on state. An
  // effect-based attach/detach cycle is one render behind the state change
  // that triggers it, and in dev StrictMode's double-invoke that window can
  // occasionally leave two listeners attached at once; attaching directly
  // here removes that whole class of timing issue.
  function beginDrag(field: DraggableField, e: React.PointerEvent) {
    if (!imgRef.current || !designRow) return;
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const rectWidth = rect.width;
    const rectHeight = rect.height;
    const base = effectiveLayout[field];
    if (!base) return;
    const rowId = designRow.id;
    const rowCustomLayout = designRow.customLayout;

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
        updateRow(rowId, { customLayout: { ...rowCustomLayout, logo } });
      } else {
        const fieldBase = base as TemplateTextField;
        const updated = {
          ...fieldBase,
          centerXFraction: clamp(fieldBase.centerXFraction + dxFrac, 0, 1),
          centerYFraction: clamp(fieldBase.centerYFraction + dyFrac, 0, 1),
        };
        updateRow(rowId, { customLayout: { ...rowCustomLayout, [field]: updated } });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function setLogoScale(scalePercent: number) {
    if (!designRow || !baseTemplate.logo || !effectiveLayout.logo) return;
    const factor = scalePercent / 100;
    const newWidth = baseTemplate.logo.widthFraction * factor;
    const newHeight = baseTemplate.logo.heightFraction * factor;
    const centerX = effectiveLayout.logo.leftFraction + effectiveLayout.logo.widthFraction / 2;
    const centerY = effectiveLayout.logo.topFraction + effectiveLayout.logo.heightFraction / 2;
    updateRow(designRow.id, {
      customLayout: {
        ...designRow.customLayout,
        logo: {
          leftFraction: centerX - newWidth / 2,
          topFraction: centerY - newHeight / 2,
          widthFraction: newWidth,
          heightFraction: newHeight,
        },
      },
    });
  }

  function setFieldScale(field: Exclude<DraggableField, "logo">, scalePercent: number) {
    if (!designRow) return;
    const factor = scalePercent / 100;
    const base = baseTemplate[field];
    if (!base) return;
    updateRow(designRow.id, {
      customLayout: {
        ...designRow.customLayout,
        [field]: { ...effectiveLayout[field], fontSizeFraction: base.fontSizeFraction * factor },
      },
    });
  }

  const FIELD_LABELS: Record<Exclude<DraggableField, "logo">, string> = {
    modelNumber: "דגם",
    price: "מחיר",
    sizes: "מידות",
    color: "צבע",
  };
  const TEXT_FIELDS = ["modelNumber", "price", "sizes", "color"] as const;
  function isFieldActive(field: (typeof TEXT_FIELDS)[number]): boolean {
    if (!designRow || !effectiveLayout[field]) return false;
    if (field === "modelNumber") return Boolean(designRow.modelNumber);
    if (field === "price") return Boolean(designRow.price);
    if (field === "sizes") return Boolean(designRow.sizeMin || designRow.sizeMax);
    return Boolean(designRow.color);
  }

  // Live-renders the design row exactly as it'll be sent for approval —
  // template/logo/fields burned on top of the RAW photo, plus the zoom
  // crop — so you see (an approximation of) the final layout before
  // spending anything on AI generation. Approximate because the AI will
  // still swap the background; the product's own size/position stays the
  // same since generation is instructed to preserve it exactly.
  useEffect(() => {
    if (!designRow || !designRow.rawUrl || sampleDialogOpen) return;
    const row = designRow;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setDesignPreviewLoading(true);
      try {
        const res = await fetch("/api/preview-overlay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: row.rawUrl,
            modelNumber: row.modelNumber || null,
            sku: row.sku || null,
            price: row.price ? Number(row.price) : null,
            sizeMin: row.sizeMin ? Number(row.sizeMin) : null,
            sizeMax: row.sizeMax ? Number(row.sizeMax) : null,
            color: row.color || null,
            logo_id: row.logoId || null,
            template_id: templateId || null,
            zoom: row.zoom,
            custom_layout: row.customLayout,
          }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (designPreviewBlobRef.current) URL.revokeObjectURL(designPreviewBlobRef.current);
        designPreviewBlobRef.current = url;
        setDesignPreviewUrl(url);
      } finally {
        if (!cancelled) setDesignPreviewLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    designRow?.id,
    designRow?.rawUrl,
    designRow?.modelNumber,
    designRow?.sku,
    designRow?.price,
    designRow?.sizeMin,
    designRow?.sizeMax,
    designRow?.color,
    designRow?.logoId,
    designRow?.zoom,
    designRow?.customLayout,
    templateId,
    sampleDialogOpen,
  ]);

  useEffect(() => {
    return () => {
      if (designPreviewBlobRef.current) URL.revokeObjectURL(designPreviewBlobRef.current);
    };
  }, []);

  const isProcessing = total > 0 && doneCount < total;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const processedRows = rows.filter((r) => r.status !== "pending");
  const errorRowData = rows.find((r) => r.id === errorRow) ?? null;

  // Any field/logo/zoom change on the design row also seeds the shared
  // defaults, so every other photo in this batch — including ones added
  // later — inherits the exact same design without redoing it per photo.
  function handleFieldChange(patch: Record<string, string>) {
    if (!designRow) return;
    updateRow(designRow.id, patch);
    applyDefaults(patch);
  }

  function handleZoomChange(zoom: number) {
    if (!designRow) return;
    rows.filter((r) => r.status === "pending").forEach((r) => updateRow(r.id, { zoom }));
  }

  // Loading a saved preset reproduces the whole design in one click — the
  // point of "תבנית 1: דגם 100%, מחיר 80%, לוגו 150%" style presets: not
  // just which fields/template, but the exact zoom and drag/resize layout
  // too, applied to every pending photo so a fresh batch is ready
  // immediately without re-doing the design per photo.
  function handlePresetApply(preset: Preset) {
    setCustomPrompt(preset.prompt ?? "");
    setTemplateId(preset.template_id ?? "");
    applyDefaults({
      logoId: preset.logo_id ?? "",
      modelNumber: preset.model_number ?? "",
      sku: preset.sku ?? "",
      price: preset.price != null ? String(preset.price) : "",
      sizeMin: preset.size_min != null ? String(preset.size_min) : "",
      sizeMax: preset.size_max != null ? String(preset.size_max) : "",
      color: preset.color ?? "",
    });
    const zoom = preset.zoom ?? 100;
    const customLayout = preset.custom_layout ?? {};
    rows
      .filter((r) => r.status === "pending")
      .forEach((r) => updateRow(r.id, { zoom, customLayout }));
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/export?batch_id=${batchId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(
          data.error === "No photos found for export"
            ? 'עוד לא שמרתם תמונות מהאצווה הזו — לחצו קודם על "שמירה" למעלה, ורק אז על ייצוא.'
            : data.error || "הייצוא נכשל"
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "catalog-export.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "הייצוא נכשל");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">תמונת סטודיו</h1>
        <p className="mt-1 text-sm text-muted">
          עצבו את התמונה בדיוק כמו שאתם רוצים — תבנית, גודל המוצר, לוגו ופרטים — ורק אז אשרו. האישור
          מריץ את ה-AI וצורב את הכל בבת אחת.
        </p>
      </div>

      <Dropzone multiple label="גררו תמונות נעליים לניקוי" onFiles={addFiles} />

      {designRow && (
        <Card>
          <CardBody className="grid gap-6 md:grid-cols-2">
            <div className="relative select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={designPreviewUrl ?? designRow.rawUrl ?? designRow.originalPreviewUrl}
                alt={designRow.file.name}
                className="w-full rounded-sm border border-border bg-white object-contain"
                draggable={false}
              />
              {designPreviewLoading && (
                <div className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-xs text-white">
                  מעדכן תצוגה מקדימה…
                </div>
              )}
              {!designRow.rawUrl && (
                <div className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-xs text-white">
                  מעלה תמונה…
                </div>
              )}
              {designRow.rawUrl && (
                <>
                  {/* Drag the logo box to reposition it — size is controlled by the slider below, not a resize handle, to keep the drag math to one axis of interaction. */}
                  {designRow.logoId && effectiveLayout.logo && (
                    <div
                      onPointerDown={(e) => beginDrag("logo", e)}
                      title="גררו כדי להזיז את הלוגו"
                      className="absolute cursor-move rounded-sm border-2 border-dashed border-accent/80 bg-accent/10 hover:bg-accent/20"
                      style={{
                        left: `${effectiveLayout.logo.leftFraction * 100}%`,
                        top: `${effectiveLayout.logo.topFraction * 100}%`,
                        width: `${effectiveLayout.logo.widthFraction * 100}%`,
                        height: `${effectiveLayout.logo.heightFraction * 100}%`,
                      }}
                    >
                      <span className="absolute -top-5 right-0 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] text-[#1c1108]">
                        לוגו
                      </span>
                    </div>
                  )}
                  {TEXT_FIELDS.filter(isFieldActive).map((field) => {
                      const layout = effectiveLayout[field]!;
                      return (
                        <div
                          key={field}
                          onPointerDown={(e) => beginDrag(field, e)}
                          title="גררו כדי להזיז"
                          className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border border-accent bg-ink/80 px-2 py-0.5 text-[10px] whitespace-nowrap text-white hover:bg-ink"
                          style={{
                            left: `${layout.centerXFraction * 100}%`,
                            top: `${layout.centerYFraction * 100}%`,
                          }}
                        >
                          {FIELD_LABELS[field]}
                        </div>
                      );
                    })}
                </>
              )}
            </div>

            <div className="space-y-4">
              <PresetBar
                mode="studio"
                disabled={false}
                currentPrompt={customPrompt}
                currentLogoId={designRow.logoId || defaultLogoId}
                currentBurnText={true}
                currentTemplateId={templateId}
                currentDefaults={designRow}
                currentZoom={designRow.zoom}
                currentCustomLayout={designRow.customLayout}
                onApply={handlePresetApply}
              />
              <Select
                label="תבנית תמונה"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  // A different template has different base positions —
                  // dragged overrides from the previous one would land in
                  // the wrong spot, so start fresh.
                  if (designRow) updateRow(designRow.id, { customLayout: {} });
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
              </Select>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span>גודל המוצר בתוך התמונה</span>
                  <span>{designRow.zoom}%</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={160}
                  step={5}
                  value={designRow.zoom}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <p className="mt-1 text-[10px] text-muted">
                  ערך גבוה יותר ממלא יותר את הפריים ומצמצם את הרקע הריק סביב המוצר.
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted">לוגו</p>
                <LogoSelect
                  logos={logos}
                  value={designRow.logoId || defaultLogoId}
                  onChange={setDefaultLogoId}
                  onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
                />
                {designRow.logoId && effectiveLayout.logo && baseTemplate.logo && (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                      <span>גודל הלוגו</span>
                      <span>
                        {Math.round((effectiveLayout.logo.widthFraction / baseTemplate.logo.widthFraction) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={200}
                      step={5}
                      value={Math.round(
                        (effectiveLayout.logo.widthFraction / baseTemplate.logo.widthFraction) * 100
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
                  values={designRow}
                  onChange={handleFieldChange}
                  logos={logos}
                  onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
                  burnsPrice={Boolean(templateId)}
                />
                <p className="mt-2 text-[10px] text-muted">
                  ניתן לגרור את הלוגו ואת התוויות (דגם/מחיר/מידות/צבע) ישירות על התמונה כדי להזיז אותם.
                </p>
                <div className="mt-2 space-y-2">
                  {TEXT_FIELDS.filter(isFieldActive).map((field) => {
                      const current = effectiveLayout[field]!.fontSizeFraction;
                      const base = baseTemplate[field]!.fontSizeFraction;
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
              </div>

              <Textarea
                label="כיוון ל-AI (לא חובה)"
                caption="ההנחיה מתווספת לעיצוב הקבוע (רקע/תאורה), לא מחליפה אותו — אפשר גם לבקש שינוי על הנעל עצמה, כמו יותר צל או ברק."
                placeholder='לדוגמה: "יותר צל מתחת לנעל" או "רקע בז׳ חמים יותר"'
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
              />

              <Button onClick={startProcessing} disabled={!designRow.rawUrl} className="w-full">
                אישור ועיבוד
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {total > 0 && (
        <div className="space-y-1">
          <ProgressBar
            value={doneCount}
            max={total}
            label={`${doneCount} מתוך ${total} עובדו${isProcessing ? "…" : ""}`}
          />
          <p className="text-xs text-muted">
            {readyCount} מוכנות להורדה
            {errorCount > 0 && <span className="text-danger"> · {errorCount} נכשלו</span>}
          </p>
        </div>
      )}

      {processedRows.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {processedRows.map((row) => (
            <Card key={row.id}>
              <CardBody className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.imageUrl ?? row.originalPreviewUrl}
                  alt={row.file.name}
                  className="aspect-square w-full rounded-sm border border-border bg-white object-contain"
                />
                {row.status === "processing" && <Badge tone="pending">מעבד…</Badge>}
                {row.status === "done" && (
                  <div className="flex items-center gap-2">
                    <Badge tone="success">מוכן</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-1.5 py-0.5 text-xs"
                      onClick={() =>
                        row.imageUrl &&
                        downloadFile(row.imageUrl, `${row.modelNumber || row.file.name}.png`)
                      }
                    >
                      הורדה
                    </Button>
                  </div>
                )}
                {row.status === "error" && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge tone="danger" className="cursor-pointer" onClick={() => setErrorRow(row.id)}>
                        שגיאה
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-1.5 py-0.5 text-xs"
                        onClick={() => retryRow(row.id)}
                      >
                        ניסיון חוזר
                      </Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {readyCount > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={saveAll} disabled={saving}>
            {saving ? "שומר…" : `שמירת ${readyCount} פריטים`}
          </Button>
          {saveMessage && <p className="text-sm text-muted">{saveMessage}</p>}
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? "מייצא…" : "ייצוא ZIP + CSV"}
          </Button>
          {exportError && <p className="text-sm text-danger">{exportError}</p>}
        </div>
      )}

      <Dialog open={errorRowData !== null} onClose={() => setErrorRow(null)} title="שגיאה בעיבוד">
        <p className="text-sm text-ink">{errorRowData?.error}</p>
      </Dialog>

      {/* No-op onClose: approving or rejecting is the only way out — closing
          without a decision would leave the sample row stuck mid-processing
          with the rest of the batch silently on hold behind it. */}
      <Dialog open={sampleDialogOpen} onClose={() => {}} title="דוגמה לאישור" size="lg">
        <div className="space-y-4">
          {sample.phase === "generating" && (
            <div className="flex h-64 items-center justify-center text-sm text-muted">
              מכין דוגמה…
            </div>
          )}
          {sample.phase === "awaiting-approval" && sample.error && (
            <div className="space-y-3">
              <p className="text-sm text-danger">{sample.error}</p>
              <Button onClick={() => rejectSample("")}>נסה שוב</Button>
            </div>
          )}
          {sample.phase === "awaiting-approval" && sample.generated && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                ככה תיראה כל התמונה בעבודה הזו. אישור יתחיל לעבד את שאר התמונות באותו הקו בדיוק.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sample.generated.imageUrl}
                alt="דוגמה"
                className="max-h-[60vh] w-full rounded-sm border border-border bg-white object-contain"
              />
              {!showFeedback ? (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={approveSample}>אישור, התחל לעבוד על כל התמונות</Button>
                  <Button variant="secondary" onClick={() => setShowFeedback(true)}>
                    אין אישור
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    label="מה תרצה לשנות?"
                    placeholder='לדוגמה: "רקע כהה יותר"'
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={2}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => {
                        rejectSample(feedbackText);
                        setFeedbackText("");
                        setShowFeedback(false);
                      }}
                    >
                      שלח ונסה שוב
                    </Button>
                    <Button variant="secondary" onClick={() => setShowFeedback(false)}>
                      ביטול
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
