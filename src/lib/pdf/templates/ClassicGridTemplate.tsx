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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  card: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e7ddd0",
    borderRadius: 6,
    padding: 10,
  },
  image: {
    width: "100%",
    height: 180,
    objectFit: "contain",
    marginBottom: 8,
  },
  line: {
    fontSize: 10,
    textAlign: "right",
    direction: "rtl",
    color: "#242018",
    marginBottom: 2,
  },
});

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const ClassicGridTemplate: CatalogTemplateComponent = ({ catalogName, photos, cover }) => {
  const pages = chunk(photos, 4);
  return (
    <Document>
      {cover && <CoverPage catalogName={catalogName} cover={cover} />}
      {pages.map((pagePhotos, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {pageIndex === 0 && <Text style={styles.title}>{catalogName}</Text>}
          <View style={styles.grid}>
            {pagePhotos.map((photo, i) => (
              <View key={i} style={styles.card}>
                <Image style={styles.image} src={photo.imageData} />
                <Text style={styles.line}>{formatModelLine(photo)}</Text>
                {formatPriceLine(photo) && (
                  <Text style={styles.line}>{formatPriceLine(photo)}</Text>
                )}
                {formatSizeLine(photo) && (
                  <Text style={styles.line}>{formatSizeLine(photo)}</Text>
                )}
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
};
