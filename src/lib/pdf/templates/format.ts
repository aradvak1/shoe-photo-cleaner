import type { CatalogPhotoEntry } from "./types";

// @react-pdf/renderer's textkit has its own Unicode BiDi engine (bidi-js
// under the hood) — pass plain logical-order Hebrew strings and set
// `direction: "rtl"` on the Text style; do not pre-reorder the text here.

export function formatModelLine(photo: CatalogPhotoEntry): string {
  return `מספר דגם: ${photo.modelNumber || "—"}`;
}

export function formatPriceLine(photo: CatalogPhotoEntry): string {
  return photo.price != null ? `מחיר: ₪${photo.price}` : "";
}

export function formatSizeLine(photo: CatalogPhotoEntry): string {
  if (photo.sizeMin == null && photo.sizeMax == null) return "";
  return `מידות: ${photo.sizeMin ?? "?"}-${photo.sizeMax ?? "?"}`;
}
