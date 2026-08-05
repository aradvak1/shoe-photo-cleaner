"use client";

import { useEffect, useRef, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { LogoSelect, useLogos } from "@/components/LogoSelect";
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
import { PHOTO_TEMPLATES } from "@/lib/photoTemplate";
import { PhotoMetadataFields } from "@/components/create/PhotoMetadataFields";
import { PresetBar } from "@/components/create/PresetBar";
import type { CreationRow } from "@/hooks/useImageCreationQueue";
import type { PhotoMode } from "@/types";

const MODE_COPY: Record<
  PhotoMode,
  {
    title: string;
    description: string;
    dropLabel: string;
    promptLabel: string;
    promptPlaceholder: string;
  }
> = {
  studio: {
    title: "תמונת סטודיו",
    description:
      "גררו תמונה, בחרו אילו פרטים (דגם, מק״ט, מידות, צבע, לוגו) יופיעו עליה, ולחצו על \"התחל\" — הכל ייכנס לתמונה אחת מוכנה.",
    dropLabel: "גררו תמונות נעליים לניקוי",
    promptLabel: "כיוון ל-AI (לא חובה)",
    promptPlaceholder: 'לדוגמה: "רקע בז\' חמים במקום לבן אחיד"',
  },
  atmosphere: {
    title: "תמונת אווירה",
    description:
      "גררו תמונה, בחרו אילו פרטים (דגם, מק״ט, מידות, צבע, לוגו) יופיעו עליה, ולחצו על \"התחל\" — הכל ייכנס לתמונה אחת מוכנה.",
    dropLabel: "גררו תמונות נעליים ליצירת תמונת אווירה",
    promptLabel: "תיאור הסצנה (לא חובה)",
    promptPlaceholder: 'לדוגמה: "דוגמנית הולכת ברחוב אורבני בשקיעה"',
  },
};

export function CreationFlow({
  mode,
  endpoint,
  initialPrompt,
  onSaved,
}: {
  mode: PhotoMode;
  endpoint: string;
  /** Pre-fills the AI-direction prompt — used by the catalog wizard to seed the resolved style prompt. */
  initialPrompt?: string;
  /** Called once saveAll() finishes successfully, with this batch's id. */
  onSaved?: (batchId: string) => void;
}) {
  const { logos, setLogos } = useLogos();
  const { templates: dbTemplates } = useDbTemplates();
  const copy = MODE_COPY[mode];
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
    burnText,
    setBurnText,
    templateId,
    setTemplateId,
    defaults,
    applyDefaults,
    defaultLogoId,
    setDefaultLogoId,
    started,
    startProcessing,
    sample,
    approveSample,
    rejectSample,
    retryRow,
  } = useImageCreationQueue({ endpoint, mode, autoProcess: false, initialPrompt, onSaved });

  const [previewRowId, setPreviewRowId] = useState<string | null>(null);
  const [errorRow, setErrorRow] = useState<CreationRow | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const previewRow = rows.find((r) => r.id === previewRowId) ?? null;
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);
  const livePreviewBlobRef = useRef<string | null>(null);

  // Live-renders exactly what will be saved (zoom + logo + fields, template
  // or auto-placement) whenever any of them change while the preview dialog
  // is open — mirrors the reference tool's live card preview instead of only
  // finding out what the final photo looks like after saving. Skipped when
  // the row is already burned: finalizeRow() burns immediately (not just at
  // saveAll time) whenever burnable fields were already set the moment its
  // sample got approved/generation finished — same "alreadyBurned" case
  // saveAll() itself already guards against — so imageUrl is no longer the
  // clean photo and re-rendering here would burn a second logo/text on top.
  useEffect(() => {
    if (
      mode !== "studio" ||
      !previewRow ||
      previewRow.status !== "done" ||
      !previewRow.imageUrl ||
      previewRow.alreadyBurned
    ) {
      return;
    }
    const row = previewRow;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLivePreviewLoading(true);
      try {
        const res = await fetch("/api/preview-overlay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: row.imageUrl,
            modelNumber: row.modelNumber || null,
            sku: row.sku || null,
            price: row.price ? Number(row.price) : null,
            sizeMin: row.sizeMin ? Number(row.sizeMin) : null,
            sizeMax: row.sizeMax ? Number(row.sizeMax) : null,
            color: row.color || null,
            logo_id: row.logoId || null,
            template_id: templateId || null,
            zoom: row.zoom,
          }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (livePreviewBlobRef.current) URL.revokeObjectURL(livePreviewBlobRef.current);
        livePreviewBlobRef.current = url;
        setLivePreviewUrl(url);
      } finally {
        if (!cancelled) setLivePreviewLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    previewRow?.imageUrl,
    previewRow?.status,
    previewRow?.modelNumber,
    previewRow?.sku,
    previewRow?.price,
    previewRow?.sizeMin,
    previewRow?.sizeMax,
    previewRow?.color,
    previewRow?.logoId,
    previewRow?.zoom,
    templateId,
  ]);

  useEffect(() => {
    return () => {
      if (livePreviewBlobRef.current) URL.revokeObjectURL(livePreviewBlobRef.current);
    };
  }, []);
  const sampleDialogOpen = sample.phase === "generating" || sample.phase === "awaiting-approval";
  const isProcessing = total > 0 && doneCount < total;
  const hasPending = rows.some((r) => r.status === "pending");
  const isStarting = rows.some((r) => r.status === "processing");
  const errorCount = rows.filter((r) => r.status === "error").length;

  // A plain <a href> to the export endpoint would navigate the whole page
  // away on failure — the browser then renders the raw {"error": "..."}
  // JSON body in place of the entire app, wiping every in-progress row.
  // Fetching manually keeps the SPA (and all its state) intact no matter
  // what the endpoint returns, success or failure.
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
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.description}</p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <PresetBar
            mode={mode}
            disabled={started}
            currentPrompt={customPrompt}
            currentLogoId={defaultLogoId}
            currentBurnText={burnText}
            currentTemplateId={templateId}
            currentDefaults={defaults}
            onApply={(preset) => {
              setCustomPrompt(preset.prompt ?? "");
              setBurnText(preset.burn_text);
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
            }}
          />
          <Textarea
            label={copy.promptLabel}
            caption="אם משאירים ריק, נשתמש בברירת המחדל. אם ממלאים — נלך לפי הבקשה שלכם."
            placeholder={copy.promptPlaceholder}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            disabled={started}
          />
          <div>
            <p className="mb-1 text-xs font-medium text-muted">לוגו ברירת מחדל</p>
            <LogoSelect
              logos={logos}
              value={defaultLogoId}
              onChange={setDefaultLogoId}
              onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
            />
          </div>
          {mode === "studio" && (
            <Select
              label="תבנית תמונה"
              value={templateId}
              disabled={started}
              onChange={(e) => {
                const id = e.target.value;
                setTemplateId(id);
                if (id) setBurnText(true);
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
          )}
          {!templateId && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={burnText}
                disabled={started}
                onChange={(e) => setBurnText(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              לצרוב את הפרטים (לוגו, דגם ועוד) על התמונה
            </label>
          )}
          <Dropzone multiple label={copy.dropLabel} onFiles={addFiles} />
          {hasPending && (
            <Button onClick={startProcessing} disabled={isStarting}>
              {isStarting ? "מעבד…" : "התחל"}
            </Button>
          )}
          <p className="text-xs text-muted">
            בחרו בטבלה למטה אילו פרטים יופיעו על כל תמונה — לפני לחיצה על &quot;התחל&quot;.
            הם ייכנסו ישירות לתמונה הסופית.
          </p>
        </CardBody>
      </Card>

      {total > 0 && (
        <div className="space-y-1">
          <ProgressBar
            value={doneCount}
            max={total}
            label={`${doneCount} מתוך ${total} עובדו${isProcessing ? "…" : ""}`}
          />
          <p className="text-xs text-muted">
            {readyCount} מוכנות להורדה
            {errorCount > 0 && <span className="text-danger"> · {errorCount} נכשלו — פירוט בטבלה למטה</span>}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-paper text-right text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">תצוגה מקדימה</th>
                <th className="px-3 py-2 font-medium">קובץ</th>
                <th className="px-3 py-2 font-medium">פרטים</th>
                <th className="px-3 py-2 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {/* Shows the raw uploaded photo until the AI result replaces
                        it, so a batch of many "ממתין" rows stays identifiable
                        (which shoe/color is which) while filling in fields. */}
                    <button
                      type="button"
                      onClick={() => {
                        setLivePreviewUrl(null);
                        setPreviewRowId(row.id);
                      }}
                      className="block rounded-sm transition-transform active:scale-95"
                      title="לחצו להגדלה"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.imageUrl ?? row.originalPreviewUrl}
                        alt={row.file.name}
                        className="h-14 w-14 rounded-sm border border-border bg-white object-contain"
                      />
                    </button>
                  </td>
                  <td className="max-w-[9rem] truncate px-3 py-2 text-muted">
                    {row.file.name}
                  </td>
                  <PhotoMetadataFields
                    values={row}
                    onChange={(patch) => updateRow(row.id, patch)}
                    logos={logos}
                    disabled={row.status !== "pending"}
                    onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
                    burnsPrice={Boolean(templateId)}
                  />
                  <td className="max-w-[16rem] px-3 py-2">
                    {row.status === "pending" && <Badge tone="pending">ממתין</Badge>}
                    {row.status === "processing" && (
                      <Badge tone="pending">מעבד…</Badge>
                    )}
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
                          <Badge
                            tone="danger"
                            className="cursor-pointer"
                            onClick={() => setErrorRow(row)}
                          >
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
                        <p className="text-xs text-danger">{row.error}</p>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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

      <Dialog
        open={previewRow !== null}
        onClose={() => {
          setPreviewRowId(null);
          setLivePreviewUrl(null);
        }}
        title={previewRow?.file.name ?? "תצוגה מקדימה"}
        size="lg"
      >
        {previewRow && (
          <div className="space-y-4">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={livePreviewUrl ?? previewRow.imageUrl ?? previewRow.originalPreviewUrl}
                alt={previewRow.file.name}
                className="max-h-[70vh] w-full rounded-sm border border-border bg-white object-contain"
              />
              {livePreviewLoading && (
                <div className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-xs text-white">
                  מעדכן תצוגה מקדימה…
                </div>
              )}
            </div>
            {mode === "studio" && previewRow.status === "done" && !previewRow.alreadyBurned && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span>גודל המוצר בתוך התמונה</span>
                  <span>{previewRow.zoom}%</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={160}
                  step={5}
                  value={previewRow.zoom}
                  onChange={(e) => updateRow(previewRow.id, { zoom: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
                <p className="mt-1 text-[10px] text-muted">
                  ערך גבוה יותר ממלא יותר את הפריים ומצמצם את הרקע הריק סביב המוצר.
                </p>
              </div>
            )}
            {previewRow.imageUrl ? (
              <Button
                onClick={async () => {
                  const url = livePreviewUrl ?? previewRow.imageUrl!;
                  downloadFile(url, `${previewRow.modelNumber || previewRow.file.name}.png`);
                }}
                className="w-full"
              >
                הורדת התמונה
              </Button>
            ) : (
              <p className="text-center text-xs text-muted">
                זו התמונה המקורית שהעליתם — התוצאה המעובדת עוד לא מוכנה.
              </p>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={errorRow !== null}
        onClose={() => setErrorRow(null)}
        title="שגיאה בעיבוד"
      >
        <p className="text-sm text-ink">{errorRow?.error}</p>
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
              <Button
                onClick={() => {
                  const row = rows.find((r) => r.id === sample.rowId);
                  if (row) rejectSample("");
                }}
              >
                נסה שוב
              </Button>
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
                    placeholder='לדוגמה: "רקע כהה יותר" או "בלי דוגמנית, רק רקע"'
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
