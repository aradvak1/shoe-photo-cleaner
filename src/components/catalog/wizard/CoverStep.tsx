"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Reveal } from "@/components/motion/Reveal";
import { LogoSelect, useLogos } from "@/components/LogoSelect";
import { CATALOG_TEMPLATE_META } from "@/lib/pdf/templates/meta";
import type { CatalogStyleCategory, Photo } from "@/types";

export function CoverStep({
  batchId,
  styleCategory,
  lookId,
  resolvedPrompt,
  onCreated,
}: {
  batchId: string;
  styleCategory: CatalogStyleCategory | null;
  lookId: string | null;
  resolvedPrompt: string;
  onCreated: (catalogId: string) => void;
}) {
  const { logos, setLogos } = useLogos();
  const [name, setName] = useState("");
  const [coverTitle, setCoverTitle] = useState("");
  const [coverSubtitle, setCoverSubtitle] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [coverExtraText, setCoverExtraText] = useState("");
  const [coverLogoId, setCoverLogoId] = useState("");
  const [templateId, setTemplateId] = useState(CATALOG_TEMPLATE_META[0].slug);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const catalogName = name.trim();
    if (!catalogName) {
      setError("יש להזין שם לקטלוג");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const photosRes = await fetch(`/api/photos?batch_id=${batchId}`);
      const photosData = await photosRes.json();
      if (!photosRes.ok) throw new Error(photosData.error || "טעינת התמונות נכשלה");
      // /api/photos defaults to newest-first — flip to processing order so
      // the catalog's page order matches the order photos were approved in.
      const photoIds = (photosData.photos as Photo[])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((p) => p.id);

      if (photoIds.length === 0) {
        throw new Error("לא נמצאו תמונות שמורות מהשלב הקודם");
      }

      const res = await fetch("/api/catalogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catalogName,
          template_id: templateId,
          photo_ids: photoIds,
          style_category: styleCategory,
          look_id: lookId,
          resolved_prompt: resolvedPrompt || null,
          cover_title: coverTitle.trim() || catalogName,
          cover_subtitle: coverSubtitle.trim() || null,
          cover_extra_text: coverExtraText.trim() || null,
          cover_logo_id: coverLogoId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "יצירת הקטלוג נכשלה");
      onCreated(data.catalog.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">עמוד שער וסיום</h1>
        <p className="mt-1 text-sm text-muted">
          עמוד השער הוא העמוד הראשון בקטלוג — לוגו גדול וכותרת. שדה הכותרת/תת-כותרת מוצג כברירת מחדל;
          אפשר להוסיף גם טקסט חופשי נוסף אם רוצים.
        </p>
      </div>

      <Input
        label="שם הקטלוג"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='לדוגמה: "קטלוג חורף 2026 גרציה דונה"'
      />

      <div>
        <p className="mb-1 text-xs font-medium text-muted">לוגו לעמוד השער</p>
        <LogoSelect
          logos={logos}
          value={coverLogoId}
          onChange={setCoverLogoId}
          onLogoAdded={(logo) => setLogos((prev) => [...prev, logo])}
        />
      </div>

      <Input
        label="כותרת עמוד השער"
        caption='ריק = ישתמש בשם הקטלוג. לדוגמה: "קטלוג חורף 2026"'
        value={coverTitle}
        onChange={(e) => setCoverTitle(e.target.value)}
        placeholder={name || "קטלוג חורף 2026"}
      />
      <Input
        label="תת-כותרת"
        caption='לדוגמה: "גרציה דונה"'
        value={coverSubtitle}
        onChange={(e) => setCoverSubtitle(e.target.value)}
        placeholder="גרציה דונה"
      />

      {!showExtra ? (
        <Button variant="ghost" size="sm" onClick={() => setShowExtra(true)}>
          + הוספת עוד טקסט לעמוד השער
        </Button>
      ) : (
        <Textarea
          label="טקסט נוסף (לא חובה)"
          value={coverExtraText}
          onChange={(e) => setCoverExtraText(e.target.value)}
          rows={2}
        />
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-muted">תבנית לעמודי המוצרים</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CATALOG_TEMPLATE_META.map((t, i) => (
            <Reveal key={t.slug} index={i}>
              <Card
                interactive
                onClick={() => setTemplateId(t.slug)}
                className={templateId === t.slug ? "border-accent ring-1 ring-accent" : ""}
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
        {creating ? "יוצר PDF…" : "יצירת הקטלוג"}
      </Button>
    </div>
  );
}
