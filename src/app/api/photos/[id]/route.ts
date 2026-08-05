import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

function storagePathFrom(url: string | null, marker: string): string | null {
  if (!url) return null;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split("?")[0];
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: photo } = await supabase
    .from("photos")
    .select("image_url, original_url")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const cleanPath = storagePathFrom(photo?.image_url ?? null, "/clean-images/");
  if (cleanPath) await supabase.storage.from("clean-images").remove([cleanPath]);
  const originalPath = storagePathFrom(photo?.original_url ?? null, "/originals/");
  if (originalPath) await supabase.storage.from("originals").remove([originalPath]);

  return new Response(null, { status: 204 });
}
