import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTemplate } from "@/lib/photoTemplate";
import type { CatalogPhotoEntry } from "./templates/types";
import type { Logo, Photo } from "@/types";

export async function fetchAsBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// Product photos come out of the generation pipeline as large PNGs
// (~1.5MB each). Embedded as-is, a multi-page catalog's PDF quickly blows
// past Supabase Storage's 50MB project-wide upload limit — and is
// unwieldy to send to a client either way. Re-encoding as JPEG cuts each
// photo to ~40-60KB with no visible quality loss for a printed/shared
// catalog. Not used for logos, which need their transparent background.
export async function compressPhotoForPdf(buffer: Buffer | null): Promise<Buffer | null> {
  if (!buffer) return null;
  try {
    return await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return buffer;
  }
}

/** Loads photos (in the given order) + their logos and builds the entries generateCatalogPdf expects. */
export async function buildCatalogEntries(
  supabase: SupabaseClient,
  photoIds: string[]
): Promise<CatalogPhotoEntry[]> {
  const { data: photos, error } = await supabase.from("photos").select("*").in("id", photoIds);
  if (error || !photos) {
    throw new Error(error?.message || "Failed to load photos");
  }
  const photosById = new Map<string, Photo>(photos.map((p: Photo) => [p.id, p]));

  const logoIds = [...new Set(photos.map((p: Photo) => p.logo_id).filter(Boolean))] as string[];
  let logosById = new Map<string, Logo>();
  if (logoIds.length > 0) {
    const { data: logos } = await supabase.from("logos").select("*").in("id", logoIds);
    logosById = new Map((logos ?? []).map((l: Logo) => [l.id, l]));
  }

  const orderedPhotos = photoIds
    .map((id) => photosById.get(id))
    .filter((p): p is Photo => Boolean(p));

  return Promise.all(
    orderedPhotos.map(async (photo) => {
      const logo = photo.logo_id ? logosById.get(photo.logo_id) : null;
      const [rawImageData, logoData] = await Promise.all([
        fetchAsBuffer(photo.image_url),
        fetchAsBuffer(logo?.image_url ?? null),
      ]);
      const imageData = await compressPhotoForPdf(rawImageData);
      return {
        imageData: imageData ?? Buffer.alloc(0),
        logoData,
        modelNumber: photo.model_number,
        price: photo.price,
        logoName: logo?.name ?? null,
        sizeMin: photo.size_min,
        sizeMax: photo.size_max,
        burnedFields: await resolveBurnedFields(photo, supabase),
      };
    })
  );
}

/**
 * Which fields are already burned onto the photo's own pixels, so the PDF
 * caption doesn't repeat them as separate text underneath. A template burn
 * (burnProductTextFromTemplate) only draws the fields the template itself
 * defines — a logo-only template burns nothing else — so this resolves the
 * actual template rather than assuming all fields were drawn. Auto-placement
 * (burnProductText, no template) always burns model number and sizes when
 * present, but never price — see composite.ts.
 */
async function resolveBurnedFields(
  photo: Photo,
  supabase: SupabaseClient
): Promise<CatalogPhotoEntry["burnedFields"]> {
  if (!photo.burned_text) return { model: false, price: false, sizes: false };
  if (!photo.template_id) return { model: true, price: false, sizes: true };
  const template = await resolveTemplate(photo.template_id, supabase);
  return {
    model: Boolean(template?.modelNumber),
    price: Boolean(template?.price),
    sizes: Boolean(template?.sizes),
  };
}
