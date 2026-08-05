import path from "node:path";
import sharp from "sharp";
import type { PhotoTemplate, TemplateTextField } from "./photoTemplate";

// Studio-mode photos are now always AI-composited by Gemini itself
// (lib/gemini.ts's editWithBackgroundPrompt) at this fixed 1080x1080
// square size — these constants only remain as the metadata-fallback
// dimensions burnProductText uses below when a saved image's own size
// can't be read.
const CANVAS_WIDTH = Number(process.env.CANVAS_WIDTH ?? 1080);
const CANVAS_HEIGHT = Number(process.env.CANVAS_HEIGHT ?? 1080);

/**
 * Crops a logo file down to its own visible (non-transparent) artwork
 * before fitting it into a box. Logo files exported from design tools
 * (e.g. a full Canva canvas) often carry a lot of transparent padding
 * around the actual mark — without trimming, `fit: "inside"` sizes to
 * that padded canvas, so enlarging the box grows mostly empty space
 * instead of the visible logo. Falls back to the untrimmed buffer if
 * trim() fails (e.g. a logo with no uniform border to detect).
 */
async function trimLogo(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer).trim().toBuffer();
  } catch {
    return buffer;
  }
}

export interface OverlayTextFields {
  modelNumber?: string | null;
  sku?: string | null;
  price?: number | null;
  sizeMin?: number | null;
  sizeMax?: number | null;
  color?: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FRANK_RUHL_FONT_PATH = path.join(
  process.cwd(),
  "src/lib/pdf/fonts/FrankRuhlLibre-Regular.ttf"
);

// No card, no border — captions sit directly on the photo. Legibility
// comes from picking a text color that contrasts with the sampled
// brightness of the region it lands on (see PALETTE_ON_LIGHT/DARK below),
// not from an opaque background shape.
const PALETTE_ON_LIGHT = { primary: "#2b2622", secondary: "#8a6a3c" };
const PALETTE_ON_DARK = { primary: "#f5f0e6", secondary: "#e3c583" };
const LUMINANCE_THRESHOLD = 150; // 0 (black) - 255 (white)

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
interface CornerScore {
  corner: Corner;
  busyness: number;
  /** 0-255 average luminance of that corner region, for text-color contrast. */
  luminance: number;
}

/**
 * Ranks all 4 corners of the image from least to most "busy" (lowest to
 * highest pixel variance in a same-sized crop at each corner), preferring
 * bottom-left on near-ties, and reports each corner's average luminance so
 * the caller can pick a text color that contrasts with it. Works uniformly
 * for a plain studio photo (flat corners) and a photoreal atmosphere scene
 * (finds the flattest region, e.g. open sky or pavement) without separate
 * logic per mode — a "least busy region" heuristic, not real scene/object
 * understanding.
 */
async function rankCornersByBusyness(
  imageBuffer: Buffer,
  regionWidth: number,
  regionHeight: number,
  imageWidth: number,
  imageHeight: number
): Promise<CornerScore[]> {
  const order: Corner[] = ["bottom-left", "bottom-right", "top-left", "top-right"];
  const w = Math.min(regionWidth, imageWidth);
  const h = Math.min(regionHeight, imageHeight);
  const positions: Record<Corner, { left: number; top: number }> = {
    "top-left": { left: 0, top: 0 },
    "top-right": { left: imageWidth - w, top: 0 },
    "bottom-left": { left: 0, top: imageHeight - h },
    "bottom-right": { left: imageWidth - w, top: imageHeight - h },
  };

  const scored = await Promise.all(
    order.map(async (corner, i) => {
      const pos = positions[corner];
      const stats = await sharp(imageBuffer)
        .extract({
          left: Math.max(0, Math.round(pos.left)),
          top: Math.max(0, Math.round(pos.top)),
          width: w,
          height: h,
        })
        .stats();
      const busyness = stats.channels.reduce((sum, c) => sum + c.stdev, 0);
      const [r, g, b] = stats.channels;
      const luminance = 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean;
      // Tiny index-based bias preserves the declared preference order
      // (bottom-left first) when regions are equally empty/busy.
      return { corner, busyness: busyness + i * 0.01, luminance };
    })
  );

  scored.sort((a, b) => a.busyness - b.busyness);
  return scored;
}

function cornerPosition(
  corner: Corner,
  cardWidth: number,
  cardHeight: number,
  imageWidth: number,
  imageHeight: number,
  margin: number
): { left: number; top: number } {
  const left = corner.endsWith("left") ? margin : imageWidth - cardWidth - margin;
  const top = corner.startsWith("top") ? margin : imageHeight - cardHeight - margin;
  return {
    left: Math.max(0, Math.min(left, imageWidth - cardWidth)),
    top: Math.max(0, Math.min(top, imageHeight - cardHeight)),
  };
}

/**
 * Scales the product within the frame without changing the canvas's own
 * dimensions — the "product size in card" control from the reference
 * tool. >100 scales the whole photo up then center-crops back to the
 * original size (product fills more of the frame, background margin
 * shrinks); <100 scales it down and pads back out, sampling a corner's
 * color for the new margin so it blends with the existing background
 * instead of showing a hard edge. A pure post-process on the already
 * -generated photo — no extra AI call.
 */
export async function applyZoom(imageBuffer: Buffer, zoomPercent: number): Promise<Buffer> {
  if (!zoomPercent || zoomPercent === 100) return imageBuffer;

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? CANVAS_WIDTH;
  const height = meta.height ?? CANVAS_HEIGHT;
  const factor = zoomPercent / 100;
  const scaledWidth = Math.max(1, Math.round(width * factor));
  const scaledHeight = Math.max(1, Math.round(height * factor));
  const scaled = await sharp(imageBuffer).resize(scaledWidth, scaledHeight).toBuffer();

  if (factor >= 1) {
    const left = Math.round((scaledWidth - width) / 2);
    const top = Math.round((scaledHeight - height) / 2);
    return sharp(scaled)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
  }

  const cornerSize = Math.min(20, width, height);
  const cornerStats = await sharp(imageBuffer)
    .extract({ left: 0, top: 0, width: cornerSize, height: cornerSize })
    .stats();
  const [r, g, b] = cornerStats.channels;
  const background = { r: Math.round(r.mean), g: Math.round(g.mean), b: Math.round(b.mean), alpha: 1 };
  const left = Math.round((width - scaledWidth) / 2);
  const top = Math.round((height - scaledHeight) / 2);
  return sharp({ create: { width, height, channels: 3, background } })
    .composite([{ input: scaled, left, top }])
    .png()
    .toBuffer();
}

/**
 * Burns product details and/or the selected logo directly onto the image —
 * no card, no border, no fill behind them — so the saved file itself
 * carries the info for quick customer sharing without needing the PDF
 * catalog. No-op when there are no fields and no logo. Placement is
 * automatic: the text and the logo each land in whichever corner has the
 * most free space, chosen independently so they never collide with each
 * other or the product (see rankCornersByBusyness). Legibility comes from
 * picking a light or dark palette per corner based on its sampled
 * brightness, not from an opaque background shape.
 *
 * Text is rendered via sharp's native `text` creation primitive (libvips'
 * Pango-backed text-to-image renderer) with an explicit `fontfile` pointing
 * at the bundled Frank Ruhl Libre TTF, rather than raw SVG with a CSS
 * `@font-face` data URI. The SVG/@font-face approach positioned correctly
 * but rendered empty "tofu" boxes on Vercel's Linux runtime — librsvg there
 * doesn't honor the embedded @font-face — while `fontfile` hands the font
 * straight to Pango/fontconfig, bypassing CSS font loading entirely.
 */
export async function burnProductText(
  imageBuffer: Buffer,
  fields: OverlayTextFields,
  logoUrl?: string | null
): Promise<Buffer> {
  const line1Parts: string[] = [];
  if (fields.modelNumber) line1Parts.push(`מספר דגם: ${fields.modelNumber}`);
  if (fields.sku) line1Parts.push(`מק"ט: ${fields.sku}`);

  const line2Parts: string[] = [];
  if (fields.sizeMin != null || fields.sizeMax != null) {
    line2Parts.push(`מידות: ${fields.sizeMin ?? "?"}-${fields.sizeMax ?? "?"}`);
  }
  if (fields.color) line2Parts.push(`צבע: ${fields.color}`);

  const lines = [line1Parts.join("   ·   "), line2Parts.join("   ·   ")].filter(Boolean);
  const hasText = lines.length > 0;
  const hasLogo = Boolean(logoUrl);
  if (!hasText && !hasLogo) return imageBuffer;

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? CANVAS_WIDTH;
  const height = meta.height ?? CANVAS_HEIGHT;
  const margin = Math.round(width * 0.035);

  // Probe corners once, up front, using a generous placeholder region size
  // — text/logo dimensions aren't known yet at this point, and a stable
  // probe size keeps the busyness comparison consistent between them.
  const probeWidth = Math.round(width * 0.32);
  const probeHeight = Math.round(height * 0.1);
  const ranked = await rankCornersByBusyness(imageBuffer, probeWidth, probeHeight, width, height);

  function paletteFor(luminance: number) {
    return luminance >= LUMINANCE_THRESHOLD ? PALETTE_ON_LIGHT : PALETTE_ON_DARK;
  }

  let textLayer: { buffer: Buffer; width: number; height: number } | null = null;
  if (hasText) {
    const palette = paletteFor(ranked[0].luminance);
    // Pango markup (rgba:true enables it) sets glyph color/size and
    // auto-detects Hebrew script/RTL order on its own. Explicit sizes (in
    // 1024ths-of-a-point, standard Pango units) give the model-number line
    // visual priority over the secondary details line without needing a
    // second font weight.
    const markup = lines
      .map((line, i) => {
        const size = i === 0 ? 48000 : 36000;
        const color = i === 0 ? palette.primary : palette.secondary;
        // A touch of letter-spacing on the secondary (sizes/color) line
        // reads as a more deliberate, refined label — the primary line
        // stays tight since it already carries visual weight from size/color.
        const spacing = i === 0 ? "" : ` letter_spacing="900"`;
        return `<span foreground="${color}" size="${size}"${spacing}>${escapeXml(line)}</span>`;
      })
      .join("\n");

    // Capped and word-wrapped so a long model number/SKU can never render
    // wider than the photo — sharp's composite() throws if an overlay
    // exceeds the base image's bounds, and an unbounded caption would
    // defeat "doesn't interfere with the photo" regardless.
    const maxTextWidth = Math.round(width * 0.62);
    let buffer = await sharp({
      text: {
        text: markup,
        font: "Frank Ruhl Libre",
        fontfile: FRANK_RUHL_FONT_PATH,
        align: "right",
        rgba: true,
        width: maxTextWidth,
        wrap: "word",
      },
    })
      .png()
      .toBuffer();
    let textMeta = await sharp(buffer).metadata();
    // Belt-and-suspenders: word-wrap can still overflow on an unbroken
    // token (e.g. a SKU with no spaces) — downscale to fit as a last resort.
    if ((textMeta.width ?? 0) > maxTextWidth) {
      buffer = await sharp(buffer).resize({ width: maxTextWidth }).png().toBuffer();
      textMeta = await sharp(buffer).metadata();
    }
    textLayer = { buffer, width: textMeta.width ?? 0, height: textMeta.height ?? 0 };
  }

  let logoLayer: { buffer: Buffer; width: number; height: number } | null = null;
  if (hasLogo) {
    try {
      const logoRes = await fetch(logoUrl!);
      if (logoRes.ok) {
        const logoBuffer = await trimLogo(Buffer.from(await logoRes.arrayBuffer()));
        const targetSize = Math.round(width * 0.14);
        const resizedLogo = await sharp(logoBuffer)
          .resize({ width: targetSize, height: targetSize, fit: "inside" })
          .toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        logoLayer = {
          buffer: resizedLogo,
          width: logoMeta.width ?? targetSize,
          height: logoMeta.height ?? targetSize,
        };
      }
    } catch {
      // A logo fetch failure shouldn't block saving the rest of the
      // labeled image — fall through with no logo.
    }
  }

  if (!textLayer && !logoLayer) return imageBuffer;

  const layers: sharp.OverlayOptions[] = [];
  if (textLayer) {
    const pos = cornerPosition(ranked[0].corner, textLayer.width, textLayer.height, width, height, margin);
    layers.push({ input: textLayer.buffer, left: pos.left, top: pos.top });
  }
  if (logoLayer) {
    const score = textLayer ? ranked[1] : ranked[0];
    const pos = cornerPosition(score.corner, logoLayer.width, logoLayer.height, width, height, margin);
    layers.push({ input: logoLayer.buffer, left: pos.left, top: pos.top });
  }

  return sharp(imageBuffer).composite(layers).png().toBuffer();
}

/**
 * Same job as burnProductText, but positions from a fixed PhotoTemplate
 * instead of auto-picking a corner — every photo using the same template
 * gets the logo and each text field in the exact same spot, matching a
 * layout the user designed once (e.g. in Canva) rather than one the
 * algorithm chose per photo. Legibility still comes from the same
 * light/dark palette switch, sampled at each field's own fixed spot
 * (a template built against a white mockup would otherwise go invisible
 * on a dark photo).
 */
export async function burnProductTextFromTemplate(
  imageBuffer: Buffer,
  fields: OverlayTextFields,
  logoUrl: string | null | undefined,
  template: PhotoTemplate
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? CANVAS_WIDTH;
  const height = meta.height ?? CANVAS_HEIGHT;

  const layers: sharp.OverlayOptions[] = [];

  if (logoUrl) {
    try {
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        const logoBuffer = await trimLogo(Buffer.from(await logoRes.arrayBuffer()));
        const boxWidth = Math.round(template.logo.widthFraction * width);
        const boxHeight = Math.round(template.logo.heightFraction * height);
        const resizedLogo = await sharp(logoBuffer)
          .resize({ width: boxWidth, height: boxHeight, fit: "inside" })
          .toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        const logoWidth = logoMeta.width ?? boxWidth;
        const logoHeight = logoMeta.height ?? boxHeight;
        const boxLeft = Math.round(template.logo.leftFraction * width);
        const boxTop = Math.round(template.logo.topFraction * height);
        layers.push({
          input: resizedLogo,
          // Centered within the template's box in case the logo's own
          // aspect ratio doesn't exactly match the box's.
          left: boxLeft + Math.round((boxWidth - logoWidth) / 2),
          top: boxTop + Math.round((boxHeight - logoHeight) / 2),
        });
      }
    } catch {
      // A logo fetch failure shouldn't block the rest of the template.
    }
  }

