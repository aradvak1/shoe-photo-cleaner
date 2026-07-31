import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Photo, Logo } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function safeFilenamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch_id");
  const idsParam = searchParams.get("ids");

  const supabase = getSupabaseAdmin();
  let query = supabase.from("photos").select("*").order("created_at", { ascending: true });

  if (batchId) {
    query = query.eq("batch_id", batchId);
  } else if (idsParam) {
    query = query.in("ids", idsParam.split(","));
  }

  const { data: photos, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!photos || photos.length === 0) {
    return Response.json({ error: "No photos found for export" }, { status: 404 });
  }

  const { data: logos } = await supabase.from("logos").select("*");
  const logoById = new Map<string, Logo>((logos ?? []).map((l) => [l.id, l]));

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const usedNames = new Map<string, number>();

  const csvRows = [
    ["model_number", "price", "logo", "image_filename", "image_url"].join(","),
  ];

  for (const photo of photos as Photo[]) {
    const logoName = photo.logo_id ? logoById.get(photo.logo_id)?.name ?? "" : "";
    const base = safeFilenamePart(photo.model_number || photo.id);
    const count = usedNames.get(base) ?? 0;
    usedNames.set(base, count + 1);
    const filename = count === 0 ? `${base}.png` : `${base}_${count + 1}.png`;

    csvRows.push(
      [
        csvEscape(photo.model_number || ""),
        photo.price != null ? String(photo.price) : "",
        csvEscape(logoName),
        csvEscape(filename),
        csvEscape(photo.image_url),
      ].join(",")
    );

    const imageResponse = await fetch(photo.image_url);
    if (imageResponse.ok) {
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      archive.append(buffer, { name: `images/${filename}` });
    }
  }

  archive.append(csvRows.join("\n"), { name: "catalog.csv" });
  archive.finalize();

  const webStream = Readable.toWeb(archive) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="catalog-export.zip"`,
    },
  });
}
