export type PhotoStatus = "pending" | "processed" | "approved";
export type PhotoMode = "studio" | "atmosphere";

export interface Logo {
  id: string;
  name: string;
  image_url: string | null;
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
  created_at: string;
}

export interface ProcessedImageResult {
  imageUrl: string;
  originalUrl: string;
}

export interface Catalog {
  id: string;
  name: string;
  template_id: string;
  pdf_url: string | null;
  created_at: string;
}

export interface CatalogPhoto {
  id: string;
  catalog_id: string;
  photo_id: string;
  position: number;
}
