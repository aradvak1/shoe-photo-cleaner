import { Document, Page, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatModelLine, formatPriceLine, formatSizeLine } from "./format";
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
    padding: 40,
    fontFamily: "NotoSansHebrew",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "80%", height: 380, objectFit: "contain", marginBottom: 24 },
  modelLine: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    direction: "rtl",
    marginBottom: 6,
  },
  line: { fontSize: 12, textAlign: "center", direction: "rtl", color: "#7a6f5d", marginBottom: 3 },
});

export const LuxuryFeatureTemplate: CatalogTemplateComponent = ({ catalogName, photos }) => (
  <Document>
    <Page size="A4" style={styles.cover}>
      <Text style={styles.coverTitle}>{catalogName}</Text>
    </Page>
    {photos.map((photo, i) => (
      <Page key={i} size="A4" style={styles.page}>
        <Image style={styles.image} src={photo.imageData} />
        <Text style={styles.modelLine}>{formatModelLine(photo)}</Text>
        {formatPriceLine(photo) && <Text style={styles.line}>{formatPriceLine(photo)}</Text>}
        {formatSizeLine(photo) && <Text style={styles.line}>{formatSizeLine(photo)}</Text>}
      </Page>
    ))}
  </Document>
);
