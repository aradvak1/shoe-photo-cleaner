import { renderPhoto } from "@/lib/renderPhoto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Same rendering as apply-text-overlay (zoom + logo + fields, template or
 * auto-placement) but never writes back to storage — used to show a live
 * preview while the user drags the zoom slider or toggles fields, before
 * they've committed to anything. Returns the composited PNG directly.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const imageUrl = typeof body.image_url === "string" ? body.image_url : "";
  if (!imageUrl) {
    return Response.json({ error: "Missing image_url" }, { status: 400 });
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    return Response.json({ error: "Failed to fetch source image" }, { status: 500 });
  }
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  const supabase = getSupabaseAdmin();

  let logoUrl: string | null = null;
  const logoId = typeof body.logo_id === "string" ? body.logo_id : null;
  if (logoId) {
    const { data: logo } = await supabase
      .from("logos")
      .select("image_url")
      .eq("id", logoId)
      .single();
    logoUrl = logo?.image_url ?? null;
  }

  const fields = {
    modelNumber: body.modelNumber ?? null,
    sku: body.sku ?? null,
    price: body.price ?? null,
    sizeMin: body.sizeMin ?? null,
    sizeMax: body.sizeMax ?? null,
    color: body.color ?? null,
  };

  const templateId = typeof body.template_id === "string" ? body.template_id : null;
  const zoom = typeof body.zoom === "number" ? body.zoom : null;
  const rendered = await renderPhoto(imageBuffer, fields, logoUrl, templateId, zoom);

  return new Response(new Uint8Array(rendered), { headers: { "Content-Type": "image/png" } });
}
