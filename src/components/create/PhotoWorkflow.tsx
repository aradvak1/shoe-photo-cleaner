"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { LogoSelect, useLogos } from "@/components/LogoSelect";
import { PhotoDesignDialog } from "@/components/create/PhotoDesignDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Textarea } from "@/components/ui/Textarea";
import { useDbTemplates } from "@/hooks/useDbTemplates";
import { useImageCreationQueue } from "@/hooks/useImageCreationQueue";
import type { CreationRow } from "@/hooks/useImageCreationQueue";
import type { PhotoMode } from "@/types";

const MODE_COPY: Record<
  PhotoMode,
  {
    title: string;
    description: string;
    dropLabel: string;
    promptLabel: string;
    promptCaption: string;
    promptPlaceholder: string;
  }
> = {
  studio: {
    title: "תמונת סטודיו",
    description:
      "שלב 1: גררו תמונות ואשרו סגנון AI אחד לכל התמונות. שלב 2: לכל תמונה בנפרד — בחרו תבנית, מלאו פרטים, וגררו הכל בדיוק למקום שאתם רוצים.",
    dropLabel: "גררו תמונות נעליים לניקוי",
    promptLabel: "כיוון ל-AI (לא חובה)",
    promptCaption:
      "ההנחיה מתווספת לעיצוב הקבוע (רקע/תאורה), לא מחליפה אותו — אפשר גם לבקש שינוי על הנעל עצמה, כמו יותר צל או ברק.",
    promptPlaceholder: 'לדוגמה: "יותר צל מתחת לנעל" או "רקע בז\' חמים יותר"',
  },
  atmosphere: {
    title: "תמונת אווירה",
    description:
      "שלב 1: גררו תמונות ואשרו סגנון AI אחד לכל התמונות. שלב 2: לכל תמונה בנפרד — בחרו תבנית, מלאו פרטים, וגררו הכל בדיוק למקום שאתם רוצים.",
    dropLabel: "גררו תמונות נעליים ליצירת תמונת אווירה",
    promptLabel: "תיאור הסצנה (לא חובה)",
    promptCaption: "ההנחיה מתווספת לתיאור הקבוע של הסצנה, לא מחליפה אותו.",
    promptPlaceholder: 'לדוגמה: "דוגמנית הולכת ברחוב אורבני בשקיעה"',
  },
};

/**
 * Unified two-stage creation flow, replacing the old StudioDesignFlow
 * (design-before-AI, one row editable at a time) and CreationFlow
 * (table of rows, no drag/template positioning). Stage A here is purely
 * about AI generation — upload, optional style direction, one sample
 * approved for the whole batch. Stage B is per-photo: every AI-clean
 * photo gets its own design (template, fields, drag/resize position),
 * confirmed independently — so a batch of several different products
 * never has one photo's data leak onto another's (see PhotoDesignDialog /
 * useImageCreationQueue for the mechanics).
 */
export function PhotoWorkflow({
  mode,
  endpoint,
  initialPrompt,
  onSaved,
}: {
  mode: PhotoMode;
  endpoint: string;
  initialPrompt?: string;
  onSaved?: (batchId: string) => void;
}) {
  const { logos, setLogos } = useLogos();
  const { templates: dbTemplates, refresh: refreshDbTemplates } = useDbTemplates();
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
    defaultLogoId,
    setDefaultLogoId,
    started,
    startProcessing,
    sample,
    approveSample,
    rejectSample,
    retryRow,
    confirmDesign,
  } = useImageCreationQueue({ endpoint, mode, autoProcess: false, initialPrompt, onSaved });

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [errorRow, setErrorRow] = useState<CreationRow | null>(null);
  const [designRowId, setDesignRowId] = useState<string | null>(null);

  const sampleDialogOpen = sample.phase === "generating" || sample.phase === "awaiting-approval";
  const isProcessing = total > 0 && doneCount < total;
  const hasPending = rows.some((r) => r.status === "pending");
  const isStarting = rows.some((r) => r.status === "processing");
  const errorCount = rows.filter((r) => r.status === "error").length;
  const processedRows = rows.filter((r) => r.status !== "pending");
  const designRow = rows.find((r) => r.id === designRowId) ?? null;

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
          <Textarea
            label={copy.promptLabel}
            caption={copy.promptCaption}
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
          <Dropzone multiple label={copy.dropLabel} onFiles={addFiles} />
          {hasPending && (
            <Button onClick={startProcessing} disabled={isStarting}>
              {isStarting ? "מעבד…" : "התחל"}
            </Button>
          )}
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
            {readyCount} מוכנות לשמירה
            {errorCount > 0 && <span className="text-danger"> · {errorCount} נכשלו</span>}
          </p>
        </div>
      )}

      {processedRows.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">עיצוב לכל תמונה</p>
          <p className="mb-3 text-xs text-muted">
            לחצו על תמונה כדי לבחור או לבנות תבנית, למלא פרטים, ולמקם הכל בדיוק כמו שאתם רוצים.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {processedRows.map((row) => (
              <Card key={row.id}>
                <CardBody className="space-y-2">
                  <button
                    type="button"
                    onClick={() => row.status === "done" && setDesignRowId(row.id)}
                    disabled={row.status !== "done"}
                    className="block w-full disabled:cursor-not-allowed"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.designedImageUrl ?? row.imageUrl ?? row.originalPreviewUrl}
                      alt={row.file.name}
                      className="aspect-square w-full rounded-sm border border-border bg-white object-contain"
                    />
                  </button>
                  {row.status === "processing" && <Badge tone="pending">מעבד…</Badge>}
                  {row.status === "done" && (
                    <Badge tone={row.designed ? "success" : "pending"}>
                      {row.designed ? "עוצב ✓" : "מוכן לעיצוב"}
                    </Badge>
                  )}
                  {row.status === "error" && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge tone="danger" className="cursor-pointer" onClick={() => setErrorRow(row)}>
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
        </div>
      )}

      {errorCount > 0 && (
        <div className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
          {errorCount} תמונות נכשלו ולא ייכללו בשמירה — גללו למעלה ולחצו &quot;ניסיון חוזר&quot; על כל
          אחת מהן לפני שממשיכים, כדי שלא יהיו לכם חוסרים בקטלוג.
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

      <Dialog open={errorRow !== null} onClose={() => setErrorRow(null)} title="שגיאה בעיבוד">
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
              <Button onClick={() => rejectSample("")}>נסה שוב</Button>
            </div>
          )}
          {sample.phase === "awaiting-approval" && sample.generated && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                ככה ייראה הסגנון (רקע/תאורה) בכל תמונה בעבודה הזו. אישור יתחיל לעבד את שאר התמונות באותו
                הקו בדיוק — פרטים ומיקום לכל תמונה נקבעים בשלב הבא, אחד אחד.
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

      <PhotoDesignDialog
        key={designRow?.id ?? "none"}
        row={designRow}
        open={designRow !== null}
        onClose={() => setDesignRowId(null)}
        mode={mode}
        updateRow={updateRow}
        confirmDesign={confirmDesign}
        logos={logos}
        onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
        dbTemplates={dbTemplates}
        refreshDbTemplates={refreshDbTemplates}
        customPrompt={customPrompt}
      />
    </div>
  );
}
