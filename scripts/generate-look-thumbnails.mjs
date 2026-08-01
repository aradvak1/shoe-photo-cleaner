// One-off, run manually (not wired into dev/build): generates the example
// "look" thumbnails shown in the catalog wizard's style picker, by running
// each src/lib/catalogLooks.ts entry's basePrompt through the same Gemini
// call the app itself makes (mirrored here rather than imported, since this
// is a plain Node script and gemini.ts is TypeScript with no ts-node/tsx in
// this repo's toolchain — see scripts/build-pdf-worker.mjs for the same
// plain-JS-script precedent).
//
// Usage: GEMINI_API_KEY=... node scripts/generate-look-thumbnails.mjs
// (or rely on .env.local, parsed below)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^"(.*)"$/, "$1");
  }
}
loadEnvLocal();

const REFERENCE_PHOTO =
  "c:\\Users\\RAZ VAKNIM\\Desktop\\דגמים חדשים\\WhatsApp Image 2026-07-16 at 17.31.45 (1).jpeg";
const OUTPUT_DIR = path.join(ROOT, "public", "catalog-looks");

// Mirrors src/lib/gemini.ts constants — kept in sync by hand since this
// script can't import the TS module directly (see header comment).
const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const OUTPUT_ASPECT_RATIO = "9:16";
const PRESERVE_PRODUCT_INSTRUCTION =
  "The product shown in the attached photo is the exact item being sold. Preserve its exact shape, color, material, texture, and every hardware detail (buckles, studs, stitching, logos) with complete fidelity — do not redesign, simplify, or alter it in any way. Only change the surrounding background/scene as described below.";
const QUALITY_SUFFIX =
  "Photorealistic, high-end commercial product photography, DSLR quality, shallow depth of field, ultra high detail, no text, no watermark, no logo overlay.";
const ATMOSPHERE_STYLE_SUFFIX =
  "Editorial fashion photography, natural window lighting, sophisticated designer wardrobe, luxury fashion styling.";

const LOOKS = [
  // atmosphere
  { id: "beach-mediterranean", kind: "atmosphere", basePrompt: "a model on a sunlit Mediterranean beach at golden hour, white sand, soft-focus turquoise sea in the background, flowing light linen outfit, warm natural sunlight, relaxed vacation-editorial mood" },
  { id: "europe-autumn-street", kind: "atmosphere", basePrompt: "a model walking on a European old-town cobblestone street, warm brown and orange autumn foliage, soft overcast afternoon light, tailored coat, wool textures" },
  { id: "tuscan-countryside", kind: "atmosphere", basePrompt: "a model on a golden dirt path lined with cypress trees, late-afternoon sun, a rustic Tuscan villa in soft focus in the background, relaxed linen dress" },
  // studio_model
  { id: "studio-white-minimal", kind: "atmosphere", basePrompt: "a model against a plain seamless white and cream studio backdrop, soft softbox lighting, simple neutral outfit, clean editorial studio pose, no scene or props" },
  { id: "studio-dark-dramatic", kind: "atmosphere", basePrompt: "a model against a deep charcoal and black seamless studio backdrop, single dramatic side spotlight, high-contrast mood, monochrome outfit" },
  { id: "studio-warm-beige", kind: "atmosphere", basePrompt: "a model against a warm beige and cream seamless studio backdrop matching a luxury brand palette, soft diffused lighting, minimal elegant styling" },
  // product
  { id: "backdrop-classic-beige", kind: "studio", basePrompt: "a smooth seamless studio backdrop in warm neutral beige and cream tones with a subtle soft gradient, professional softbox lighting, soft realistic contact shadow beneath the product" },
  { id: "backdrop-clean-white", kind: "studio", basePrompt: "a pure white seamless e-commerce product backdrop, even shadow-free lighting, crisp clean studio look" },
  { id: "backdrop-light-marble", kind: "studio", basePrompt: "a light marble-textured surface backdrop with subtle veining, soft natural light, understated luxury retail feel" },
];

async function generate(basePrompt, kind, referenceBuffer) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const promptText =
    kind === "atmosphere"
      ? `${PRESERVE_PRODUCT_INSTRUCTION} Scene: ${basePrompt}. ${QUALITY_SUFFIX} ${ATMOSPHERE_STYLE_SUFFIX}`
      : `${PRESERVE_PRODUCT_INSTRUCTION} Background: ${basePrompt}. ${QUALITY_SUFFIX}`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            { inline_data: { mime_type: "image/jpeg", data: referenceBuffer.toString("base64") } },
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
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    throw new Error(`No image in response${finishReason ? ` (finishReason: ${finishReason})` : ""}`);
  }
  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const referenceBuffer = readFileSync(REFERENCE_PHOTO);

  for (const look of LOOKS) {
    const outPath = path.join(OUTPUT_DIR, `${look.id}.png`);
    process.stdout.write(`Generating ${look.id}... `);
    try {
      const png = await generate(look.basePrompt, look.kind, referenceBuffer);
      writeFileSync(outPath, png);
      console.log(`OK (${png.length} bytes)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
}

main();
