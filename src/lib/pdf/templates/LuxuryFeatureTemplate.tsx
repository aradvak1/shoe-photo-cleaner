import { Document, Page, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatModelLine, formatPriceLine, formatSizeLine } from "./format";
import { CoverPage } from "./CoverPage";
import { SQUARE_PAGE_SIZE } from "./types";
import type { CatalogTemplateComponent } from "./types";

const styles = StyleSheet.create({
  cover: {
    padding: 0,
    fontFamily: "NotoSansHebrew",
    backgroundColor: "#242018",
    alignItems: "center",
    justifyContent: "center",
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#faf7f2",
    textAlign: "center",
    direction: "rtl",
  },
  page: {
    padding: 32,
    fontFamily: "NotoSansHebrew",
    flexDirection: "column",
    alignItems: "center",
  },
  // flexGrow (not a fixed height) so the photo fills whatever space is left
  // on the now-square page after the caption lines below it, instead of a
  // fixed 380pt leaving large blank margins on a 595x595 page.
  image: { width: "100%", flexGrow: 1, objectFit: "contain", marginBottom: 16 },
  modelLine: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    direction: "rtl",
    marginBottom: 6,
  },
  line: { fontSize: 12, textAlign: "center", direction: "rtl", color: "#7a6f5d", marginBottom: 3 },
});

export const LuxuryFeatureTemplate: CatalogTemplateComponent = ({ catalogName, photos, cover }) => (
  <Document>
    {cover ? (
      <CoverPage catalogName={catalogName} cover={cover} />
    ) : (
      <Page size={SQUARE_PAGE_SIZE} style={styles.cover}>
        <Text style={styles.coverTitle}>{catalogName}</Text>
      </Page>
    )}
    {photos.map((photo, i) => (
      <Page key={i} size={SQUARE_PAGE_SIZE} style={styles.page}>
        <Image style={styles.image} src={photo.imageData} />
        {!photo.burnedFields.model && (
          <Text style={styles.modelLine}>{formatModelLine(photo)}</Text>
        )}
        {!photo.burnedFields.price && formatPriceLine(photo) && (
          <Text style={styles.line}>{formatPriceLine(photo)}</Text>
        )}
        {!photo.burnedFields.sizes && formatSizeLine(photo) && (
          <Text style={styles.line}>{formatSizeLine(photo)}</Text>
        )}
      </Page>
    ))}
  </Document>
);
