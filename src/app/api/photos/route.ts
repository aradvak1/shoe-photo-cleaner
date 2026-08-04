import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PhotoMode } from "@/types";

export const runtime = "nodejs";

interface PhotoInput {
  image_url: string;
  original_url: string;
  model_number?: string | null;
  sku?: string | null;
  price?: number | null;
  logo_id?: string | null;
  batch_id?: string | null;
  size_min?: number | null;
  size_max?: number | null;
  color?: string | null;
  custom_prompt?: string | null;
  mode?: PhotoMode;
  burned_text?: boolean;
  template_id?: string | null;
  zoom?: number | null;
  custom_layout?: object | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch_id");
  const mode = searchParams.get("mode");
  const q = searchParams.get("q");
  const logoId = searchParams.get("logo_id");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });

  if (batchId) query = query.eq("batch_id", batchId);
  if (mode) query = query.eq("mode", mode);
  if (logoId) query = query.eq("logo_id", logoId);
  if (q) query = query.ilike("model_number", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ photos: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const items: PhotoInput[] = Array.isArray(body) ? body : [body];

  if (items.length === 0) {
    return Response.json({ error: "No items to save" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.image_url || !item.original_url) {
      return Response.json(
        { error: "Each item requires image_url and original_url" },
        { status: 400 }
      );
    }
  }

  const rows = items.map((item) => ({
    image_url: item.image_url,
    original_url: item.original_url,
    model_number: item.model_number || null,
    sku: item.sku || null,
    price: item.price ?? null,
    logo_id: item.logo_id || null,
    ...(item.batch_id ? { batch_id: item.batch_id } : {}),
    size_min: item.size_min ?? null,
    size_max: item.size_max ?? null,
    color: item.color || null,
    custom_prompt: item.custom_prompt || null,
    mode: item.mode || "studio",
    burned_text: item.burned_text ?? false,
    template_id: item.template_id || null,
    zoom: item.zoom ?? null,
    custom_layout: item.custom_layout ?? null,
    status: "approved" as const,
  }));

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("photos").insert(rows).select();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ photos: data }, { status: 201 });
}
