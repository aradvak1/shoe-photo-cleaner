export interface CatalogPhotoEntry {
  /** Pre-fetched image bytes — react-pdf's remote <Image src="https://..."> fetch is unreliable in a Vercel Node function, so images are downloaded server-side before rendering. */
  imageData: Buffer;
  logoData: Buffer | null;
  modelNumber: string | null;
  price: number | null;
  logoName: string | null;
  sizeMin: number | null;
  sizeMax: number | null;
}

export interface CatalogCoverData {
  title: string | null;
  subtitle: string | null;
  extraText: string | null;
  logoData: Buffer | null;
}

export interface CatalogTemplateProps {
  catalogName: string;
  photos: CatalogPhotoEntry[];
  /** Absent entirely = render exactly as before (no cover page changes for older catalogs). */
  cover?: CatalogCoverData;
}

export type CatalogTemplateComponent = React.FC<CatalogTemplateProps>;
