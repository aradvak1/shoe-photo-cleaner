// react-pdf page sizes are in points (72pt = 1 inch). Every generated
// product photo is a 1080x1080 square (see gemini.ts's OUTPUT_ASPECT_RATIO),
// so a template built around ONE full-focus photo per page (LuxuryFeature)
// or the shared cover page fits that shape far better than the default A4
// (595x842pt, a tall print-paper ratio) — on A4 a square photo only ever
// fills the page's width, leaving large blank margins above and below, and
// centered cover content ends up vertically mid-page, invisible in a
// cropped preview (e.g. WhatsApp's inline PDF thumbnail) without scrolling.
// 595pt (A4's own width) keeps it trivially printable on a standard sheet
// if anyone ever does, while being square so the photo/cover fills it.
export const SQUARE_PAGE_SIZE: [number, number] = [595, 595];

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
