import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: logo } = await supabase
    .from("logos")
    .select("image_url")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("logos").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (logo?.image_url) {
    const marker = "/logos/";
    const idx = logo.image_url.indexOf(marker);
    if (idx !== -1) {
      const path = logo.image_url.slice(idx + marker.length);
      await supabase.storage.from("logos").remove([path]);
    }
  }

  return new Response(null, { status: 204 });
}
