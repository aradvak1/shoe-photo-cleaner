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
    query = query.in("id", idsParam.split(","));
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

  // Filenames must be computed in order first (de-duplication via
  // usedNames depends on processing sequentially), but the actual image
  // downloads don't depend on each other at all — fetching them one at a
  // time was pure wasted wall-clock time on a large export. They're
  // fetched in parallel below and appended back in original order.
  const items = (photos as Photo[]).map((photo) => {
    const logoName = photo.logo_id ? logoById.get(photo.logo_id)?.name ?? "" : "";
    const base = safeFilenamePart(photo.model_number || photo.id);
    const count = usedNames.get(base) ?? 0;
    usedNames.set(base, count + 1);
    const filename = count === 0 ? `${base}.png` : `${base}_${count + 1}.png`;
    return { photo, logoName, filename };
  });

  for (const { photo, logoName, filename } of items) {
    csvRows.push(
      [
        csvEscape(photo.model_number || ""),
        photo.price != null ? String(photo.price) : "",
        csvEscape(logoName),
        csvEscape(filename),
        csvEscape(photo.image_url),
      ].join(",")
    );
  }

  // A non-OK response is already skipped gracefully below — but fetch()
  // itself throws on a network-level failure (DNS/connection reset), which
  // previously rejected this whole Promise.all and crashed the entire
  // export (losing every other already-fetched photo) over one flaky file.
  const buffers = await Promise.all(
    items.map(async ({ photo }) => {
      try {
        const imageResponse = await fetch(photo.image_url);
        return imageResponse.ok ? Buffer.from(await imageResponse.arrayBuffer()) : null;
      } catch {
        return null;
      }
    })
  );
  items.forEach(({ filename }, i) => {
    const buffer = buffers[i];
    if (buffer) archive.append(buffer, { name: `images/${filename}` });
  });

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
