import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { CatalogTemplateEditor } from "@/components/catalog/CatalogTemplateEditor";
import { ExportImagesButton } from "@/components/catalog/ExportImagesButton";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Photo } from "@/types";

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: catalog } = await supabase.from("catalogs").select("*").eq("id", id).single();
  if (!catalog) notFound();

  const { data: links } = await supabase
    .from("catalog_photos")
    .select("photo_id, position")
    .eq("catalog_id", id)
    .order("position", { ascending: true });

  const photoIds = (links ?? []).map((l) => l.photo_id);
  let photos: Photo[] = [];
  if (photoIds.length > 0) {
    const { data } = await supabase.from("photos").select("*").in("id", photoIds);
    const byId = new Map((data ?? []).map((p) => [p.id, p]));
    photos = photoIds.map((pid) => byId.get(pid)).filter((p): p is Photo => Boolean(p));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{catalog.name}</h1>
          <p className="mt-1 text-sm text-muted">{photos.length} תמונות</p>
        </div>
        <div className="flex items-center gap-2">
          <CatalogTemplateEditor catalogId={catalog.id} currentTemplateId={catalog.template_id} />
          <ExportImagesButton photoIds={photos.map((p) => p.id)} />
          {catalog.pdf_url && <Button href={catalog.pdf_url}>הורדת PDF</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <Card key={photo.id}>
            <CardBody className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.image_url}
                alt={photo.model_number ?? "תמונה"}
                className="aspect-square w-full rounded-sm border border-border bg-white object-contain"
              />
              <p className="truncate text-sm font-medium">
                {photo.model_number || "ללא מספר דגם"}
              </p>
              {photo.price != null && <Badge>₪{photo.price}</Badge>}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
