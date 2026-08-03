"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLogos } from "@/components/LogoSelect";
import { downloadFile } from "@/lib/downloadFile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Reveal } from "@/components/motion/Reveal";
import type { Photo, PhotoMode } from "@/types";

export default function PhotosPage() {
  const { logos } = useLogos();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<PhotoMode | "">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    </div>
  );
}
