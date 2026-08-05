"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import type { RowMetadataValues } from "@/components/create/PhotoMetadataFields";
import type { CustomLayout } from "@/lib/photoTemplate";
import type { Preset, PhotoMode } from "@/types";

/**
 * Saves/reapplies a whole "look" (prompt + default logo + burn-text + the
 * default field values — model/SKU/price/sizes/color) as a named preset,
 * scoped per mode. Presets can also be created/edited ahead of time from
 * the dedicated /presets management page; this bar covers quick inline
 * save/apply/delete during an active creation session.
 */
export function PresetBar({
  mode,
  disabled,
  currentPrompt,
  currentLogoId,
  currentBurnText,
  currentTemplateId,
  currentDefaults,
  currentZoom,
  currentCustomLayout,
  onApply,
}: {
  mode: PhotoMode;
  /** True once processing has started — a preset's prompt can no longer affect already-dropped photos, so applying one is locked, same as the prompt field itself. */
  disabled: boolean;
  currentPrompt: string;
  currentLogoId: string;
  currentBurnText: boolean;
  currentTemplateId: string;
  currentDefaults: Partial<RowMetadataValues>;
  /** Product-size zoom and the drag/resize layout overrides from the design toolbar — optional, only meaningful for the studio design flow. */
  currentZoom?: number;
  currentCustomLayout?: CustomLayout;
  onApply: (preset: Preset) => void;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/presets?mode=${mode}`)
      .then((res) => res.json())
      .then((data) => setPresets(data.presets ?? []));
  }, [mode]);

  async function handleSave() {
    if (!name.trim()) {
      setError("יש להזין שם לעיצוב");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mode,
          prompt: currentPrompt || null,
          logo_id: currentLogoId || null,
          burn_text: currentBurnText,
          template_id: currentTemplateId || null,
          model_number: currentDefaults.modelNumber || null,
          sku: currentDefaults.sku || null,
          price: currentDefaults.price ? Number(currentDefaults.price) : null,
          size_min: currentDefaults.sizeMin ? Number(currentDefaults.sizeMin) : null,
          size_max: currentDefaults.sizeMax ? Number(currentDefaults.sizeMax) : null,
          color: currentDefaults.color || null,
          zoom: currentZoom ?? null,
          custom_layout: currentCustomLayout ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שמירת העיצוב נכשלה");
      setPresets((prev) => [data.preset, ...prev]);
      setOpen(false);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/presets/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">עיצובים שמורים</p>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-1 pl-3 text-xs ${
              disabled ? "opacity-50" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onApply(preset)}
              disabled={disabled}
              className="font-medium text-ink hover:text-accent disabled:cursor-not-allowed"
            >
              {preset.name}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(preset.id)}
              aria-label={`מחיקת ${preset.name}`}
              className="text-muted hover:text-danger"
            >
              ✕
            </button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          + שמירת העיצוב הנוכחי
        </Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="שמירת עיצוב שמור">
        <div className="space-y-4">
          <Input
            label="שם העיצוב"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: רקע בז' חמים"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "שומר…" : "שמירה"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
