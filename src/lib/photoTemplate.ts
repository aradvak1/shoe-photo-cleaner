// Fixed-layout templates: an alternative to composite.ts's auto-placement
// (least-busy-corner) burnProductText. A template pins the logo and each
// text field to an exact spot on every photo, so a whole product line
// looks identically branded — matching a layout the user designs once in
// Canva rather than letting the algorithm choose per photo.
//
// All positions are fractions of canvas width/height (not raw pixels), so
// the same template applies correctly regardless of the actual generated
// photo's resolution. The logo position/size and the three text fields
// were originally derived by exporting a source Canva design (DAHRObCb2Y4)
// at its native 1080x1350 and measuring each element's rendered pixel
// bounding box directly (Canva's own reported element "pos" coordinates
// for that design didn't line up with the rendered output). The text
// fields were later redesigned per user feedback into one symmetric
// bottom-right stacked column (דגם / מידות / מחיר, all centered on the
// same X) instead of the original design's split left/right placement,
// and the logo was enlarged ~25% — both hand-tuned, not re-measured.

export interface TemplateLogoField {
  leftFraction: number;
  topFraction: number;
  widthFraction: number;
  heightFraction: number;
}

export interface TemplateTextField {
  /** Text is centered on this point (both axes) — robust to the real value being longer/shorter than the placeholder was. */
  centerXFraction: number;
  centerYFraction: number;
  /** Relative to canvas width; treated the same as composite.ts's existing pt-per-canvas-width sizing. */
  fontSizeFraction: number;
  /** Baked-in label prefix from the template design, e.g. "דגם : " — the actual value is appended after it. */
  label: string;
}

export interface PhotoTemplate {
  id: string;
  label: string;
  logo: TemplateLogoField;
  modelNumber: TemplateTextField;
  price: TemplateTextField;
  sizes: TemplateTextField;
}

export const PHOTO_TEMPLATES: PhotoTemplate[] = [
  {
    id: "grazia-donna",
    label: "גרציה דונה — מיקום קבוע (מקנבה)",
    logo: {
      leftFraction: 84 / 1080,
      topFraction: 152 / 1350,
      widthFraction: 400 / 1080,
      heightFraction: 303 / 1350,
    },
    // All three text fields form one symmetric stacked column, bottom-right,
    // sharing the same centerXFraction so every line lines up regardless of
    // its text length — replaces the original design's split left/right
    // placement, which read as unbalanced once real values were filled in.
    modelNumber: {
      centerXFraction: 900 / 1080,
      centerYFraction: 1135 / 1350,
      fontSizeFraction: 66.6667 / 1080,
      label: "דגם : ",
    },
    sizes: {
      centerXFraction: 900 / 1080,
      centerYFraction: 1220 / 1350,
      fontSizeFraction: 49.3338 / 1080,
      label: "מידות : ",
    },
    price: {
      centerXFraction: 900 / 1080,
      centerYFraction: 1285 / 1350,
      fontSizeFraction: 49.3338 / 1080,
      label: "מחיר : ",
    },
  },
];

export function findTemplate(id: string | null | undefined): PhotoTemplate | null {
  if (!id) return null;
  return PHOTO_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Per-photo drag-positioned/resized overrides for the logo and/or each
 * text field, layered on top of a template's (or the generic default's)
 * fractions — the design toolbar's "move/resize" feature. Text fields omit
 * `label`: the prefix text (e.g. "דגם : ") always comes from the base
 * layout, only position/size are ever user-dragged. */
export interface CustomLayout {
  logo?: TemplateLogoField;
  modelNumber?: Partial<Omit<TemplateTextField, "label">>;
  price?: Partial<Omit<TemplateTextField, "label">>;
  sizes?: Partial<Omit<TemplateTextField, "label">>;
}

export function mergeLayout(base: PhotoTemplate, overrides?: CustomLayout | null): PhotoTemplate {
  if (!overrides) return base;
  return {
    ...base,
    logo: overrides.logo ? { ...base.logo, ...overrides.logo } : base.logo,
    modelNumber: overrides.modelNumber
      ? { ...base.modelNumber, ...overrides.modelNumber }
      : base.modelNumber,
    price: overrides.price ? { ...base.price, ...overrides.price } : base.price,
    sizes: overrides.sizes ? { ...base.sizes, ...overrides.sizes } : base.sizes,
  };
}
