import { ClassicGridTemplate } from "./ClassicGridTemplate";
import { MinimalListTemplate } from "./MinimalListTemplate";
import { LuxuryFeatureTemplate } from "./LuxuryFeatureTemplate";
import { BrandedTwoColumnTemplate } from "./BrandedTwoColumnTemplate";
import { CATALOG_TEMPLATE_META } from "./meta";
import type { CatalogTemplateComponent } from "./types";

const COMPONENTS: Record<string, CatalogTemplateComponent> = {
  "classic-grid": ClassicGridTemplate,
  "minimal-list": MinimalListTemplate,
  "luxury-feature": LuxuryFeatureTemplate,
  "two-column-brand": BrandedTwoColumnTemplate,
};

// Single source of truth for template labels lives in meta.ts (shared with
// client components); this registry just attaches the actual React
// component for each slug, for the render worker's server-only use.
export const CATALOG_TEMPLATES: Record<
  string,
  { slug: string; label: string; component: CatalogTemplateComponent }
> = Object.fromEntries(
  CATALOG_TEMPLATE_META.map((meta) => [
    meta.slug,
    { slug: meta.slug, label: meta.label, component: COMPONENTS[meta.slug] },
  ])
);

export { CATALOG_TEMPLATE_META } from "./meta";
export type { CatalogTemplateMeta } from "./meta";
export type { CatalogPhotoEntry, CatalogTemplateProps } from "./types";
