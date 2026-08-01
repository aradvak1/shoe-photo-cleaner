const PHOTOROOM_EDIT_URL = "https://image-api.photoroom.com/v2/edit";

const DEFAULT_MODEL_PRESET = "avery";
const DEFAULT_POSE = "standing";
// virtualModel.scene.preset.name did not produce a visible background in
// testing (output came back transparent) — driving the scene through
// background.prompt instead, which is verified to work reliably.
const DEFAULT_SCENE_PROMPT =
  "outdoor lifestyle scene, natural daylight, urban street, shallow depth of field";

// Studio mode's default when the user hasn't typed a custom prompt — every
// studio photo now goes through AI background generation (no more local
// flat/gradient canvas), engineered to match a real commercial product
// photoshoot: graduated backdrop, soft box glow, a believable contact
// shadow, rather than something an AI render obviously produced.
const DEFAULT_STUDIO_PROMPT =
  "plain smooth solid color background, minimalist e-commerce product photo background, even gradient from white to very light gray, flat clean surface, no pattern, no texture, no fabric, no wrinkles, professional softbox lighting, clearly visible soft shadow directly beneath the product grounding it on the surface, high-end commercial catalog photography";

// Appended to background.prompt on both AI-background paths — pushes toward
// a photorealistic editorial look rather than an obviously-AI render. Best
// effort only: virtualModel re-renders the product onto a generated model,
// so it can't guarantee pixel-perfect fidelity to the source shoe photo.
const QUALITY_SUFFIX =
  "photorealistic, editorial fashion photography, natural lighting, shallow depth of field, high-end product photoshoot, DSLR quality, high detail";

// Separate from background.prompt — Photoroom documents this as guiding
// virtualModel's generation *style* specifically (their own example:
// "street style"), distinct from the scene content itself. Includes
// wardrobe styling too — without it the model tends to render in generic
// casualwear rather than the elevated look a shoe photoshoot calls for.
const VIRTUAL_MODEL_STYLE_PROMPT =
  "editorial fashion photography, photorealistic, natural window lighting, shallow depth of field, high-end product photoshoot, DSLR quality, wearing an elegant tailored outfit, sophisticated designer wardrobe, luxury fashion styling";

async function callPhotoroomEdit(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  fields: Record<string, string>
): Promise<Buffer> {
  const apiKey = process.env.PHOTOROOM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PHOTOROOM_API_KEY environment variable");
  }

  const form = new FormData();
  form.append(
    "imageFile",
    new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
    filename
  );
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  const response = await fetch(PHOTOROOM_EDIT_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Photoroom API error (${response.status}): ${detail || response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// REVERTED: text-guided segmentation (segmentation.prompt="shoe" +
// segmentation.negativePrompt="hand, arm, ...") was added to drop a
// photographer's hand from handheld product shots, but on real photos it
// fragmented the shoe itself into disconnected floating pieces instead of
// a clean whole cutout — confirmed on a real result, a much worse failure
// than the hand it was meant to fix. This was always flagged as a
// Photoroom preview/alpha feature; it wasn't stable enough to keep on by
// default. Plain removeBackground (no segmentation.* fields) is what the
// functions below use.

// Fixed 1080x1920 (9:16) output for the AI-background paths, which return a
// fully composited image from Photoroom itself. scaling defaults to "fit" —
// the subject is never cropped, the AI-expanded background fills whatever
// space is left. outputSize and maxWidth/maxHeight are mutually exclusive
// per Photoroom's API, so these calls drop maxWidth/maxHeight.
const OUTPUT_SIZE = "1080x1920";

/**
 * Studio mode: always AI-generates the background (no more local flat/
 * gradient canvas) — falls back to DEFAULT_STUDIO_PROMPT when the user
 * hasn't typed their own. Returns a FULLY COMPOSITED PNG.
 */
export async function editWithBackgroundPrompt(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  prompt?: string
): Promise<Buffer> {
  return callPhotoroomEdit(fileBuffer, filename, mimeType, {
    removeBackground: "true",
    "background.prompt": `${prompt || DEFAULT_STUDIO_PROMPT}, ${QUALITY_SUFFIX}`,
    "background.expandPrompt.mode": "ai.auto",
    "export.format": "png",
    outputSize: OUTPUT_SIZE,
  });
}

export interface VirtualModelOptions {
  modelPreset?: string;
  pose?: string;
  /** Free-text scene description; falls back to DEFAULT_SCENE_PROMPT when omitted. */
  prompt?: string;
}

/**
 * Atmosphere mode: places the product onto a virtual human model in an
 * outdoor/lifestyle scene. Returns a FULLY COMPOSITED PNG — callers must
 * NOT run it through compositeOnWhite() again.
 *
 * Note: Photoroom documents virtualModel as clothing-oriented and does not
 * publish a full preset list — footwear fit on the default presets should
 * be spot-checked on real photos before relying on it in production.
 */
export async function generateAtmosphereImage(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  options: VirtualModelOptions = {}
): Promise<Buffer> {
  const fields: Record<string, string> = {
    removeBackground: "true",
    "virtualModel.mode": "ai.auto",
    "virtualModel.model.preset.name": options.modelPreset ?? DEFAULT_MODEL_PRESET,
    "virtualModel.pose": options.pose ?? DEFAULT_POSE,
    "virtualModel.prompt": VIRTUAL_MODEL_STYLE_PROMPT,
    "background.prompt": `${options.prompt || DEFAULT_SCENE_PROMPT}, ${QUALITY_SUFFIX}`,
    "background.expandPrompt.mode": "ai.auto",
    "export.format": "png",
    outputSize: OUTPUT_SIZE,
    // virtualModel.mode generates at its own preferred aspect ratio and
    // gets letterboxed into outputSize under the default "fit" scaling,
    // producing visible white pillarbars — confirmed on a real result.
    // "fill" makes it fill the canvas edge-to-edge (crops the scene, never
    // the product). editWithBackgroundPrompt doesn't need this — already
    // confirmed full-bleed with the default.
    scaling: "fill",
  };

  return callPhotoroomEdit(fileBuffer, filename, mimeType, fields);
}
