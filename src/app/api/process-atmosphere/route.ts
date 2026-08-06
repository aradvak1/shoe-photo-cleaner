import { randomUUID } from "node:crypto";
import { generateAtmosphereImage } from "@/lib/gemini";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
// This project has Fluid Compute enabled (confirmed via the Vercel API —
// "fluid": true on the project), which raises the real ceiling to 800s on
// Pro. A generation call should never realistically approach 300s; this is
// deliberately generous headroom so the function's own timeout is no
// longer a plausible cause of the client seeing a truncated response
// ("Unexpected end of JSON input").
export const maxDuration = 300;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");
  const prompt = formData.get("prompt");
  const customPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const styleReferenceUrl = formData.get("style_reference_url");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'image' file" }, { status: 400 });
  }

  // See process-image/route.ts for why: the already-approved sample for
  // this batch, sent along so the rest of the batch visually matches its
  // scene/lighting instead of each call reinterpreting the same text prompt.
  let styleReference: { buffer: Buffer; mimeType: string } | undefined;
  if (typeof styleReferenceUrl === "string" && styleReferenceUrl) {
    const refRes = await fetch(styleReferenceUrl).catch(() => null);
    if (refRes?.ok) {
      styleReference = {
        buffer: Buffer.from(await refRes.arrayBuffer()),
        mimeType: refRes.headers.get("content-type") || "image/png",
      };
    }
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const originalPath = `${id}/original.${ext}`;
  const cleanPath = `${id}/clean.png`;
  const mimeType = file.type || "image/jpeg";

  const supabase = getSupabaseAdmin();

  // See process-image/route.ts for why this must be caught: an uncaught
  // Gemini failure here produces a bare, bodyless 500 that the client's
  // res.json() can't parse — that gets misread as a dropped connection
  // ("network overload") instead of surfacing the real error.
  let cleanImage: Buffer;
  let originalUploadError: string | null;
  try {
    const [ci, ou] = await Promise.all([
      generateAtmosphereImage(originalBuffer, file.name, mimeType, {
        prompt: customPrompt || undefined,
        styleReference,
      }),
      supabase.storage
        .from("originals")
        .upload(originalPath, originalBuffer, {
          contentType: mimeType,
          upsert: false,
        }),
    ]);
    cleanImage = ci;
    originalUploadError = ou.error?.message ?? null;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "עיבוד ה-AI נכשל" },
      { status: 500 }
    );
  }

  if (originalUploadError) {
    return Response.json(
      { error: `Failed to store original: ${originalUploadError}` },
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