  async function sampleLuminanceAt(centerX: number, centerY: number, probeWidth: number, probeHeight: number) {
    const left = Math.max(0, Math.min(width - probeWidth, Math.round(centerX - probeWidth / 2)));
    const top = Math.max(0, Math.min(height - probeHeight, Math.round(centerY - probeHeight / 2)));
    const safeWidth = Math.min(probeWidth, width - left);
    const safeHeight = Math.min(probeHeight, height - top);
    const stats = await sharp(imageBuffer)
      .extract({ left, top, width: Math.max(1, safeWidth), height: Math.max(1, safeHeight) })
      .stats();
    const [r, g, b] = stats.channels;
    return 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean;
  }

  function paletteFor(luminance: number) {
    return luminance >= LUMINANCE_THRESHOLD ? PALETTE_ON_LIGHT : PALETTE_ON_DARK;
  }

  async function placeField(field: TemplateTextField, value: string | null) {
    if (!value) return;
    const centerX = field.centerXFraction * width;
    const centerY = field.centerYFraction * height;
    const fontPt = Math.max(1, Math.round(field.fontSizeFraction * width));

    const luminance = await sampleLuminanceAt(centerX, centerY, Math.round(width * 0.22), fontPt * 2);
    const color = paletteFor(luminance).primary;

    const buffer = await sharp({
      text: {
        text: `<span foreground="${color}" size="${fontPt * 1024}">${escapeXml(field.label + value)}</span>`,
        font: "Frank Ruhl Libre",
        fontfile: FRANK_RUHL_FONT_PATH,
        align: "center",
        rgba: true,
      },
    })
      .png()
      .toBuffer();
    const textMeta = await sharp(buffer).metadata();
    const textWidth = textMeta.width ?? 0;
    const textHeight = textMeta.height ?? 0;
    const left = Math.max(0, Math.min(width - textWidth, Math.round(centerX - textWidth / 2)));
    const top = Math.max(0, Math.min(height - textHeight, Math.round(centerY - textHeight / 2)));
    layers.push({ input: buffer, left, top });
  }

  await placeField(template.modelNumber, fields.modelNumber ?? null);
  await placeField(template.price, fields.price != null ? String(fields.price) : null);
  if (fields.sizeMin != null || fields.sizeMax != null) {
    await placeField(template.sizes, `${fields.sizeMin ?? "?"}-${fields.sizeMax ?? "?"}`);
  }
  await placeField(template.color, fields.color ?? null);

  if (layers.length === 0) return imageBuffer;
  return sharp(imageBuffer).composite(layers).png().toBuffer();
}
