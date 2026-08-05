import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  const supabase = getSupabaseAdmin();
  let query = supabase.from("presets").select("*").order("created_at", { ascending: false });
  if (mode) query = query.eq("mode", mode);

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ presets: data });
}

export async function POST(request: Request) {
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
    .insert({
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
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ preset: data }, { status: 201 });
}
