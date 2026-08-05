export interface CatalogPhotoEntry {
  /** Pre-fetched image bytes — react-pdf's remote <Image src="https://..."> fetch is unreliable in a Vercel Node function, so images are downloaded server-side before rendering. */
  imageData: Buffer;
  logoData: Buffer | null;
  modelNumber: string | null;
  price: number | null;
  logoName: string | null;
  sizeMin: number | null;
  sizeMax: number | null;
  /** Whether each field is already burned directly onto imageData (studio
   * template or auto-placement burn) — templates skip a caption line for
   * a field that's already visible on the photo instead of repeating it. */
  burnedFields: { model: boolean; price: boolean; sizes: boolean };
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
