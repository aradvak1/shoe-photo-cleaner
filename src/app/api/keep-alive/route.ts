import { getSupabaseAdmin } from "@/lib/supabase/server";

// Vercel Cron hits this daily so the Supabase free-tier project never sits
// idle for the 7 days that trigger its auto-pause.
export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("presets").select("id").limit(1);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, pingedAt: new Date().toISOString() });
}
