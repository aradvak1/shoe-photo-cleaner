const PHOTOROOM_EDIT_URL = "https://image-api.photoroom.com/v2/edit";

const DEFAULT_MODEL_PRESET = "avery";
const DEFAULT_POSE = "standing";
// virtualModel.scene.preset.name did not produce a visible background in
// testing (output came back transparent) — driving the scene through
// background.prompt instead, which is verified to work reliably.
const DEFAULT_SCENE_PROMPT =
  "outdoor lifestyle scene, natural daylight, urban street, shallow depth of field";

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

/**
 * Calls Photoroom's segmentation model to cut the subject out of the
 * original photo, at the original resolution (up to Photoroom's 5000px
 * cap). Returns a transparent PNG buffer — compositing onto the final
 * white canvas happens locally in lib/composite.ts so every photo in the
 * catalog ends up on an identical canvas.
 */
export async function removeBackground(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<Buffer> {
  return callPhotoroomEdit(fileBuffer, filename, mimeType, {
    removeBackground: "true",
    "export.format": "png",
    maxWidth: "5000",
    maxHeight: "5000",
  });
}

/**
 * Studio mode with a custom AI-generated background instead of the local
 * white canvas. Returns a FULLY COMPOSITED PNG — callers must NOT run it
 * through compositeOnWhite() again.
 */
export async function editWithBackgroundPrompt(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  prompt: string
): Promise<Buffer> {
  return callPhotoroomEdit(fileBuffer, filename, mimeType, {
    removeBackground: "true",
    "background.prompt": prompt,
    "background.expandPrompt.mode": "ai.auto",
    "export.format": "png",
    maxWidth: "5000",
    maxHeight: "5000",
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
    "background.prompt": options.prompt || DEFAULT_SCENE_PROMPT,
    "background.expandPrompt.mode": "ai.auto",
    "export.format": "png",
    maxWidth: "5000",
    maxHeight: "5000",
  };

  return callPhotoroomEdit(fileBuffer, filename, mimeType, fields);
}
