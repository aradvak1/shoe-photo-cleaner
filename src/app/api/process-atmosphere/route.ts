import { randomUUID } from "node:crypto";
import { generateAtmosphereImage } from "@/lib/photoroom";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");
  const prompt = formData.get("prompt");
  const customPrompt = typeof prompt === "string" ? prompt.trim() : "";

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'image' file" }, { status: 400 });
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const originalPath = `${id}/original.${ext}`;
  const cleanPath = `${id}/clean.png`;
  const mimeType = file.type || "image/jpeg";

  const supabase = getSupabaseAdmin();

  const [cleanImage, originalUpload] = await Promise.all([
    generateAtmosphereImage(originalBuffer, file.name, mimeType, {
      prompt: customPrompt || undefined,
    }),
    supabase.storage
      .from("originals")
      .upload(originalPath, originalBuffer, {
        contentType: mimeType,
        upsert: false,
      }),
  ]);

  if (originalUpload.error) {
    return Response.json(
      { error: `Failed to store original: ${originalUpload.error.message}` },
      { status: 500 }
    );
  }

  const cleanUpload = await supabase.storage
    .from("clean-images")
    .upload(cleanPath, cleanImage, { contentType: "image/png", upsert: false });

  if (cleanUpload.error) {
    return Response.json(
      { error: `Failed to store clean image: ${cleanUpload.error.message}` },
      { status: 500 }
    );
  }

  const { data: originalUrl } = supabase.storage
    .from("originals")
    .getPublicUrl(originalPath);
  const { data: cleanUrl } = supabase.storage
    .from("clean-images")
    .getPublicUrl(cleanPath);

  return Response.json({
    imageUrl: cleanUrl.publicUrl,
    originalUrl: originalUrl.publicUrl,
  });
}
