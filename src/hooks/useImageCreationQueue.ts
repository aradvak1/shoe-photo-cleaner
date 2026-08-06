"use client";

import { useMemo, useRef, useState } from "react";
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
  /** Which template (built-in or saved) this specific photo's design uses — per-row, not shared across the batch, since a batch can hold several different products. */
  templateId: string;
  /** Product size within the frame, as a percent (100 = untouched). >100 crops tighter/fills more of the frame; <100 shows more background. */
  zoom: number;
  /** Drag-positioned/resized overrides for the logo and/or text fields, from the design toolbar — merged on top of the base template's fractions. */
  customLayout: CustomLayout;
  /** True once this row's per-photo design (template/fields/positions) has been confirmed and burned — distinct from `status === "done"`, which only means the AI step finished. Only designed rows are eligible for saveAll. */
  designed: boolean;
  /** The burned output from confirmDesign(), kept separate from `imageUrl` — `imageUrl` always stays the pristine AI-clean source so a row can be redesigned (different template, different fields) any number of times without re-running AI or compositing onto already-burned pixels. */
  designedImageUrl?: string;
}

const CONCURRENCY = 3;

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
  const [defaults, setDefaultsState] = useState<Partial<RowMetadataValues>>({});
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  /** The approved sample's image URL, sent along with every later generation
   * in this batch (initial fill-in, retries, and regenerateRows) as a style
   * reference — see gemini.ts's STYLE_REFERENCE_INSTRUCTION for why a shared
   * TEXT prompt alone let independent Gemini calls drift onto different
   * backgrounds within the same batch. A ref, not state: approveSample sets
   * it and synchronously calls processRows in the same tick, which needs
   * generateRow to see the new value immediately — a state setter's update
   * wouldn't be visible in that same tick's closures. */
  const styleReferenceUrlRef = useRef<string | undefined>(undefined);

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
  /** Ready to SAVE — AI finished AND this photo's own design was confirmed. A row that's merely AI-done still needs a trip through Stage B before it counts here. */
  const readyCount = useMemo(
    () => rows.filter((r) => r.status === "done" && r.designed).length,
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
        template_id: row.templateId || null,
        zoom: row.zoom,
        custom_layout: row.customLayout,
      }),
    });
    let data: { imageUrl?: string; error?: string };
    try {
      data = await res.json();
    } catch {
      // Non-JSON body (dropped connection, platform-level 502/504) rather
      // than a real {error} response from our own route.
      throw new Error("צריבת הטקסט לתמונה נכשלה (בעיית רשת). נסו שוב.");
    }
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
        if (styleReferenceUrlRef.current) {
          formData.append("style_reference_url", styleReferenceUrlRef.current);
        }
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

  /**
   * Marks a row's AI generation as finished — nothing more. No burning
   * happens here: text/logo placement is now an explicit per-photo Stage B
   * step (confirmDesign), completely decoupled from AI generation, so a
   * batch of different products never has one row's fields leak onto
   * another's before the user has even seen it.
   */
  async function finalizeRow(row: CreationRow, generated: SampleGenerated) {
    updateRow(row.id, {
      status: "done",
      imageUrl: generated.imageUrl,
      originalUrl: generated.originalUrl,
      // A regenerate (see regenerateRows) replaces imageUrl — any earlier
      // burned design was composited onto the OLD image and no longer
      // matches, so it must not stay marked designed/ready-to-save. No-op
      // for a fresh pending->done row, since these are already unset then.
      designed: false,
      designedImageUrl: undefined,
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

  /**
   * Re-runs AI generation for one or more already-"done" rows the seller
   * flagged as not good enough (e.g. the product's color drifted) — same
   * source file, same approved style prompt, plus an optional one-off
   * instruction layered on top just for this regenerate (not saved back
   * into the shared customPrompt, so it doesn't affect any other photo).
   * Reuses processRows' concurrency-limited worker pool, so flagging many
   * rows at once in a large batch doesn't fire them all at the same instant.
   */
  async function regenerateRows(rowIds: string[], feedback?: string) {
    const targets = rowIds
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is CreationRow => Boolean(r));
    if (targets.length === 0) return;
    const trimmed = feedback?.trim();
    const prompt = trimmed
      ? customPrompt.trim()
        ? `${customPrompt.trim()}. ${trimmed}`
        : trimmed
      : customPrompt;
    await processRows(targets, prompt);
  }

  /**
   * Stage B's "confirm" action for one photo: burns its currently-set
   * template/fields/customLayout onto the pristine AI-clean `imageUrl` and
   * marks the row designed. Always burns from `row.imageUrl` (never from a
   * previous `designedImageUrl`), and apply-text-overlay writes each burn
   * to a fresh storage path rather than overwriting the source — so this
   * can be called again after changing the template/fields, any number of
   * times, without double-burning or re-running AI. Throws on failure; the
   * caller (the design dialog) owns its own loading/error UI around this.
   *
   * `overrides` lets a caller apply a just-computed patch (e.g. a
   * freshly-saved template's id) and burn with it in one atomic call —
   * calling updateRow() then immediately confirmDesign() separately would
   * risk confirmDesign reading this hook's `rows` closure before the
   * updateRow's state change has actually landed.
   */
  async function confirmDesign(rowId: string, overrides?: Partial<CreationRow>) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const effectiveRow = overrides ? { ...row, ...overrides } : row;
    const designedImageUrl = await burnRow(effectiveRow);
    updateRow(rowId, { ...overrides, designed: true, designedImageUrl });
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
   * Locks in the current prompt as the approved AI style: finalizes the
   * sample row (AI-clean only, no fields/burning involved) and fires off
   * every other still-pending row with the exact same style prompt — this
   * is what actually keeps a batch visually consistent. Per-photo fields/
   * template/positioning happen later, per row, in Stage B.
   *
   * Also records the sample's own image as styleReferenceUrl, sent along
   * with every one of those calls (and any later retry/regenerate) as a
   * visual anchor — the text prompt alone isn't enough for independent
   * Gemini calls to land on the same exact background (see generateRow).
   */
  async function approveSample() {
    if (sample.phase !== "awaiting-approval" || !sample.rowId || !sample.generated) return;
    const row = rows.find((r) => r.id === sample.rowId);
    const generated = sample.generated;
    setSample({ phase: "approved" });
    styleReferenceUrlRef.current = generated.imageUrl;
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
      templateId: "",
      zoom: 100,
      customLayout: {},
      designed: false,
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

  /**
   * Persists every row whose design was already confirmed (burned) in
   * Stage B — burning no longer happens here at all, since it's now an
   * explicit per-photo action (confirmDesign) that already ran before a
   * row could ever reach readyCount/this filter.
   */
  async function saveAll() {
    const readyRows = rows.filter((r) => r.status === "done" && r.designed);
    if (readyRows.length === 0) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          readyRows.map((r) => ({
            image_url: r.designedImageUrl ?? r.imageUrl,
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
            burned_text: true,
            template_id: r.templateId || null,
            zoom: r.zoom,
            custom_layout: r.customLayout,
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
    regenerateRows,
    confirmDesign,
  };
}
