"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Reveal } from "@/components/motion/Reveal";
import { CATALOG_TEMPLATE_META } from "@/lib/pdf/templates/meta";
import type { Photo } from "@/types";

const TEMPLATES = CATALOG_TEMPLATE_META.map((t) => ({
  id: t.slug,
  label: t.label,
  description: t.description,
}));

export function CatalogBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoIds = (searchParams.get("photo_ids") ?? "").split(",").filter(Boolean);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (photoIds.length === 0) return;
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data: { photos: Photo[] }) => {
        const byId = new Map(data.photos.map((p) => [p.id, p]));
        setPhotos(photoIds.map((id) => byId.get(id)).filter((p): p is Photo => Boolean(p)));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleCreate() {
    if (!name.trim()) {
      setError("יש להזין שם לקטלוג");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/catalogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), template_id: templateId, photo_ids: photoIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "יצירת הקטלוג נכשלה");
      router.push(`/catalog/${data.catalog.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
      setCreating(false);
    }
  }

  if (photoIds.length === 0) {
    return (
      <Card>
        <CardBody className="text-center text-sm text-muted">
          לא נבחרו תמונות. חזרו לגלריה ובחרו תמונות ליצירת הקטלוג.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">קטלוג חדש</h1>
        <p className="mt-1 text-sm text-muted">{photos.length} תמונות נבחרו.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {photos.map((photo) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.id}
            src={photo.image_url}
            alt={photo.model_number ?? "תמונה"}
            className="h-20 w-20 rounded-sm border border-border bg-white object-contain"
          />
        ))}
      </div>

      <Input
        label="שם הקטלוג"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="לדוגמה: קולקציית קיץ 2026"
      />

      <div>
        <p className="mb-2 text-xs font-medium text-muted">תבנית</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t, i) => (
            <Reveal key={t.id} index={i}>
              <Card
                interactive
                onClick={() => setTemplateId(t.id)}
                className={templateId === t.id ? "border-accent ring-1 ring-accent" : ""}
              >
                <CardBody>
                  <p className="font-medium">{t.label}</p>
                  <p className="mt-1 text-xs text-muted">{t.description}</p>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button onClick={handleCreate} disabled={creating}>
        {creating ? "יוצר PDF…" : "יצירת קטלוג"}
      </Button>
    </div>
  );
}
