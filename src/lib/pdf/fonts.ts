import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Registers the bundled Hebrew-capable font. Must be called fresh before
 * every render, NOT once per process — @react-pdf/textkit's internal bidi
 * reorder cache (@react-pdf/textkit lib/textkit.js reorderLine) gets into
 * a corrupted state on the 2nd+ render sharing a previously-registered
 * font in the same long-lived Node process (Vercel Fluid Compute reuses
 * instances across requests), throwing "Cannot read properties of
 * undefined (reading 'id')" from inside its glyph-reordering step.
 * Re-registering the font (same family name is fine) before each render
 * resets that internal state and avoids the bug — confirmed empirically
 * across repeated sequential renders.
 */
export function registerCatalogFonts() {
  const fontPath = path.join(process.cwd(), "src/lib/pdf/fonts/NotoSansHebrew-Variable.ttf");
  Font.register({
    family: "NotoSansHebrew",
    fonts: [
      { src: fontPath, fontWeight: "normal" },
      { src: fontPath, fontWeight: "bold" },
    ],
  });

  // Disable hyphenation — the default callback splits words at arbitrary
  // points, which breaks Hebrew text layout.
  Font.registerHyphenationCallback((word) => [word]);
}
