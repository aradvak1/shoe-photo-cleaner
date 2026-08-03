"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLogos } from "@/components/LogoSelect";
import { downloadFile } from "@/lib/downloadFile";
import { MetadataFieldPicker } from "@/components/create/PhotoMetadataFields";
import { PHOTO_TEMPLATES } from "@/lib/photoTemplate";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Reveal } from "@/components/motion/Reveal";
import type { Photo, PhotoMode } from "@/types";

interface EditValues {
  modelNumber: string;
  sku: string;
  price: string;
  logoId: string;
  sizeMin: string;
  sizeMax: string;
  color: string;
}

function toEditValues(photo: Photo): EditValues {
  return {
    modelNumber: photo.model_number ?? "",
    sku: photo.sku ?? "",
    price: photo.price != null ? String(photo.price) : "",
    logoId: photo.logo_id ?? "",
    sizeMin: photo.size_min != null ? String(photo.size_min) : "",
    sizeMax: photo.size_max != null ? String(photo.size_max) : "",
    color: photo.color ?? "",
  };
}

export default function PhotosPage() {
  const { logos } = useLogos();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<PhotoMode | "">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [editTemplateId, setEditTemplateId] = useState("");
  const [editZoom, setEditZoom] = useState(100);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  function openEdit(photo: Photo) {
    setEditingPhoto(photo);
    setEditValues(toEditValues(photo));
    setEditTemplateId(photo.template_id ?? "");
    setEditZoom(photo.zoom ?? 100);
    setApplyError(null);
  }

  async function applyEdit() {
    if (!editingPhoto || !editValues) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch(`/api/photos/${editingPhoto.id}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_number: editValues.modelNumber || null,
          sku: editValues.sku || null,
          price: editValues.price ? Number(editValues.price) : null,
          size_min: editValues.sizeMin ? Number(editValues.sizeMin) : null,
          size_max: editValues.sizeMax ? Number(editValues.sizeMax) : null,
          color: editValues.color || null,
          logo_id: editValues.logoId || null,
          template_id: editTemplateId || null,
          zoom: editZoom,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "העדכון נכשל");
      setPhotos((prev) => prev.map((p) => (p.id === data.photo.id ? data.photo : p)));
      setEditingPhoto(data.photo);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setApplying(false);
    }
  }

  const logoById = useMemo(
    () => new Map(logos.map((l) => [l.id, l])),
    [logos]
  );

  function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (mode) params.set("mode", mode);
    fetch(`/api/photos?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setPhotos(data.photos ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [q, mode]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = Array.from(selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">גלריה</h1>
        <p className="mt-1 text-sm text-muted">כל התמונות השמורות במערכת.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי מספר דגם"
          className="w-56"
        />
        <Select value={mode} onChange={(e) => setMode(e.target.value as PhotoMode | "")}>
          <option value="">כל המצבים</option>
          <option value="studio">סטודיו</option>
          <option value="atmosphere">אווירה</option>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted">טוען…</p>
      ) : photos.length === 0 ? (
        <Card>
          <CardBody className="text-center text-sm text-muted">
            אין עדיין תמונות שמורות.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, i) => {
            const logo = photo.logo_id ? logoById.get(photo.logo_id) : null;
            const isSelected = selected.has(photo.id);
            return (
              <Reveal key={photo.id} index={i}>
                <Card
                  interactive
                  onClick={() => toggle(photo.id)}
                  className={isSelected ? "border-accent ring-1 ring-accent" : ""}
                >
                  <CardBody className="space-y-2">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(photo.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-1 top-1 h-4 w-4 accent-accent"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.image_url}
                        alt={photo.model_number ?? "תמונה"}
                        className="aspect-square w-full rounded-sm border border-border bg-white object-contain"
                      />
                    </div>
                    <p className="truncate text-sm font-medium">
                      {photo.model_number || "ללא מספר דגם"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {photo.price != null && <Badge>₪{photo.price}</Badge>}
                      {(photo.size_min || photo.size_max) && (
                        <Badge>
                          {photo.size_min ?? "?"}-{photo.size_max ?? "?"}
                        </Badge>
                      )}
                      {logo && <Badge tone="neutral">{logo.name}</Badge>}
                      <Badge tone={photo.mode === "atmosphere" ? "success" : "neutral"}>
                        {photo.mode === "atmosphere" ? "אווירה" : "סטודיו"}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(photo.image_url, `${photo.model_number || photo.id}.png`);
                        }}
                      >
                        הורדה
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(photo);
                        }}
                      >
                        עריכה
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </Reveal>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="fixed inset-x-0 bottom-0 border-t border-border bg-card px-4 py-3"
          >
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <p className="text-sm">{selectedIds.length} תמונות נבחרו</p>
              <Button href={`/catalog/new?photo_ids=${selectedIds.join(",")}`}>
                צור קטלוג מהנבחרים
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={editingPhoto !== null}
        onClose={() => setEditingPhoto(null)}
        title="עריכת תמונה"
        size="lg"
      >
        {editingPhoto && editValues && (
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={editingPhoto.image_url}
              alt={editingPhoto.model_number ?? "תמונה"}
              className="max-h-[50vh] w-full rounded-sm border border-border bg-white object-contain"
            />
            <p className="text-xs text-muted">
              שינוי כאן שולח את התמונה מחדש דרך ה-AI (עם אותה הנחיה שנוצרה איתה) ואז צורב את
              הפרטים החדשים — לוקח כמה שניות ומחליף את התמונה השמורה.
            </p>

            {editingPhoto.mode === "studio" && (
              <Select
                label="תבנית תמונה"
                value={editTemplateId}
                onChange={(e) => setEditTemplateId(e.target.value)}
              >
                <option value="">ללא תבנית (מיקום אוטומטי לפי התמונה)</option>
                {PHOTO_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>גודל המוצר בתוך התמונה</span>
                <span>{editZoom}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={160}
                step={5}
                value={editZoom}
                onChange={(e) => setEditZoom(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <MetadataFieldPicker
              values={editValues}
              onChange={(patch) => setEditValues((prev) => (prev ? { ...prev, ...patch } : prev))}
              logos={logos}
              burnsPrice={Boolean(editTemplateId)}
            />

            {applyError && <p className="text-sm text-danger">{applyError}</p>}
            <Button onClick={applyEdit} disabled={applying} className="w-full">
              {applying ? "מעדכן…" : "החלת שינויים"}
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
