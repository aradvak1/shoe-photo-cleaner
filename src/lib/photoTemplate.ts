// Fixed-layout templates: an alternative to composite.ts's auto-placement
// (least-busy-corner) burnProductText. A template pins the logo and each
// text field to an exact spot on every photo, so a whole product line
// looks identically branded — matching a layout the user designs once
// (originally in Canva; now also directly in-app via the template builder
// page at /templates) rather than letting the algorithm choose per photo.
//
// All positions are fractions of canvas width/height (not raw pixels), so
// the same template applies correctly regardless of the actual generated
// photo's resolution.

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

// Every field is optional: a user-built template (see /templates) may only
// define a subset (e.g. just a logo, or logo + model number) — composite.ts
// simply skips whichever fields aren't present.
export interface PhotoTemplate {
  id: string;
  label: string;
  logo?: TemplateLogoField;
  modelNumber?: TemplateTextField;
  price?: TemplateTextField;
  sizes?: TemplateTextField;
  color?: TemplateTextField;
}

// The original hand-measured Canva-derived template. The logo position/size
// and the three original text fields were derived by exporting a source
// Canva design (DAHRObCb2Y4) at its native 1080x1350 and measuring each
// element's rendered pixel bounding box directly (Canva's own reported
// element "pos" coordinates for that design didn't line up with the
// rendered output). The text fields were later redesigned per user
// feedback into one symmetric bottom-right stacked column (דגם / מידות /
// צבע / מחיר, all centered on the same X) instead of the original design's
// split left/right placement, and the logo was enlarged ~25% — both
// hand-tuned, not re-measured. Kept as a built-in (not in the
// photo_templates table) since it predates the in-app template builder.
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
    modelNumber: {
      centerXFraction: 900 / 1080,
      centerYFraction: 1100 / 1350,
      fontSizeFraction: 66.6667 / 1080,
      label: "דגם : ",
    },
    sizes: {
      centerXFraction: 900 / 1080,
      centerYFraction: 1180 / 1350,
      fontSizeFraction: 49.3338 / 1080,
      label: "מידות : ",
    },
    color: {
      centerXFraction: 900 / 1080,
      centerYFraction: 1240 / 1350,
      fontSizeFraction: 49.3338 / 1080,
      label: "צבע : ",
    },
    price: {
      centerXFraction: 900 / 1080,
      centerYFraction: 1300 / 1350,
      fontSizeFraction: 49.3338 / 1080,
      label: "מחיר : ",
    },
  },
];

/** Sync lookup against the built-in templates only — used where a DB round
 * trip isn't available/needed (e.g. the generic drag/resize starting point
 * when no template is selected yet). For anything that might be a
 * user-built template from /templates, use resolveTemplate instead. */
export function findTemplate(id: string | null | undefined): PhotoTemplate | null {
  if (!id) return null;
  return PHOTO_TEMPLATES.find((t) => t.id === id) ?? null;
}

// Loosely typed on purpose: the real Supabase client type is generic over
// the whole database schema and chains into deep, expensive-to-instantiate
// types that don't buy anything here — this function only ever calls
// .from().select().eq().single() and casts the one row it cares about.
// Also keeps this file (imported client-side too, by the design toolbar)
// free of any import that could drag in server-only Supabase setup code.
interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/** Shape of a row from the photo_templates table (and what /api/templates
 * returns) — snake_case, matching the DB columns. Exported so client code
 * (the /templates builder page, the studio toolbar's template picker) can
 * map API responses into PhotoTemplate without duplicating the shape. */
export interface PhotoTemplateRow {
  id: string;
  name: string;
  logo: TemplateLogoField | null;
  model_number: TemplateTextField | null;
  price: TemplateTextField | null;
  sizes: TemplateTextField | null;
  color: TemplateTextField | null;
}

export function rowToTemplate(row: PhotoTemplateRow): PhotoTemplate {
  return {
    id: row.id,
    label: row.name,
    logo: row.logo ?? undefined,
    modelNumber: row.model_number ?? undefined,
    price: row.price ?? undefined,
    sizes: row.sizes ?? undefined,
    color: row.color ?? undefined,
  };
}

/** Full lookup: built-ins first, then the photo_templates table for
 * templates designed in-app via /templates. Server-side only (needs a
 * Supabase client) — used by every route that actually burns a template
 * onto a photo. */
export async function resolveTemplate(
  id: string | null | undefined,
  supabase: SupabaseLike
): Promise<PhotoTemplate | null> {
  const builtin = findTemplate(id);
  if (builtin) return builtin;
  if (!id) return null;
  const { data } = await supabase.from("photo_templates").select("*").eq("id", id).single();
  return data ? rowToTemplate(data) : null;
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
  color?: Partial<Omit<TemplateTextField, "label">>;
}

export function mergeLayout(base: PhotoTemplate, overrides?: CustomLayout | null): PhotoTemplate {
  if (!overrides) return base;
  return {
    ...base,
    logo: overrides.logo ? { ...base.logo, ...overrides.logo } : base.logo,
    modelNumber: overrides.modelNumber
      ? { ...base.modelNumber, ...overrides.modelNumber } as TemplateTextField
      : base.modelNumber,
    price: overrides.price ? { ...base.price, ...overrides.price } as TemplateTextField : base.price,
    sizes: overrides.sizes ? { ...base.sizes, ...overrides.sizes } as TemplateTextField : base.sizes,
    color: overrides.color ? { ...base.color, ...overrides.color } as TemplateTextField : base.color,
  };
}
