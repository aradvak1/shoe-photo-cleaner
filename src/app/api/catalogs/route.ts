import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateCatalogPdf } from "@/lib/pdf/generateCatalogPdf";
import { CATALOG_TEMPLATES } from "@/lib/pdf/templates";
import type { CatalogPhotoEntry } from "@/lib/pdf/templates/types";
import type { Logo, Photo } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fetchAsBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data: catalogs, error } = await supabase
    .from("catalogs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const { data: counts } = await supabase.from("catalog_photos").select("catalog_id");
  const countByCatalog = new Map<string, number>();
  for (const row of counts ?? []) {
    countByCatalog.set(row.catalog_id, (countByCatalog.get(row.catalog_id) ?? 0) + 1);
  }

  return Response.json({
    catalogs: (catalogs ?? []).map((c) => ({
      ...c,
      photo_count: countByCatalog.get(c.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const templateId = typeof body.template_id === "string" ? body.template_id : "";
  const photoIds: string[] = Array.isArray(body.photo_ids) ? body.photo_ids : [];

  if (!name) {
    return Response.json({ error: "Missing catalog name" }, { status: 400 });
  }
  if (!CATALOG_TEMPLATES[templateId]) {
    return Response.json({ error: "Unknown template_id" }, { status: 400 });
  }
  if (photoIds.length === 0) {
    return Response.json({ error: "No photos selected" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: catalog, error: catalogError } = await supabase
    .from("catalogs")
    .insert({ name, template_id: templateId })
    .select()
    .single();
  if (catalogError || !catalog) {
    return Response.json(
      { error: catalogError?.message || "Failed to create catalog" },
      { status: 500 }
    );
  }

  const { error: linkError } = await supabase.from("catalog_photos").insert(
    photoIds.map((photoId, index) => ({
      catalog_id: catalog.id,
      photo_id: photoId,
      position: index,
    }))
  );
  if (linkError) {
    return Response.json({ error: linkError.message }, { status: 500 });
  }

  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("*")
    .in("id", photoIds);
  if (photosError || !photos) {
    return Response.json(
      { error: photosError?.message || "Failed to load photos" },
      { status: 500 }
    );
  }
  const photosById = new Map<string, Photo>(photos.map((p) => [p.id, p]));

  const logoIds = [...new Set(photos.map((p) => p.logo_id).filter(Boolean))] as string[];
  let logosById = new Map<string, Logo>();
  if (logoIds.length > 0) {
    const { data: logos } = await supabase.from("logos").select("*").in("id", logoIds);
    logosById = new Map((logos ?? []).map((l) => [l.id, l]));
  }

  const orderedPhotos = photoIds
    .map((id) => photosById.get(id))
    .filter((p): p is Photo => Boolean(p));

  const entries: CatalogPhotoEntry[] = await Promise.all(
    orderedPhotos.map(async (photo) => {
      const logo = photo.logo_id ? logosById.get(photo.logo_id) : null;
      const [imageData, logoData] = await Promise.all([
        fetchAsBuffer(photo.image_url),
        fetchAsBuffer(logo?.image_url ?? null),
      ]);
      return {
        imageData: imageData ?? Buffer.alloc(0),
        logoData,
        modelNumber: photo.model_number,
        price: photo.price,
        logoName: logo?.name ?? null,
        sizeMin: photo.size_min,
        sizeMax: photo.size_max,
      };
    })
  );

  const pdfBuffer = await generateCatalogPdf(templateId, name, entries);

  const pdfPath = `${catalog.id}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("catalogs")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from("catalogs").getPublicUrl(pdfPath);

  const { data: updatedCatalog, error: updateError } = await supabase
    .from("catalogs")
    .update({ pdf_url: publicUrl.publicUrl })
    .eq("id", catalog.id)
    .select()
    .single();
  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ catalog: updatedCatalog }, { status: 201 });
}
