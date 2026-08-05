import { applyZoom, burnProductText, burnProductTextFromTemplate } from "./composite";
import type { OverlayTextFields } from "./composite";
import { findTemplate, mergeLayout } from "./photoTemplate";
import type { CustomLayout, PhotoTemplate } from "./photoTemplate";

// Used as the generic starting layout when the user drags/resizes the
// logo or a text field without picking a named template first — dragging
// needs *some* fixed base to nudge from, and this is the only built-in
// template. If more built-ins are ever added, this could become
// configurable.
const GENERIC_BASE_TEMPLATE_ID = "grazia-donna";

/**
 * Shared by the persisting overlay route, the no-save preview route, and
 * the existing-photo reprocess route — zoom always runs first (on the
 * clean, not-yet-burned photo) so it never crops the burned text/logo,
 * then the same template-or-auto burn logic every other path already uses.
 * customLayout (from the design toolbar's drag/resize controls) is merged
 * on top of the base template field-by-field; fields the user never
 * touched keep the base's position. Takes an already-resolved template
 * (not an id) — callers resolve via photoTemplate.ts's resolveTemplate,
 * since that needs a Supabase client for user-built templates and this
 * module stays free of that dependency.
 */
export async function renderPhoto(
  imageBuffer: Buffer,
  fields: OverlayTextFields,
  logoUrl: string | null,
  template: PhotoTemplate | null,
  zoom: number | null,
  customLayout?: CustomLayout | null
): Promise<Buffer> {
  const zoomed = zoom != null ? await applyZoom(imageBuffer, zoom) : imageBuffer;
  const hasCustomLayout = Boolean(
    customLayout &&
      (customLayout.logo ||
        customLayout.modelNumber ||
        customLayout.price ||
        customLayout.sizes ||
        customLayout.color)
  );
  const base = template ?? (hasCustomLayout ? findTemplate(GENERIC_BASE_TEMPLATE_ID) : null);
  if (!base) return burnProductText(zoomed, fields, logoUrl);
  const effective = mergeLayout(base, customLayout);
  // Fields the user explicitly dragged (present in customLayout) must never
  // be auto-nudged away from where they put them — only the template's own
  // default position for a field is subject to collision avoidance.
  const lockedFields = new Set(Object.keys(customLayout ?? {})) as Set<
    "logo" | "modelNumber" | "price" | "sizes" | "color"
  >;
  return burnProductTextFromTemplate(zoomed, fields, logoUrl, effective, lockedFields);
}
