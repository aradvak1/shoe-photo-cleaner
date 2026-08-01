import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatModelLine, formatPriceLine, formatSizeLine } from "./format";
import { CoverPage } from "./CoverPage";
import type { CatalogTemplateComponent } from "./types";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "NotoSansHebrew" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#a9754a",
    paddingBottom: 10,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: "bold", direction: "rtl" },
  headerLogo: { width: 36, height: 36, objectFit: "contain" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "48%", paddingBottom: 10 },
  image: { width: "100%", height: 150, objectFit: "contain", marginBottom: 6 },
  line: {
    fontSize: 9.5,
    textAlign: "right",
    direction: "rtl",
    color: "#242018",
    marginBottom: 1,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 28,
    right: 28,
    textAlign: "center",
    direction: "rtl",
    fontSize: 8,
    color: "#7a6f5d",
  },
});

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const BrandedTwoColumnTemplate: CatalogTemplateComponent = ({
  catalogName,
  photos,
  cover,
}) => {
  const pages = chunk(photos, 6);
  const headerLogo = photos.find((p) => p.logoData)?.logoData ?? null;

  return (
    <Document>
      {cover && <CoverPage catalogName={catalogName} cover={cover} />}
      {pages.map((pagePhotos, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{catalogName}</Text>
            {headerLogo && <Image style={styles.headerLogo} src={headerLogo} />}
          </View>
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
          <Text style={styles.footer} fixed>
            {catalogName}
          </Text>
        </Page>
      ))}
    </Document>
  );
};
