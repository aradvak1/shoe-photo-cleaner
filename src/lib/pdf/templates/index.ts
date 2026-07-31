import { ClassicGridTemplate } from "./ClassicGridTemplate";
import { MinimalListTemplate } from "./MinimalListTemplate";
import { LuxuryFeatureTemplate } from "./LuxuryFeatureTemplate";
import { BrandedTwoColumnTemplate } from "./BrandedTwoColumnTemplate";
import type { CatalogTemplateComponent } from "./types";

export const CATALOG_TEMPLATES: Record<
  string,
  { slug: string; label: string; component: CatalogTemplateComponent }
> = {
  "classic-grid": {
    slug: "classic-grid",
    label: "רשת קלאסית",
    component: ClassicGridTemplate,
  },
  "minimal-list": {
    slug: "minimal-list",
    label: "רשימה מינימלית",
    component: MinimalListTemplate,
  },
  "luxury-feature": {
    slug: "luxury-feature",
    label: "מוצר בודד לעמוד",
    component: LuxuryFeatureTemplate,
  },
  "two-column-brand": {
    slug: "two-column-brand",
    label: "ממותג, שתי עמודות",
    component: BrandedTwoColumnTemplate,
  },
};

export type { CatalogPhotoEntry, CatalogTemplateProps } from "./types";
