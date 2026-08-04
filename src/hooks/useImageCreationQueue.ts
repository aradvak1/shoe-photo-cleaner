"use client";

import { useMemo, useState } from "react";
import type { PhotoMode } from "@/types";
import type { RowMetadataValues } from "@/components/create/PhotoMetadataFields";
import { resizeImageFile } from "@/lib/resizeImage";
import type { CustomLayout } from "@/lib/photoTemplate";

export type RowStatus = "pending" | "processing" | "done" | "error";

export interface CreationRow {
  id: string;
  file: File;
  status: RowStatus;
  /** Client-side object URL of the raw uploaded file — shown as the row's thumbnail before/while processing, so a batch of many "ממתין" rows is still visually identifiable (which shoe/color is which) before any AI result exists. */
  originalPreviewUrl: string;
  /** Server-fetchable URL of the same raw file (uploaded immediately on add) — a blob: URL only exists in this tab's memory, so the design toolbar's live preview-overlay calls need this instead to render zoom/logo/field previews before AI processing has even run. Undefined until the upload finishes. */
  rawUrl?: string;
  imageUrl?: string;
  originalUrl?: string;
  error?: string;
  modelNumber: string;
  sku: string;
  price: string;
  logoId: string;
  sizeMin: string;
  sizeMax: string;
  color: string;
  /** Text was already burned onto the image during processing (atmosphere's pick-fields-before-Start flow) — saveAll must not burn it a second time. */
  alreadyBurned?: boolean;
  /** Product size within the frame, as a percent (100 = untouched). >100 crops tighter/fills more of the frame; <100 shows more background. */
  zoom: number;
  /** Drag-positioned/resized overrides for the logo and/or text fields, from the design toolbar — merged on top of the base template's fractions. */
  customLayout: CustomLayout;
}

const CONCURRENCY = 3;

function hasBurnableFields(row: CreationRow): boolean {
  return Boolean(
    row.modelNumber || row.sku || row.sizeMin || row.sizeMax || row.color || row.logoId
  );
}

interface SampleGenerated {
  imageUrl: string;
  originalUrl: string;
}

export interface SampleState {
  phase: "idle" | "generating" | "awaiting-approval" | "approved";
  rowId?: string;
  generated?: SampleGenerated;
  error?: string;
}

/**
 * Shared upload/process/save state machine behind both creation modes
 * (studio + atmosphere) and both single- and multi-file usage — a single
 * file is just a one-row batch.
 */
