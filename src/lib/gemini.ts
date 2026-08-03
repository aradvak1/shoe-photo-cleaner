import sharp from "sharp";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Verified against a real product photo (brown suede platform wedge) before
// being wired in — see conversation history for the two accepted reference
// outputs. Swapping GEMINI_MODEL to a newer "nano banana" release later is
// fine, but re-validate against a real photo first; output style shifts
// between model versions.

// Square output: matches catalog grid cells with no letterboxing, and
// lets the fixed template's text block sit close to the product instead
// of below a lot of empty backdrop. Gemini's aspectRatio param controls
// ratio, not exact pixel size (it commonly returns ~1024x1024) — the
// explicit resize below in callGeminiGenerate guarantees the exact
// 1080x1080 the app saves and composites against everywhere else.
const OUTPUT_ASPECT_RATIO = "1:1";
const OUTPUT_SIZE = 1080;

// Prepended to every prompt on both paths. The reference image is attached
// as inline image data (the model can already see the product), but an
// explicit fidelity instruction measurably reduces drift on hardware
// details (buckles, studs, stitching) versus relying on the image alone.
const PRESERVE_PRODUCT_INSTRUCTION =
  "The product shown in the attached photo is the exact item being sold. Preserve its exact shape, color, material, texture, and every hardware detail (buckles, studs, stitching, logos) with complete fidelity — do not redesign, simplify, or alter it in any way. Only change the surrounding background/scene as described below.";

const QUALITY_SUFFIX =
  "Photorealistic, high-end commercial product photography, DSLR quality, shallow depth of field, ultra high detail, no text, no watermark, no logo overlay.";

const DEFAULT_STUDIO_PROMPT =
  "a smooth seamless studio backdrop in warm neutral beige and cream tones with a subtle soft gradient, professional softbox lighting from the upper left, soft realistic contact shadow directly beneath the product grounding it on the surface, gentle warm rim light on the edges";

const DEFAULT_ATMOSPHERE_PROMPT =
  "an elegant, attractive female fashion model with a warm natural skin tone, in a sophisticated warm-toned setting with soft natural directional light (for example a flowing curtain backdrop or an elegant interior), wearing a refined tailored outfit in neutral beige/cream tones with delicate gold jewelry, seated or posed in a relaxed editorial pose that clearly and prominently shows her bare feet/legs wearing the exact product from the attached photo on both feet";

const ATMOSPHERE_STYLE_SUFFIX =
  "Editorial fashion photography, natural window lighting, sophisticated designer wardrobe, luxury fashion styling.";

interface GeminiInlinePart {
  inline_data: { mime_type: string; data: string };
}

async function callGeminiGenerate(
  fileBuffer: Buffer,
  mimeType: string,
  promptText: string,
  extraReferenceImages: { buffer: Buffer; mimeType: string }[] = []
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const referenceParts: GeminiInlinePart[] = extraReferenceImages.map((ref) => ({
    inline_data: { mime_type: ref.mimeType, data: ref.buffer.toString("base64") },
  }));

  const response = await fetch(GEMINI_GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            { inline_data: { mime_type: mimeType, data: fileBuffer.toString("base64") } },
            ...referenceParts,
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: OUTPUT_ASPECT_RATIO },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API error (${response.status}): ${detail || response.statusText}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);

  if (!imagePart) {
    // Most common cause: the safety filter blocked the output — surface
    // finishReason so it's visible in logs instead of a bare "no image".
    const finishReason = data?.candidates?.[0]?.finishReason;
    throw new Error(
      `Gemini API returned no image${finishReason ? ` (finishReason: ${finishReason})` : ""}`
    );
  }

  const rawImage = Buffer.from(imagePart.inlineData.data, "base64");
  return sharp(rawImage).resize(OUTPUT_SIZE, OUTPUT_SIZE).png().toBuffer();
}

/**
 * Studio mode: AI-generates the background, returning a fully composited
 * PNG (same contract as the Photoroom implementation it replaced).
 */
export async function editWithBackgroundPrompt(
  fileBuffer: Buffer,
  _filename: string,
  mimeType: string,
  prompt?: string
): Promise<Buffer> {
  const promptText = `${PRESERVE_PRODUCT_INSTRUCTION} Background: ${prompt || DEFAULT_STUDIO_PROMPT}. ${QUALITY_SUFFIX}`;
  return callGeminiGenerate(fileBuffer, mimeType, promptText);
}

export interface VirtualModelOptions {
  /** Free-text scene/model description; falls back to DEFAULT_ATMOSPHERE_PROMPT when omitted. */
  prompt?: string;
}

/**
 * Atmosphere mode: places the product on a human model in a lifestyle
 * scene. Returns a fully composited PNG — callers must NOT run it through
 * compositeOnWhite() again.
 */
export async function generateAtmosphereImage(
  fileBuffer: Buffer,
  _filename: string,
  mimeType: string,
  options: VirtualModelOptions = {}
): Promise<Buffer> {
  const promptText = `${PRESERVE_PRODUCT_INSTRUCTION} Scene: ${options.prompt || DEFAULT_ATMOSPHERE_PROMPT}. ${QUALITY_SUFFIX} ${ATMOSPHERE_STYLE_SUFFIX}`;
  return callGeminiGenerate(fileBuffer, mimeType, promptText);
}
