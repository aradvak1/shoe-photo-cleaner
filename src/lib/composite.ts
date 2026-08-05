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
 * Scores an arbitrary rectangle's "busyness" (summed per-channel pixel
 * variance — high for product/hardware/shadow detail, low for a flat
 * background) and average luminance. Fully clamps the box to the image's
 * own bounds since, unlike the fixed corner regions in
 * rankCornersByBusyness, candidate boxes here (nudged positions, a
 * rendered text field's own footprint) aren't guaranteed to already fit.
 */
async function regionBusyness(
  imageBuffer: Buffer,
  left: number,
  top: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number
): Promise<{ busyness: number; luminance: number }> {
  const clampedLeft = Math.max(0, Math.min(Math.round(left), imageWidth - 1));
  const clampedTop = Math.max(0, Math.min(Math.round(top), imageHeight - 1));
  const safeWidth = Math.max(1, Math.min(Math.round(width), imageWidth - clampedLeft));
  const safeHeight = Math.max(1, Math.min(Math.round(height), imageHeight - clampedTop));
  // sharp's .stats() silently ignores a preceding .extract() on the same
  // pipeline (reproduced directly: returns the WHOLE image's stats every
  // time regardless of the extract box) unless the crop is materialized
  // to its own buffer first — this round-trip is required, not optional.
  const crop = await sharp(imageBuffer)
    .extract({ left: clampedLeft, top: clampedTop, width: safeWidth, height: safeHeight })
    .toBuffer();
  const stats = await sharp(crop).stats();
  const busyness = stats.channels.reduce((sum, c) => sum + c.stdev, 0);
  const [r, g, b] = stats.channels;
  const luminance = 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean;
  return { busyness, luminance };
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
      const { busyness, luminance } = await regionBusyness(
        imageBuffer,
        pos.left,
        pos.top,
        w,
        h,
        imageWidth,
        imageHeight
      );
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
  // sharp's .stats() silently ignores a preceding .extract() unless the
  // crop is materialized to its own buffer first (reproduced directly:
  // chaining .extract().stats() on the same pipeline returns the WHOLE
  // image's stats every time, regardless of the extract box) — so the
  // crop must be its own toBuffer() round-trip before .stats() sees it.
  const cornerCrop = await sharp(imageBuffer)
    .extract({ left: 0, top: 0, width: cornerSize, height: cornerSize })
    .toBuffer();
  const cornerStats = await sharp(cornerCrop).stats();
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
 *
 * Because the AI generation step (gemini.ts) has no constraint on where in
 * the frame the product ends up, a fixed template position can land right
 * on top of the product on any given photo even though it was designed
 * against a mockup where it didn't. Each element (logo + each text field)
 * is checked against the actual photo before being placed: if its spot is
 * "busy" (product/hardware/shadow detail, not flat background — same
 * pixel-variance heuristic burnProductText already uses for auto-mode
 * corner picking), it's nudged further into whichever corner it's already
 * closest to, and if that's still not enough, it falls back to the
 * least-busy image corner that no other element has already claimed —
 * never silently overlapping the product, while staying at its designed
 * spot on the (common) case where there's no conflict. A field the user
 * has manually dragged (lockedFields) always skips this and is placed
 * exactly where they put it — an explicit choice is never second-guessed.
 */
export async function burnProductTextFromTemplate(
  imageBuffer: Buffer,
  fields: OverlayTextFields,
  logoUrl: string | null | undefined,
  template: PhotoTemplate,
  lockedFields?: ReadonlySet<"logo" | "modelNumber" | "price" | "sizes" | "color">
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? CANVAS_WIDTH;
  const height = meta.height ?? CANVAS_HEIGHT;
  const margin = Math.round(width * 0.035);

  // One upfront pass over the whole photo's 4 corners establishes this
  // specific photo's own "calm background" baseline — used both as the
  // collision threshold (a spot much busier than the calmest corner is
  // probably the product, not floor/backdrop) and as the fallback corner
  // list. A relative multiplier alone misfires on a near-blank corner
  // (tiny stdev makes the threshold trivially easy to trip on ordinary
  // anti-aliasing noise); an absolute margin alone misfires on a
  // naturally textured background (stdev high everywhere, threshold too
  // low). Taking the larger of the two guards both directions. Untuned
  // first guess — revisit if real photos show false positives/negatives.
  const probeWidth = Math.round(width * 0.32);
  const probeHeight = Math.round(height * 0.1);
  const baseline = await rankCornersByBusyness(imageBuffer, probeWidth, probeHeight, width, height);
  const calmest = baseline[0].busyness;
  const collisionThreshold = Math.max(calmest * 2.5, calmest + 8);
  const claimedCorners = new Set<Corner>();
  const NUDGE_STEP = Math.round(width * 0.02);
  const NUDGE_MAX_ATTEMPTS = 5;

  function clampRange(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function pickFallbackCorner(): CornerScore {
    const free = baseline.find((c) => !claimedCorners.has(c.corner));
    const chosen = free ?? baseline[0];
    claimedCorners.add(chosen.corner);
    return chosen;
  }

  /**
   * Resolves the final left/top for a box that was about to be placed at
   * (initialLeft, initialTop) — unchanged if that spot is clear, nudged
   * further into its own corner if not, or relocated to a distinct free
   * image corner as a last resort. Skipped entirely (returns the initial
   * position verbatim) for a field the user explicitly dragged.
   */
  async function resolvePosition(
    key: "logo" | "modelNumber" | "price" | "sizes" | "color",
    initialLeft: number,
    initialTop: number,
    boxWidth: number,
    boxHeight: number
  ): Promise<{ left: number; top: number }> {
    if (lockedFields?.has(key)) return { left: initialLeft, top: initialTop };

    const initial = await regionBusyness(imageBuffer, initialLeft, initialTop, boxWidth, boxHeight, width, height);
    if (initial.busyness < collisionThreshold) return { left: initialLeft, top: initialTop };

    const centerX = initialLeft + boxWidth / 2;
    const centerY = initialTop + boxHeight / 2;
    const dx = centerX < width / 2 ? -1 : 1;
    const dy = centerY < height / 2 ? -1 : 1;
    // Never let a nudge carry the box past the canvas's own center line —
    // past that point it's not "further into its corner" anymore, it's an
    // unrelated relocation.
    const leftMin = dx < 0 ? 0 : Math.min(width - boxWidth, width / 2);
    const leftMax = dx < 0 ? Math.max(0, width / 2 - boxWidth) : width - boxWidth;
    const topMin = dy < 0 ? 0 : Math.min(height - boxHeight, height / 2);
    const topMax = dy < 0 ? Math.max(0, height / 2 - boxHeight) : height - boxHeight;

    for (let attempt = 1; attempt <= NUDGE_MAX_ATTEMPTS; attempt++) {
      const candidateLeft = clampRange(initialLeft + dx * attempt * NUDGE_STEP, leftMin, leftMax);
      const candidateTop = clampRange(initialTop + dy * attempt * NUDGE_STEP, topMin, topMax);
      const probe = await regionBusyness(imageBuffer, candidateLeft, candidateTop, boxWidth, boxHeight, width, height);
      if (probe.busyness < collisionThreshold) {
        return { left: candidateLeft, top: candidateTop };
      }
    }

    const fallback = pickFallbackCorner();
    return cornerPosition(fallback.corner, boxWidth, boxHeight, width, height, margin);
  }

  const layers: sharp.OverlayOptions[] = [];

  if (logoUrl && template.logo) {
    const logoField = template.logo;
    try {
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        const logoBuffer = await trimLogo(Buffer.from(await logoRes.arrayBuffer()));
        const boxWidth = Math.round(logoField.widthFraction * width);
        const boxHeight = Math.round(logoField.heightFraction * height);
        const resizedLogo = await sharp(logoBuffer)
          .resize({ width: boxWidth, height: boxHeight, fit: "inside" })
          .toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        const logoWidth = logoMeta.width ?? boxWidth;
        const logoHeight = logoMeta.height ?? boxHeight;
        const boxLeft = Math.round(logoField.leftFraction * width);
        const boxTop = Math.round(logoField.topFraction * height);
        // Centered within the template's box in case the logo's own
        // aspect ratio doesn't exactly match the box's.
        const initialLeft = boxLeft + Math.round((boxWidth - logoWidth) / 2);
        const initialTop = boxTop + Math.round((boxHeight - logoHeight) / 2);
        const resolved = await resolvePosition("logo", initialLeft, initialTop, logoWidth, logoHeight);
        layers.push({ input: resizedLogo, left: resolved.left, top: resolved.top });
      }
    } catch {
      // A logo fetch failure shouldn't block the rest of the template.
    }
  }

  async function sampleLuminanceAt(centerX: number, centerY: number, probeWidth: number, probeHeight: number) {
    const left = Math.round(centerX - probeWidth / 2);
    const top = Math.round(centerY - probeHeight / 2);
    const { luminance } = await regionBusyness(imageBuffer, left, top, probeWidth, probeHeight, width, height);
    return luminance;
  }

  function paletteFor(luminance: number) {
    return luminance >= LUMINANCE_THRESHOLD ? PALETTE_ON_LIGHT : PALETTE_ON_DARK;
  }

  async function placeField(
    key: "modelNumber" | "price" | "sizes" | "color",
    field: TemplateTextField | undefined,
    value: string | null
  ) {
    if (!value || !field) return;
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
    const initialLeft = Math.max(0, Math.min(width - textWidth, Math.round(centerX - textWidth / 2)));
    const initialTop = Math.max(0, Math.min(height - textHeight, Math.round(centerY - textHeight / 2)));
    const resolved = await resolvePosition(key, initialLeft, initialTop, textWidth, textHeight);
    layers.push({ input: buffer, left: resolved.left, top: resolved.top });
  }

  await placeField("modelNumber", template.modelNumber, fields.modelNumber ?? null);
  await placeField("price", template.price, fields.price != null ? String(fields.price) : null);
  if (fields.sizeMin != null || fields.sizeMax != null) {
    await placeField("sizes", template.sizes, `${fields.sizeMin ?? "?"}-${fields.sizeMax ?? "?"}`);
  }
  await placeField("color", template.color, fields.color ?? null);

  if (layers.length === 0) return imageBuffer;
  return sharp(imageBuffer).composite(layers).png().toBuffer();
}
