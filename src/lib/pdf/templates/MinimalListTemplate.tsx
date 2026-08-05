import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatModelLine, formatPriceLine, formatSizeLine } from "./format";
import { CoverPage } from "./CoverPage";
import type { CatalogTemplateComponent } from "./types";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "NotoSansHebrew" },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
    direction: "rtl",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e7ddd0",
    paddingVertical: 8,
  },
  thumb: { width: 56, height: 56, objectFit: "contain" },
  details: { flex: 1 },
  line: {
    fontSize: 10,
    textAlign: "right",
    direction: "rtl",
    color: "#242018",
    marginBottom: 1,
  },
  modelLine: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "right",
    direction: "rtl",
    marginBottom: 2,
  },
});

export const MinimalListTemplate: CatalogTemplateComponent = ({ catalogName, photos, cover }) => (
  <Document>
    {cover && <CoverPage catalogName={catalogName} cover={cover} />}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{catalogName}</Text>
      {photos.map((photo, i) => (
        <View key={i} style={styles.row}>
          <Image style={styles.thumb} src={photo.imageData} />
          <View style={styles.details}>
            {!photo.burnedFields.model && (
              <Text style={styles.modelLine}>{formatModelLine(photo)}</Text>
            )}
            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              {!photo.burnedFields.price && formatPriceLine(photo) && (
                <Text style={styles.line}>{formatPriceLine(photo)}</Text>
              )}
              {!photo.burnedFields.sizes && formatSizeLine(photo) && (
                <Text style={styles.line}>{formatSizeLine(photo)}</Text>
              )}
            </View>
          </View>
        </View>
      ))}
    </Page>
  </Document>
);
