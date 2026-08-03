// Fixed-layout templates: an alternative to composite.ts's auto-placement
// (least-busy-corner) burnProductText. A template pins the logo and each
// text field to an exact spot on every photo, so a whole product line
// looks identically branded — matching a layout the user designs once in
// Canva rather than letting the algorithm choose per photo.
//
// All positions are fractions of canvas width/height (not raw pixels), so
// the same template applies correctly regardless of the actual generated
// photo's resolution. They were derived by exporting the source Canva
// design (DAHRObCb2Y4) at its native 1080x1350 and measuring each
// element's rendered pixel bounding box directly — Canva's own reported
// element "pos" coordinates for this design don't line up with the
// rendered output (some exceed the canvas width entirely), so trust the
// pixel measurement, not the design's raw CDF position data, if this ever
// needs re-deriving.

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
      widthFraction: 319 / 1080,
      heightFraction: 242 / 1350,
    },
    modelNumber: {
      centerXFraction: 931.5 / 1080,
      centerYFraction: 1251.5 / 1350,
      fontSizeFraction: 66.6667 / 1080,
      label: "דגם : ",
    },
    price: {
      centerXFraction: 236 / 1080,
      centerYFraction: 1285.5 / 1350,
      fontSizeFraction: 49.3338 / 1080,
      label: "מחיר : ",
    },
    sizes: {
      centerXFraction: 247.5 / 1080,
      centerYFraction: 1202.5 / 1350,
      fontSizeFraction: 49.3338 / 1080,
      label: "מידות : ",
    },
  },
];

export function findTemplate(id: string | null | undefined): PhotoTemplate | null {
  if (!id) return null;
  return PHOTO_TEMPLATES.find((t) => t.id === id) ?? null;
}
