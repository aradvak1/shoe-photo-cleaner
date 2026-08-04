import { applyZoom, burnProductText, burnProductTextFromTemplate } from "./composite";
import type { OverlayTextFields } from "./composite";
import { findTemplate, mergeLayout } from "./photoTemplate";
import type { CustomLayout } from "./photoTemplate";

// Used as the generic starting layout when the user drags/resizes the
// logo or a text field without picking a named template first — dragging
// needs *some* fixed base to nudge from, and this is the only template
// defined today. If more named templates are ever added, this could
// become configurable, but there's nothing to choose between yet.
const GENERIC_BASE_TEMPLATE_ID = "grazia-donna";

/**
 * Shared by the persisting overlay route, the no-save preview route, and
 * the existing-photo reprocess route — zoom always runs first (on the
 * clean, not-yet-burned photo) so it never crops the burned text/logo,
 * then the same template-or-auto burn logic every other path already uses.
 * customLayout (from the design toolbar's drag/resize controls) is merged
 * on top of the base template field-by-field; fields the user never
 * touched keep the base's position.
 */
export async function renderPhoto(
  imageBuffer: Buffer,
  fields: OverlayTextFields,
  logoUrl: string | null,
  templateId: string | null,
  zoom: number | null,
  customLayout?: CustomLayout | null
): Promise<Buffer> {
  const zoomed = zoom != null ? await applyZoom(imageBuffer, zoom) : imageBuffer;
  const hasCustomLayout = Boolean(
    customLayout &&
      (customLayout.logo || customLayout.modelNumber || customLayout.price || customLayout.sizes)
  );
  const base = findTemplate(templateId) ?? (hasCustomLayout ? findTemplate(GENERIC_BASE_TEMPLATE_ID) : null);
  if (!base) return burnProductText(zoomed, fields, logoUrl);
  const effective = mergeLayout(base, customLayout);
  return burnProductTextFromTemplate(zoomed, fields, logoUrl, effective);
}
