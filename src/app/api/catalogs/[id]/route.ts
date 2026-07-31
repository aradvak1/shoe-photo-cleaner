import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
