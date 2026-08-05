import { Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { SQUARE_PAGE_SIZE } from "./types";
import type { CatalogCoverData } from "./types";

// Shared across all 4 templates so a designed cover page (large logo +
// title/subtitle/extra text) isn't reimplemented per template. Palette
// matches LuxuryFeatureTemplate's existing bare cover (#242018 charcoal /
// #faf7f2 cream) plus BrandedTwoColumnTemplate's #a9754a copper accent, so
// a cover page reads as part of the same design system regardless of which
// template renders the product pages after it.
const styles = StyleSheet.create({
  page: {
    padding: 0,
    paddingTop: 72,
    fontFamily: "NotoSansHebrew",
    backgroundColor: "#242018",
    alignItems: "center",
    // Top-anchored, not vertically centered: a phone-sized preview (e.g.
    // WhatsApp's inline PDF thumbnail) often only shows the top portion of
    // a page before the reader scrolls — centered content on a full page
    // could sit entirely below that crop, looking like a blank page.
    justifyContent: "flex-start",
  },
  logo: { width: 150, height: 150, objectFit: "contain", marginBottom: 28 },
  rule: { width: 64, height: 2, backgroundColor: "#a9754a", marginBottom: 20 },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#faf7f2",
    textAlign: "center",
    direction: "rtl",
    paddingHorizontal: 48,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    color: "#c9b89e",
    textAlign: "center",
    direction: "rtl",
    paddingHorizontal: 48,
  },
  extraText: {
    marginTop: 28,
    fontSize: 10,
    color: "#7a6f5d",
    textAlign: "center",
    direction: "rtl",
    paddingHorizontal: 64,
  },
});

export function CoverPage({
  catalogName,
  cover,
}: {
  catalogName: string;
  cover: CatalogCoverData;
}) {
  return (
    <Page size={SQUARE_PAGE_SIZE} style={styles.page}>
      {cover.logoData && <Image style={styles.logo} src={cover.logoData} />}
      <View style={styles.rule} />
      <Text style={styles.title}>{cover.title || catalogName}</Text>
      {cover.subtitle && <Text style={styles.subtitle}>{cover.subtitle}</Text>}
      {cover.extraText && <Text style={styles.extraText}>{cover.extraText}</Text>}
    </Page>
  );
}
