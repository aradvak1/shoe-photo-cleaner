"use client";

import { useMemo, useState } from "react";
import type { PhotoMode } from "@/types";

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
}

const CONCURRENCY = 3;

/**
 * Shared upload/process/save state machine behind both creation modes
 * (studio + atmosphere) and both single- and multi-file usage — a single
 * file is just a one-row batch.
 */
export function useImageCreationQueue({
  endpoint,
  mode,
}: {
  endpoint: string;
  mode: PhotoMode;
}) {
  const [rows, setRows] = useState<CreationRow[]>([]);
  const [batchId] = useState(() => crypto.randomUUID());
  const [customPrompt, setCustomPrompt] = useState("");
  const [burnText, setBurnText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  async function processRow(row: CreationRow, prompt: string) {
    updateRow(row.id, { status: "processing" });
    try {
      const formData = new FormData();
      formData.append("image", row.file);
      if (prompt.trim()) formData.append("prompt", prompt.trim());
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "עיבוד נכשל");
      updateRow(row.id, {
        status: "done",
        imageUrl: data.imageUrl,
        originalUrl: data.originalUrl,
      });
    } catch (e) {
      updateRow(row.id, {
        status: "error",
        error: e instanceof Error ? e.message : "שגיאה לא ידועה",
      });
    }
  }

  async function addFiles(files: File[]) {
    const newRows: CreationRow[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending",
      modelNumber: "",
      sku: "",
      price: "",
      logoId: "",
      sizeMin: "",
      sizeMax: "",
      color: "",
    }));
    setRows((prev) => [...prev, ...newRows]);

    // Snapshot the prompt at drop-time: it's what drives the AI call itself,
    // so it must be locked in before generation starts, not editable after.
    const promptSnapshot = customPrompt;
    const queue = [...newRows];
    async function worker() {
      while (queue.length > 0) {
        const row = queue.shift();
        if (row) await processRow(row, promptSnapshot);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
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
      // fields aren't filled in yet then.
      const finalized = await Promise.all(
        readyRows.map(async (r) => {
          if (!burnText) return { row: r, imageUrl: r.imageUrl, burned: false };
          const res = await fetch("/api/apply-text-overlay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: r.imageUrl,
              modelNumber: r.modelNumber || null,
              sku: r.sku || null,
              sizeMin: r.sizeMin ? Number(r.sizeMin) : null,
              sizeMax: r.sizeMax ? Number(r.sizeMax) : null,
              color: r.color || null,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "הוספת הטקסט לתמונה נכשלה");
          return { row: r, imageUrl: data.imageUrl as string, burned: true };
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
  };
}
