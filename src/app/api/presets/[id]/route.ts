import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const mode = body.mode;

  if (!name) {
    return Response.json({ error: "Missing preset name" }, { status: 400 });
  }
  if (mode !== "studio" && mode !== "atmosphere") {
    return Response.json({ error: "Invalid mode" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("presets")
    .update({
      name,
      mode,
      prompt: body.prompt ?? null,
      logo_id: body.logo_id ?? null,
      burn_text: Boolean(body.burn_text),
      model_number: body.model_number ?? null,
      sku: body.sku ?? null,
      price: body.price ?? null,
      size_min: body.size_min ?? null,
      size_max: body.size_max ?? null,
      color: body.color ?? null,
      template_id: body.template_id ?? null,
      zoom: body.zoom ?? null,
      custom_layout: body.custom_layout ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ preset: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("presets").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
