"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { useLogos } from "@/components/LogoSelect";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Textarea } from "@/components/ui/Textarea";
import { useImageCreationQueue } from "@/hooks/useImageCreationQueue";
import { PhotoMetadataFields } from "@/components/create/PhotoMetadataFields";
import type { CreationRow } from "@/hooks/useImageCreationQueue";
import type { PhotoMode } from "@/types";

const MODE_COPY: Record<
  PhotoMode,
  { title: string; dropLabel: string; promptLabel: string; promptPlaceholder: string }
> = {
  studio: {
    title: "תמונת סטודיו",
    dropLabel: "גררו תמונות נעליים לניקוי",
    promptLabel: "כיוון ל-AI (לא חובה)",
    promptPlaceholder: 'לדוגמה: "רקע בז\' חמים במקום לבן אחיד"',
  },
  atmosphere: {
    title: "תמונת אווירה",
    dropLabel: "גררו תמונות נעליים ליצירת תמונת אווירה",
    promptLabel: "תיאור הסצנה (לא חובה)",
    promptPlaceholder: 'לדוגמה: "דוגמנית הולכת ברחוב אורבני בשקיעה"',
  },
};

export function CreationFlow({
  mode,
  endpoint,
}: {
  mode: PhotoMode;
  endpoint: string;
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
  } = useImageCreationQueue({ endpoint, mode });

  const [previewRow, setPreviewRow] = useState<CreationRow | null>(null);
  const isProcessing = total > 0 && doneCount < total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">
          מלאו כיוון ל-AI אם רוצים (לא חובה), ואז גררו תמונה אחת או כמה יחד.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <Textarea
            label={copy.promptLabel}
            caption="אם משאירים ריק, נשתמש בברירת המחדל. אם ממלאים — נלך לפי הבקשה שלכם."
            placeholder={copy.promptPlaceholder}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            disabled={total > 0}
          />
          <Dropzone multiple label={copy.dropLabel} onFiles={addFiles} />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={burnText}
              onChange={(e) => setBurnText(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              הוסיפו את הפרטים (דגם, מק״ט, מידות, צבע) ישירות על התמונה שנשמרת
              <span className="block text-xs text-muted">
                מתבצע בזמן השמירה, לפי הערכים שתמלאו בטבלה למטה.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      {total > 0 && (
        <ProgressBar
          value={doneCount}
          max={total}
          label={`${doneCount} מתוך ${total} עובדו${isProcessing ? "…" : ""}`}
        />
      )}

      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-paper text-right text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">תצוגה מקדימה</th>
                <th className="px-3 py-2 font-medium">קובץ</th>
                <th className="px-3 py-2 font-medium">מספר דגם</th>
                <th className="px-3 py-2 font-medium">מק״ט</th>
                <th className="px-3 py-2 font-medium">מחיר</th>
                <th className="px-3 py-2 font-medium">מידות</th>
                <th className="px-3 py-2 font-medium">צבע</th>
                <th className="px-3 py-2 font-medium">לוגו</th>
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
                    disabled={row.status !== "done"}
                    onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
                  />
                  <td className="px-3 py-2">
                    {row.status === "pending" && <Badge tone="pending">ממתין</Badge>}
                    {row.status === "processing" && (
                      <Badge tone="pending">מעבד…</Badge>
                    )}
                    {row.status === "done" && <Badge tone="success">מוכן</Badge>}
                    {row.status === "error" && (
                      <Badge tone="danger" className="cursor-help" title={row.error}>
                        שגיאה
                      </Badge>
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
    </div>
  );
}
