import { burnProductText } from "@/lib/composite";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "clean-images";

export async function POST(request: Request) {
  const body = await request.json();
  const imageUrl = typeof body.image_url === "string" ? body.image_url : "";
  if (!imageUrl) {
    return Response.json({ error: "Missing image_url" }, { status: 400 });
  }

  const marker = `/${BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) {
    return Response.json({ error: "Unrecognized image_url" }, { status: 400 });
  }
  const path = imageUrl.slice(idx + marker.length);

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    return Response.json({ error: "Failed to fetch source image" }, { status: 500 });
  }
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  const burned = await burnProductText(imageBuffer, {
    modelNumber: body.modelNumber ?? null,
    sku: body.sku ?? null,
    sizeMin: body.sizeMin ?? null,
    sizeMax: body.sizeMax ?? null,
    color: body.color ?? null,
  });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, burned, { contentType: "image/png", upsert: true });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ imageUrl: `${data.publicUrl}?v=${Date.now()}` });
}
