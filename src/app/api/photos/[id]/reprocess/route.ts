import { editWithBackgroundPrompt, generateAtmosphereImage } from "@/lib/gemini";
import { renderPhoto } from "@/lib/renderPhoto";
import { resolveTemplate } from "@/lib/photoTemplate";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function mimeTypeFromUrl(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/**
 * Re-edits an already-saved photo from scratch: re-runs the same AI
 * generation (same original source photo + same prompt it was made with,
 * unless overridden) so a fresh clean image exists to apply the new
 * zoom/fields/template to — the clean pre-burn image from the original
 * run no longer exists once text was burned onto it (apply-text-overlay
 * overwrites that same storage path). This is one explicit AI call,
 * triggered only when the user opens this specific photo and applies a
 * change — never run in bulk across a whole gallery.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  const { data: photo, error: fetchError } = await supabase
    .from("photos")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !photo) {
    return Response.json({ error: fetchError?.message || "Photo not found" }, { status: 404 });
  }

  const originalRes = await fetch(photo.original_url);
  if (!originalRes.ok) {
    return Response.json({ error: "Failed to fetch original source photo" }, { status: 500 });
  }
  const originalBuffer = Buffer.from(await originalRes.arrayBuffer());
  const mimeType = mimeTypeFromUrl(photo.original_url);

  const prompt = typeof body.prompt === "string" ? body.prompt : (photo.custom_prompt ?? undefined);
  let cleanImage: Buffer;
  try {
    cleanImage =
      photo.mode === "atmosphere"
        ? await generateAtmosphereImage(originalBuffer, "original", mimeType, { prompt })
        : await editWithBackgroundPrompt(originalBuffer, "original", mimeType, prompt);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "עיבוד ה-AI נכשל" },
      { status: 500 }
    );
  }

  const templateId: string | null =
    typeof body.template_id === "string" ? body.template_id : (photo.template_id ?? null);
  const zoom: number | null = typeof body.zoom === "number" ? body.zoom : (photo.zoom ?? null);
  const modelNumber = body.model_number !== undefined ? body.model_number : photo.model_number;
  const sku = body.sku !== undefined ? body.sku : photo.sku;
  const price = body.price !== undefined ? body.price : photo.price;
  const sizeMin = body.size_min !== undefined ? body.size_min : photo.size_min;
  const sizeMax = body.size_max !== undefined ? body.size_max : photo.size_max;
  const color = body.color !== undefined ? body.color : photo.color;
  const logoId: string | null = body.logo_id !== undefined ? body.logo_id : photo.logo_id;
  const customLayout = body.custom_layout !== undefined ? body.custom_layout : photo.custom_layout;

  let logoUrl: string | null = null;
  if (logoId) {
    const { data: logo } = await supabase
      .from("logos")
      .select("image_url")
      .eq("id", logoId)
      .single();
    logoUrl = logo?.image_url ?? null;
  }

  const template = await resolveTemplate(templateId, supabase);
  const burned = await renderPhoto(
    cleanImage,
    { modelNumber, sku, price, sizeMin, sizeMax, color },
    logoUrl,
    template,
    zoom,
    customLayout
  );

  const marker = "/clean-images/";
  const idx = (photo.image_url as string).indexOf(marker);
  const path = idx === -1 ? `${id}/clean.png` : (photo.image_url as string).slice(idx + marker.length).split("?")[0];

  const { error: uploadError } = await supabase.storage
    .from("clean-images")
    .upload(path, burned, { contentType: "image/png", upsert: true });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }
  const { data: publicUrl } = supabase.storage.from("clean-images").getPublicUrl(path);
  const newImageUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { data: updated, error: updateError } = await supabase
    .from("photos")
    .update({
      image_url: newImageUrl,
      model_number: modelNumber || null,
      sku: sku || null,
      price: price ?? null,
      size_min: sizeMin ?? null,
      size_max: sizeMax ?? null,
      color: color || null,
      logo_id: logoId || null,
      template_id: templateId || null,
      zoom: zoom ?? null,
      custom_layout: customLayout ?? null,
      burned_text: true,
    })
    .eq("id", id)
    .select()
    .single();
  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ photo: updated });
}
