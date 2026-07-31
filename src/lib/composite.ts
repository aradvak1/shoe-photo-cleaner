import path from "node:path";
import sharp from "sharp";

const CANVAS_SIZE = Number(process.env.CANVAS_SIZE ?? 2000);
const MARGIN_RATIO = 0.08; // whitespace border around the shoe

/**
 * Composites a transparent cutout onto a uniform white canvas so every
 * photo in the catalog shares the same dimensions and background.
 * Optionally drops a soft blurred shadow under the subject (v2 feature
 * from the spec) so it doesn't look like it's floating.
 */
export async function compositeOnWhite(
  transparentPng: Buffer,
  { withShadow = false }: { withShadow?: boolean } = {}
): Promise<Buffer> {
  const trimmed = await sharp(transparentPng).trim().toBuffer();

  const inner = Math.round(CANVAS_SIZE * (1 - MARGIN_RATIO * 2));
  const resized = await sharp(trimmed)
    .resize({ width: inner, height: inner, fit: "inside", withoutEnlargement: false })
    .toBuffer();
  const resizedMeta = await sharp(resized).metadata();

  const canvas = sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  });

  const shoeWidth = resizedMeta.width ?? inner;
  const shoeHeight = resizedMeta.height ?? inner;
  const left = Math.round((CANVAS_SIZE - shoeWidth) / 2);
  const top = Math.round((CANVAS_SIZE - shoeHeight) / 2);

  const layers: sharp.OverlayOptions[] = [];

  if (withShadow) {
    const shadowWidth = Math.round(shoeWidth * 0.7);
    const shadowHeight = Math.round(shoeWidth * 0.12);
    const shadowSvg = Buffer.from(
      `<svg width="${shadowWidth}" height="${shadowHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="black" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="black" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="${shadowWidth / 2}" cy="${shadowHeight / 2}" rx="${shadowWidth / 2}" ry="${shadowHeight / 2}" fill="url(#g)"/>
      </svg>`
    );
    layers.push({
      input: shadowSvg,
      left: Math.round((CANVAS_SIZE - shadowWidth) / 2),
      top: top + shoeHeight - Math.round(shadowHeight * 0.5),
    });
  }

  layers.push({ input: resized, left, top });

  return canvas.composite(layers).png().toBuffer();
}

export interface OverlayTextFields {
  modelNumber?: string | null;
  sku?: string | null;
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

const HEBREW_FONT_PATH = path.join(
  process.cwd(),
  "src/lib/pdf/fonts/NotoSansHebrew-Variable.ttf"
);

/**
 * Burns product details as a semi-transparent bottom band onto an image,
 * so the saved file itself carries the info for quick customer sharing
 * without needing the PDF catalog. No-op when every field is empty.
 *
 * Text is rendered via sharp's native `text` creation primitive (libvips'
 * Pango-backed text-to-image renderer) with an explicit `fontfile` pointing
 * at the bundled Noto Sans Hebrew TTF, rather than raw SVG with a CSS
 * `@font-face` data URI. The SVG/@font-face approach positioned correctly
 * but rendered empty "tofu" boxes on Vercel's Linux runtime — librsvg there
 * doesn't honor the embedded @font-face — while `fontfile` hands the font
 * straight to Pango/fontconfig, bypassing CSS font loading entirely.
 */
export async function burnProductText(
  imageBuffer: Buffer,
  fields: OverlayTextFields
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
  if (lines.length === 0) return imageBuffer;

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? CANVAS_SIZE;
  const height = meta.height ?? CANVAS_SIZE;

  const bandHeight = Math.round(height * (lines.length === 2 ? 0.11 : 0.075));
  const padding = Math.round(width * 0.025);
  const textWidth = width - padding * 2;
  const textHeight = bandHeight - Math.round(bandHeight * 0.3);

  // Pango markup (rgba:true enables it) sets the glyph color; auto-detects
  // Hebrew script/RTL order on its own, same as the earlier SVG approach.
  const markup = lines
    .map((line) => `<span foreground="#faf7f2">${escapeXml(line)}</span>`)
    .join("\n");

  const textPng = await sharp({
    text: {
      text: markup,
      font: "NotoSansHebrew",
      fontfile: HEBREW_FONT_PATH,
      width: textWidth,
      height: textHeight,
      align: "right",
      rgba: true,
    },
  })
    .png()
    .toBuffer();
  const textMeta = await sharp(textPng).metadata();

  const band = await sharp({
    create: {
      width,
      height: bandHeight,
      channels: 4,
      background: { r: 36, g: 32, b: 24, alpha: 0.74 },
    },
  })
    .composite([
      {
        input: textPng,
        left: padding,
        top: Math.round((bandHeight - (textMeta.height ?? textHeight)) / 2),
      },
    ])
    .png()
    .toBuffer();

  return sharp(imageBuffer)
    .composite([{ input: band, gravity: "south" }])
    .png()
    .toBuffer();
}