export function useImageCreationQueue({
  endpoint,
  mode,
  autoProcess = true,
  initialPrompt = "",
  onSaved,
}: {
  endpoint: string;
  mode: PhotoMode;
  /** When false (atmosphere mode), addFiles only queues rows — processing waits for an explicit startProcessing() call, so fields can be picked first. */
  autoProcess?: boolean;
  /** Seeds customPrompt — used by the catalog wizard to pre-fill the resolved style prompt. */
  initialPrompt?: string;
  /** Called once saveAll() finishes successfully, with this batch's id — the catalog wizard uses it to move to the cover step. */
  onSaved?: (batchId: string) => void;
}) {
  const [rows, setRows] = useState<CreationRow[]>([]);
  const [batchId] = useState(() => crypto.randomUUID());
  const [customPrompt, setCustomPrompt] = useState(initialPrompt);
  const [burnText, setBurnText] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [defaults, setDefaultsState] = useState<Partial<RowMetadataValues>>({});
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Applying defaults (a picked default logo, or an applied preset) also
  // backfills any existing row whose corresponding field is still empty —
  // never overwrites a row where the user already chose something
  // different per-row. New rows are seeded from `defaults` in addFiles.
  function applyDefaults(patch: Partial<RowMetadataValues>) {
    setDefaultsState((prev) => ({ ...prev, ...patch }));
    setRows((prev) =>
      prev.map((r) => {
        const fill: Partial<CreationRow> = {};
        (Object.keys(patch) as (keyof RowMetadataValues)[]).forEach((key) => {
          const value = patch[key];
          if (value && !r[key]) {
            (fill as Record<string, string>)[key] = value;
          }
        });
        return Object.keys(fill).length > 0 ? { ...r, ...fill } : r;
      })
    );
  }

  function setDefaultLogoId(logoId: string) {
    applyDefaults({ logoId });
  }

  const total = rows.length;
  const doneCount = useMemo(
    () => rows.filter((r) => r.status === "done" || r.status === "error").length,
    [rows]
  );
  const readyCount = useMemo(
    () => rows.filter((r) => r.status === "done").length,
    [rows]
  );

  function updateRow(id: string, patch: Partial<CreationRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function burnRow(row: CreationRow): Promise<string> {
    const res = await fetch("/api/apply-text-overlay", {
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
        custom_layout: row.customLayout,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "הוספת הטקסט לתמונה נכשלה");
    return data.imageUrl as string;
  }

  // Retries only cover network-level failures (dropped connection, truncated
  // response) — a real backend error (bad key, safety block, etc.) comes
  // back as a clean {error} JSON body and fails on the first attempt, since
  // retrying it would just waste time/money reproducing the same failure.
  const GENERATE_MAX_ATTEMPTS = 3;

  async function generateRow(row: CreationRow, prompt: string): Promise<SampleGenerated> {
    const uploadFile = await resizeImageFile(row.file);

    for (let attempt = 1; attempt <= GENERATE_MAX_ATTEMPTS; attempt++) {
      let res: Response;
      try {
        const formData = new FormData();
        formData.append("image", uploadFile);
        if (prompt.trim()) formData.append("prompt", prompt.trim());
        res = await fetch(endpoint, { method: "POST", body: formData });
      } catch {
        if (attempt === GENERATE_MAX_ATTEMPTS) {
          throw new Error("החיבור נכשל אחרי כמה ניסיונות (בעיית רשת). נסו שוב.");
        }
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }

      let data: { imageUrl?: string; originalUrl?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        // Truncated/empty body — almost always a dropped connection or the
        // server's own timeout, not a real error from our code.
        if (attempt === GENERATE_MAX_ATTEMPTS) {
          throw new Error("התהליך נעצר באמצע כמה פעמים ברציפות (לרוב עומס רשת). נסו שוב מאוחר יותר.");
        }
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }

      if (!res.ok) throw new Error(data.error || "עיבוד נכשל");
      return { imageUrl: data.imageUrl as string, originalUrl: data.originalUrl as string };
    }
    throw new Error("שגיאה לא ידועה");
  }

  async function finalizeRow(row: CreationRow, generated: SampleGenerated) {
    let imageUrl = generated.imageUrl;
    let alreadyBurned = false;

    // Fields (and now zoom/template, via the design toolbar) are chosen
    // before generation even starts, in both modes — so bake them in
    // immediately once the AI result comes back: one "אישור" click produces
    // one finished image, no separate later save/burn step.
    if (hasBurnableFields(row)) {
      imageUrl = await burnRow({ ...row, imageUrl });
      alreadyBurned = true;
    }

    updateRow(row.id, {
      status: "done",
      imageUrl,
      originalUrl: generated.originalUrl,
      alreadyBurned,
    });
  }

  async function processRow(row: CreationRow, prompt: string) {
    updateRow(row.id, { status: "processing" });
    try {
      const generated = await generateRow(row, prompt);
      await finalizeRow(row, generated);
    } catch (e) {
      updateRow(row.id, {
        status: "error",
        error: e instanceof Error ? e.message : "שגיאה לא ידועה",
      });
    }
  }

  /** Re-runs one failed row with the batch's current (already-approved) prompt — lets the user fix a single failure without redoing the whole batch. */
  async function retryRow(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    await processRow(row, customPrompt);
  }

  const [sample, setSample] = useState<SampleState>({ phase: "idle" });

  /**
   * Generates (or regenerates) a single representative row and parks the
   * result in `sample` for approval, instead of writing straight to that
   * row's status — the row only flips to "done" once approveSample() runs,
   * so a rejected sample never leaves a half-finished row behind.
   */
  async function generateSample(row: CreationRow, prompt: string = customPrompt) {
    updateRow(row.id, { status: "processing", error: undefined });
    setSample({ phase: "generating", rowId: row.id });
    try {
      const generated = await generateRow(row, prompt);
      setSample({ phase: "awaiting-approval", rowId: row.id, generated });
    } catch (e) {
      setSample({
        phase: "awaiting-approval",
        rowId: row.id,
        error: e instanceof Error ? e.message : "שגיאה לא ידועה",
      });
    }
  }

  /**
   * Locks in the current prompt as "correct" for the whole batch: finalizes
   * the approved sample row (burning its fields like any other row) and
   * fires off every other still-pending row with the exact same prompt —
   * this is what actually keeps a 20-photo batch visually on one line.
   */
  async function approveSample() {
    if (sample.phase !== "awaiting-approval" || !sample.rowId || !sample.generated) return;
    const row = rows.find((r) => r.id === sample.rowId);
    const generated = sample.generated;
    setSample({ phase: "approved" });
    if (row) await finalizeRow(row, generated);
    const rest = rows.filter((r) => r.id !== sample.rowId && r.status === "pending");
    if (rest.length > 0) await processRows(rest, customPrompt);
  }

  /**
   * Folds free-text feedback into the shared prompt (visible afterwards in
   * the main prompt field, since it's the same state) and regenerates the
   * sample from the same row — the loop the user drives from the
   * approval dialog until the sample looks right.
   */
  async function rejectSample(feedback: string) {
    if (!sample.rowId) return;
    const row = rows.find((r) => r.id === sample.rowId);
    if (!row) return;
    const trimmed = feedback.trim();
    const nextPrompt = trimmed
      ? customPrompt.trim()
        ? `${customPrompt.trim()}. ${trimmed}`
        : trimmed
      : customPrompt;
    setCustomPrompt(nextPrompt);
    await generateSample(row, nextPrompt);
  }

  async function processRows(rowsToProcess: CreationRow[], prompt: string) {
    const queue = [...rowsToProcess];
    async function worker() {
      while (queue.length > 0) {
        const row = queue.shift();
        if (row) await processRow(row, prompt);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  async function addFiles(files: File[]) {
    const newRows: CreationRow[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending",
      originalPreviewUrl: URL.createObjectURL(file),
      modelNumber: defaults.modelNumber ?? "",
      sku: defaults.sku ?? "",
      price: defaults.price ?? "",
      logoId: defaults.logoId ?? "",
      sizeMin: defaults.sizeMin ?? "",
      sizeMax: defaults.sizeMax ?? "",
      color: defaults.color ?? "",
      zoom: 100,
      customLayout: {},
    }));
    setRows((prev) => [...prev, ...newRows]);

    // Fire-and-forget: uploads each raw file immediately so the design
    // toolbar has a real URL to preview zoom/logo/fields against before AI
    // processing even starts. A failure here just means that row's live
    // preview stays unavailable — the AI generation step re-uploads the
    // file itself regardless, so this never blocks actual processing.
    for (const row of newRows) {
      const formData = new FormData();
      formData.append("image", row.file);
      fetch("/api/upload-original", { method: "POST", body: formData })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.url) updateRow(row.id, { rawUrl: data.url });
        })
        .catch(() => {});
    }

    if (!autoProcess) return;

    // Snapshot the prompt at drop-time: it's what drives the AI call itself,
    // so it must be locked in before generation starts, not editable after.
    await processRows(newRows, customPrompt);
  }

  /**
   * First run for a batch: only generates ONE row (the sample) and stops —
   * the rest stay "pending" until approveSample() releases them. Once a
   * sample has already been approved for this batch, later calls (e.g. a
   * second drop of files after the first batch finished) skip straight to
   * processing everyone with the already-approved prompt.
   */
  async function startProcessing() {
    setStarted(true);
    const pending = rows.filter((r) => r.status === "pending");
    if (pending.length === 0) return;
    if (sample.phase === "approved") {
      await processRows(pending, customPrompt);
      return;
    }
    await generateSample(pending[0], customPrompt);
  }

  async function saveAll() {
    const readyRows = rows.filter((r) => r.status === "done");
    if (readyRows.length === 0) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      // When burning text is on, apply it now (using the field values as
      // typed in by this point) and swap in the labeled image's URL before
      // saving — this can't happen at initial processing time since the
      // fields aren't filled in yet then. Rows already burned during
      // processing (atmosphere's pick-fields-before-Start flow) are skipped
      // here to avoid burning the text twice.
      const finalized = await Promise.all(
        readyRows.map(async (r) => {
          if (r.alreadyBurned) return { row: r, imageUrl: r.imageUrl, burned: true };
          if (!burnText) return { row: r, imageUrl: r.imageUrl, burned: false };
          const imageUrl = await burnRow(r);
          return { row: r, imageUrl, burned: true };
        })
      );

      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          finalized.map(({ row: r, imageUrl, burned }) => ({
            image_url: imageUrl,
            original_url: r.originalUrl,
            model_number: r.modelNumber || null,
            sku: r.sku || null,
            price: r.price ? Number(r.price) : null,
            logo_id: r.logoId || null,
            batch_id: batchId,
            size_min: r.sizeMin ? Number(r.sizeMin) : null,
            size_max: r.sizeMax ? Number(r.sizeMax) : null,
            color: r.color || null,
            custom_prompt: customPrompt.trim() || null,
            mode,
            burned_text: burned,
            template_id: burned ? templateId || null : null,
            zoom: r.zoom,
            custom_layout: burned ? r.customLayout : null,
          }))
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שמירה נכשלה");
      setSaveMessage(`נשמרו ${readyRows.length} פריטים בהצלחה.`);
      onSaved?.(batchId);
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  return {
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
    defaultLogoId: defaults.logoId ?? "",
    setDefaultLogoId,
    started,
    startProcessing,
    sample,
    approveSample,
    rejectSample,
    retryRow,
  };
}
