// Plain data only — no @react-pdf/renderer import here, so this file stays
// safe to import from client components (CatalogBuilder.tsx, the catalog
// wizard) without pulling the PDF renderer into the browser bundle.
export interface CatalogTemplateMeta {
  slug: string;
  label: string;
  description: string;
}

export const CATALOG_TEMPLATE_META: CatalogTemplateMeta[] = [
  {
    slug: "classic-grid",
    label: "רשת קלאסית",
    description: "עד 4 מוצרים בעמוד, כרטיסים עם מסגרת.",
  },
  {
    slug: "minimal-list",
    label: "רשימה מינימלית",
    description: "רשימה צפופה עם תמונה קטנה לכל שורה.",
  },
  {
    slug: "luxury-feature",
    label: "מוצר בודד לעמוד",
    description: "עמוד שער ואז מוצר אחד גדול בכל עמוד.",
  },
  {
    slug: "two-column-brand",
    label: "ממותג, שתי עמודות",
    description: "לוגו בכותרת כל עמוד, עד 6 מוצרים בעמוד.",
  },
];
