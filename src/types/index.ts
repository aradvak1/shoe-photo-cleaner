import type { CustomLayout } from "@/lib/photoTemplate";

export type PhotoStatus = "pending" | "processed" | "approved";
export type PhotoMode = "studio" | "atmosphere";

export interface Logo {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
}

export interface Preset {
  id: string;
  name: string;
  mode: PhotoMode;
  prompt: string | null;
  logo_id: string | null;
  burn_text: boolean;
  model_number: string | null;
  sku: string | null;
  price: number | null;
  size_min: number | null;
  size_max: number | null;
  color: string | null;
  template_id: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  image_url: string;
  original_url: string;
  model_number: string | null;
  price: number | null;
  logo_id: string | null;
  batch_id: string;
  status: PhotoStatus;
  size_min: number | null;
  size_max: number | null;
  custom_prompt: string | null;
  mode: PhotoMode;
  sku: string | null;
  color: string | null;
  burned_text: boolean;
  template_id: string | null;
  zoom: number | null;
  custom_layout: CustomLayout | null;
  created_at: string;
}

export interface ProcessedImageResult {
  imageUrl: string;
  originalUrl: string;
}

export type CatalogStyleCategory = "atmosphere" | "studio_model" | "product";

export interface Catalog {
  id: string;
  name: string;
  template_id: string;
  pdf_url: string | null;
  created_at: string;
  style_category: CatalogStyleCategory | null;
  look_id: string | null;
  resolved_prompt: string | null;
  cover_title: string | null;
  cover_subtitle: string | null;
  cover_extra_text: string | null;
  cover_logo_id: string | null;
}

export interface CatalogPhoto {
  id: string;
  catalog_id: string;
  photo_id: string;
  position: number;
}
