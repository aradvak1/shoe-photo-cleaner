import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateCatalogPdf } from "@/lib/pdf/generateCatalogPdf";
import { CATALOG_TEMPLATES } from "@/lib/pdf/templates";
import { buildCatalogEntries, fetchAsBuffer } from "@/lib/pdf/buildCatalogEntries";
import type { CatalogCoverData } from "@/lib/pdf/templates/types";
import type { CatalogStyleCategory } from "@/types";

const STYLE_CATEGORIES: CatalogStyleCategory[] = ["atmosphere", "studio_model", "product"];

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const styleCategory: CatalogStyleCategory | null = STYLE_CATEGORIES.includes(
    body.style_category
  )
    ? body.style_category
    : null;
  const lookId = typeof body.look_id === "string" ? body.look_id : null;
  const resolvedPrompt = typeof body.resolved_prompt === "string" ? body.resolved_prompt : null;
  const coverTitle = typeof body.cover_title === "string" ? body.cover_title.trim() || null : null;
  const coverSubtitle =
    typeof body.cover_subtitle === "string" ? body.cover_subtitle.trim() || null : null;
  const coverExtraText =
    typeof body.cover_extra_text === "string" ? body.cover_extra_text.trim() || null : null;
  const coverLogoId = typeof body.cover_logo_id === "string" ? body.cover_logo_id : null;
  const hasCover = Boolean(coverTitle || coverSubtitle || coverExtraText || coverLogoId);

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
    .insert({
      name,
      template_id: templateId,
      style_category: styleCategory,
      look_id: lookId,
      resolved_prompt: resolvedPrompt,
      cover_title: coverTitle,
      cover_subtitle: coverSubtitle,
      cover_extra_text: coverExtraText,
      cover_logo_id: coverLogoId,
    })
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

  let cover: CatalogCoverData | undefined;
  if (hasCover) {
    let coverLogoUrl: string | null = null;
    if (coverLogoId) {
      const { data: coverLogo } = await supabase
        .from("logos")
        .select("image_url")
        .eq("id", coverLogoId)
        .single();
      coverLogoUrl = coverLogo?.image_url ?? null;
    }
    cover = {
      title: coverTitle,
      subtitle: coverSubtitle,
      extraText: coverExtraText,
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

  // By this point the catalog + catalog_photos rows already exist. Any
  // failure from here on (PDF worker crash, storage upload, DB update)
  // used to crash out or return an error while leaving that row behind
  // with no pdf_url — an orphaned, permanently-broken catalog cluttering
  // the list. Clean up on any failure in this block instead.
  try {
    const pdfBuffer = await generateCatalogPdf(templateId, name, entries, cover);

    const pdfPath = `${catalog.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("catalogs")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrl } = supabase.storage.from("catalogs").getPublicUrl(pdfPath);

    const { data: updatedCatalog, error: updateError } = await supabase
      .from("catalogs")
      .update({ pdf_url: publicUrl.publicUrl })
      .eq("id", catalog.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    return Response.json({ catalog: updatedCatalog }, { status: 201 });
  } catch (err) {
    await supabase.from("catalog_photos").delete().eq("catalog_id", catalog.id);
    await supabase.from("catalogs").delete().eq("id", catalog.id);
    return Response.json(
      { error: err instanceof Error ? err.message : "יצירת הקטלוג נכשלה" },
      { status: 500 }
    );
  }
}
