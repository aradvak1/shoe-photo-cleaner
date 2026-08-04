import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Uploads a just-added raw photo immediately (before any AI processing) so
 * the design toolbar has a real, server-fetchable URL to render live
 * zoom/logo/field previews against — a browser blob: URL only exists in
 * this tab's memory and can't be fetched by the preview-overlay route.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'image' file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${randomUUID()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from("originals")
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("originals").getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
