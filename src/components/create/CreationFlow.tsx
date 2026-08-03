"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { LogoSelect, useLogos } from "@/components/LogoSelect";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Textarea } from "@/components/ui/Textarea";
import { useImageCreationQueue } from "@/hooks/useImageCreationQueue";
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

  const [previewRow, setPreviewRow] = useState<CreationRow | null>(null);
  const [errorRow, setErrorRow] = useState<CreationRow | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const sampleDialogOpen = sample.phase === "generating" || sample.phase === "awaiting-approval";
  const isProcessing = total > 0 && doneCount < total;
  const hasPending = rows.some((r) => r.status === "pending");
  const isStarting = rows.some((r) => r.status === "processing");
  const errorCount = rows.filter((r) => r.status === "error").length;

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
                    {row.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewRow(row)}
                        className="block rounded-sm transition-transform active:scale-95"
                        title="לחצו להגדלה"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.imageUrl}
                          alt={row.file.name}
                          className="h-14 w-14 rounded-sm border border-border bg-white object-contain"
                        />
                      </button>
                    ) : (
                      <div className="skeleton-shimmer h-14 w-14 animate-shimmer rounded-sm border border-border" />
                    )}
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
                          href={row.imageUrl}
                          download
                          className="px-1.5 py-0.5 text-xs"
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
          <Button variant="secondary" href={`/api/export?batch_id=${batchId}`}>
            ייצוא ZIP + CSV
          </Button>
        </div>
      )}

      <Dialog
        open={previewRow !== null}
        onClose={() => setPreviewRow(null)}
        title={previewRow?.file.name ?? "תצוגה מקדימה"}
        size="lg"
      >
        {previewRow?.imageUrl && (
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewRow.imageUrl}
              alt={previewRow.file.name}
              className="max-h-[70vh] w-full rounded-sm border border-border bg-white object-contain"
            />
            <Button href={previewRow.imageUrl} download className="w-full">
              הורדת התמונה
            </Button>
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
