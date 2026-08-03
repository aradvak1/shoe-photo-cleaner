import { applyZoom, burnProductText, burnProductTextFromTemplate } from "./composite";
import type { OverlayTextFields } from "./composite";
import { findTemplate } from "./photoTemplate";

/**
 * Shared by the persisting overlay route, the no-save preview route, and
 * the existing-photo reprocess route — zoom always runs first (on the
 * clean, not-yet-burned photo) so it never crops the burned text/logo,
 * then the same template-or-auto burn logic every other path already uses.
 */
export async function renderPhoto(
  imageBuffer: Buffer,
  fields: OverlayTextFields,
  logoUrl: string | null,
  templateId: string | null,
  zoom: number | null
): Promise<Buffer> {
  const zoomed = zoom != null ? await applyZoom(imageBuffer, zoom) : imageBuffer;
  const template = findTemplate(templateId);
  return template
    ? burnProductTextFromTemplate(zoomed, fields, logoUrl, template)
    : burnProductText(zoomed, fields, logoUrl);
}
