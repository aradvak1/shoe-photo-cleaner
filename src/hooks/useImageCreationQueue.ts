"use client";

import { useMemo, useState } from "react";
import type { PhotoMode } from "@/types";
import type { RowMetadataValues } from "@/components/create/PhotoMetadataFields";
import { resizeImageFile } from "@/lib/resizeImage";

export type RowStatus = "pending" | "processing" | "done" | "error";

export interface CreationRow {
  id: string;
  file: File;
  status: RowStatus;
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
        sizeMin: row.sizeMin ? Number(row.sizeMin) : null,
        sizeMax: row.sizeMax ? Number(row.sizeMax) : null,
        color: row.color || null,
        logo_id: row.logoId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "הוספת הטקסט לתמונה נכשלה");
    return data.imageUrl as string;
  }

  async function generateRow(row: CreationRow, prompt: string): Promise<SampleGenerated> {
    const uploadFile = await resizeImageFile(row.file);
    const formData = new FormData();
    formData.append("image", uploadFile);
    if (prompt.trim()) formData.append("prompt", prompt.trim());
    const res = await fetch(endpoint, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "עיבוד נכשל");
    return { imageUrl: data.imageUrl as string, originalUrl: data.originalUrl as string };
  }

  async function finalizeRow(row: CreationRow, generated: SampleGenerated) {
    let imageUrl = generated.imageUrl;
    let alreadyBurned = false;

    // Atmosphere's pick-fields-before-Start flow: the row's fields were
    // already chosen while it sat at status "pending", so bake them in
    // immediately — one click produces one finished image, no separate
    // later save/burn step.
    if (!autoProcess && hasBurnableFields(row)) {
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
      modelNumber: defaults.modelNumber ?? "",
      sku: defaults.sku ?? "",
      price: defaults.price ?? "",
      logoId: defaults.logoId ?? "",
      sizeMin: defaults.sizeMin ?? "",
      sizeMax: defaults.sizeMax ?? "",
      color: defaults.color ?? "",
    }));
    setRows((prev) => [...prev, ...newRows]);

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
    defaults,
    applyDefaults,
    defaultLogoId: defaults.logoId ?? "",
    setDefaultLogoId,
    started,
    startProcessing,
    sample,
    approveSample,
    rejectSample,
  };
}
