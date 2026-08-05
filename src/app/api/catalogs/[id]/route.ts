import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateCatalogPdf } from "@/lib/pdf/generateCatalogPdf";
import { CATALOG_TEMPLATES } from "@/lib/pdf/templates";
import { buildCatalogEntries, fetchAsBuffer } from "@/lib/pdf/buildCatalogEntries";
import type { CatalogCoverData } from "@/lib/pdf/templates/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: catalog, error } = await supabase
    .from("catalogs")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !catalog) {
    return Response.json({ error: "Catalog not found" }, { status: 404 });
  }

  const { data: links } = await supabase
    .from("catalog_photos")
    .select("photo_id, position")
    .eq("catalog_id", id)
    .order("position", { ascending: true });

  const photoIds = (links ?? []).map((l) => l.photo_id);
  let photos: unknown[] = [];
  if (photoIds.length > 0) {
    const { data } = await supabase.from("photos").select("*").in("id", photoIds);
    const byId = new Map((data ?? []).map((p) => [p.id, p]));
    photos = photoIds.map((pid) => byId.get(pid)).filter(Boolean);
  }

  return Response.json({ catalog, photos });
}

/**
 * Regenerates an existing catalog's PDF (e.g. after changing template_id
 * from a 4-per-page grid to 1-per-page) using the same photo set and
 * cover — no need to rebuild the catalog from scratch or re-pick photos.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  const { data: catalog, error: fetchError } = await supabase
    .from("catalogs")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !catalog) {
    return Response.json({ error: fetchError?.message || "Catalog not found" }, { status: 404 });
  }

  const templateId = typeof body.template_id === "string" ? body.template_id : catalog.template_id;
  if (!CATALOG_TEMPLATES[templateId]) {
    return Response.json({ error: "Unknown template_id" }, { status: 400 });
  }

  const { data: links, error: linksError } = await supabase
    .from("catalog_photos")
    .select("photo_id, position")
    .eq("catalog_id", id)
    .order("position", { ascending: true });
  if (linksError) {
    return Response.json({ error: linksError.message }, { status: 500 });
  }
  const photoIds = (links ?? []).map((l) => l.photo_id);
  if (photoIds.length === 0) {
    return Response.json({ error: "This catalog has no photos" }, { status: 400 });
  }

  let cover: CatalogCoverData | undefined;
  const hasCover = Boolean(
    catalog.cover_title || catalog.cover_subtitle || catalog.cover_extra_text || catalog.cover_logo_id
  );
  if (hasCover) {
    let coverLogoUrl: string | null = null;
    if (catalog.cover_logo_id) {
      const { data: coverLogo } = await supabase
        .from("logos")
        .select("image_url")
        .eq("id", catalog.cover_logo_id)
        .single();
      coverLogoUrl = coverLogo?.image_url ?? null;
    }
    cover = {
      title: catalog.cover_title,
      subtitle: catalog.cover_subtitle,
      extraText: catalog.cover_extra_text,
      logoData: await fetchAsBuffer(coverLogoUrl),
    };
  }

  let entries;
  try {
    entries = await buildCatalogEntries(supabase, photoIds);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to load photos" },
      { status: 500 }
    );
  }

  // Regenerating an existing catalog — its current pdf_url stays valid
  // untouched if this fails, so (unlike POST's create path) there's
  // nothing to roll back here, just a clean error instead of crashing
  // into a bodyless 500.
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateCatalogPdf(templateId, catalog.name, entries, cover);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "יצירת ה-PDF נכשלה" },
      { status: 500 }
    );
  }

  const pdfPath = `${id}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("catalogs")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }
  const { data: publicUrl } = supabase.storage.from("catalogs").getPublicUrl(pdfPath);

  const { data: updatedCatalog, error: updateError } = await supabase
    .from("catalogs")
    .update({ template_id: templateId, pdf_url: `${publicUrl.publicUrl}?v=${Date.now()}` })
    .eq("id", id)
    .select()
    .single();
  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ catalog: updatedCatalog });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("catalogs").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await supabase.storage.from("catalogs").remove([`${id}.pdf`]);

  return new Response(null, { status: 204 });
}
