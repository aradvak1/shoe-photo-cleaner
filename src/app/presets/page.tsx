"use client";

import { useEffect, useState } from "react";
import { useLogos } from "@/components/LogoSelect";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Reveal } from "@/components/motion/Reveal";
import { MetadataFieldPicker } from "@/components/create/PhotoMetadataFields";
import type { RowMetadataValues } from "@/components/create/PhotoMetadataFields";
import type { Preset, PhotoMode } from "@/types";

const MODE_LABELS: Record<PhotoMode, string> = {
  studio: "סטודיו",
  atmosphere: "אווירה",
};

const EMPTY_FIELDS: RowMetadataValues = {
  modelNumber: "",
  sku: "",
  price: "",
  logoId: "",
  sizeMin: "",
  sizeMax: "",
  color: "",
};

function presetToFields(preset: Preset): RowMetadataValues {
  return {
    modelNumber: preset.model_number ?? "",
    sku: preset.sku ?? "",
    price: preset.price != null ? String(preset.price) : "",
    logoId: preset.logo_id ?? "",
    sizeMin: preset.size_min != null ? String(preset.size_min) : "",
    sizeMax: preset.size_max != null ? String(preset.size_max) : "",
    color: preset.color ?? "",
  };
}

function summarizePreset(preset: Preset): string {
  const parts: string[] = [];
  if (preset.model_number) parts.push(`דגם ${preset.model_number}`);
  if (preset.sku) parts.push(`מק״ט ${preset.sku}`);
  if (preset.price != null) parts.push(`₪${preset.price}`);
  if (preset.size_min != null || preset.size_max != null) {
    parts.push(`מידות ${preset.size_min ?? "?"}-${preset.size_max ?? "?"}`);
  }
  if (preset.color) parts.push(preset.color);
  if (preset.logo_id) parts.push("לוגו");
  if (preset.burn_text) parts.push("צריבת טקסט");
  return parts.length > 0 ? parts.join(" · ") : "ללא פרטים נוספים";
}

export default function PresetsPage() {
  const { logos, setLogos } = useLogos();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<PhotoMode>("studio");
  const [prompt, setPrompt] = useState("");
  const [burnText, setBurnText] = useState(false);
  const [fields, setFields] = useState<RowMetadataValues>(EMPTY_FIELDS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadPresets() {
    fetch("/api/presets")
      .then((res) => res.json())
      .then((data) => setPresets(data.presets ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadPresets, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setMode("studio");
    setPrompt("");
    setBurnText(false);
    setFields(EMPTY_FIELDS);
    setError(null);
  }

  function openNew() {
    resetForm();
    setOpen(true);
  }

  function openEdit(preset: Preset) {
    setEditingId(preset.id);
    setName(preset.name);
    setMode(preset.mode);
    setPrompt(preset.prompt ?? "");
    setBurnText(preset.burn_text);
    setFields(presetToFields(preset));
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("יש להזין שם לעיצוב");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        mode,
        prompt: prompt.trim() || null,
        logo_id: fields.logoId || null,
        burn_text: burnText,
        model_number: fields.modelNumber || null,
        sku: fields.sku || null,
        price: fields.price ? Number(fields.price) : null,
        size_min: fields.sizeMin ? Number(fields.sizeMin) : null,
        size_max: fields.sizeMax ? Number(fields.sizeMax) : null,
        color: fields.color || null,
      };
      const res = await fetch(editingId ? `/api/presets/${editingId}` : "/api/presets", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שמירת העיצוב נכשלה");

      if (editingId) {
        setPresets((prev) => prev.map((p) => (p.id === editingId ? data.preset : p)));
      } else {
        setPresets((prev) => [data.preset, ...prev]);
      }
      setOpen(false);
      resetForm();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">עיצובים שמורים</h1>
          <p className="mt-1 text-sm text-muted">
            הגדירו מראש שילובים של דגם, מידות, צבע, מחיר, לוגו וכיוון ל-AI — כדי לבחור אותם
            במקום למלא את אותם הפרטים בכל פעם מחדש.
          </p>
        </div>
        <Button onClick={openNew}>+ עיצוב חדש</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">טוען…</p>
      ) : presets.length === 0 ? (
        <Card>
          <CardBody className="text-center text-sm text-muted">
            עדיין אין עיצובים שמורים. לחצו על &quot;+ עיצוב חדש&quot; כדי להתחיל.
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset, i) => (
            <Reveal key={preset.id} index={i}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{preset.name}</p>
                    <Badge>{MODE_LABELS[preset.mode]}</Badge>
                  </div>
                  {preset.prompt && (
                    <p className="line-clamp-2 text-xs text-muted">{preset.prompt}</p>
                  )}
                  <p className="text-xs text-muted">{summarizePreset(preset)}</p>
                  <div className="flex gap-3 border-t border-border pt-2 text-xs">
                    <button
                      onClick={() => openEdit(preset)}
                      className="text-accent hover:underline"
                    >
                      עריכה
                    </button>
                    <button
                      onClick={() => handleDelete(preset.id)}
                      className="text-danger hover:underline"
                    >
                      מחיקה
                    </button>
                  </div>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title={editingId ? "עריכת עיצוב שמור" : "עיצוב שמור חדש"}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="שם העיצוב"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: קולקציית קיץ"
          />

          <div>
            <p className="mb-1 text-xs font-medium text-muted">מצב</p>
            <div className="flex gap-2">
              {(["studio", "atmosphere"] as PhotoMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    mode === m
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-muted hover:border-border-strong"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="כיוון ל-AI (לא חובה)"
            placeholder='לדוגמה: "רקע בז׳ חמים במקום לבן אחיד"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
          />

          <div>
            <p className="mb-1 text-xs font-medium text-muted">פרטים קבועים</p>
            <MetadataFieldPicker
              values={fields}
              onChange={(patch) => setFields((prev) => ({ ...prev, ...patch }))}
              logos={logos}
              onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={burnText}
              onChange={(e) => setBurnText(e.target.checked)}
            />
            צריבת הפרטים על התמונה
          </label>

          {error && <p className="text-xs text-danger">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "שומר…" : "שמירה"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
