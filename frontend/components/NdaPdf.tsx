import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  COVER_PAGE_INTRO,
  SIGNING_STATEMENT,
  coverPageSections,
  partyRows,
  type NdaData,
} from "@/lib/nda";
import type { Segment, StandardTerms } from "@/lib/standardTerms";

// PDF counterpart of NdaPreview. Only loaded on demand by the download button.

const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: "Times-Roman", fontSize: 10.5, lineHeight: 1.45 },
  title: { fontFamily: "Times-Bold", fontSize: 16, textAlign: "center", marginBottom: 14 },
  paragraph: { marginBottom: 10 },
  heading: { fontFamily: "Times-Bold" },
  section: { marginBottom: 8 },
  table: { marginTop: 6, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#999" },
  row: { flexDirection: "row" },
  cell: { flex: 2, minHeight: 24, padding: 5, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#999" },
  labelCell: { flex: 1, fontFamily: "Times-Bold" },
  headerCell: { fontFamily: "Times-Bold", textAlign: "center" },
  bold: { fontFamily: "Times-Bold" },
  ref: { textDecoration: "underline" },
  attribution: { marginTop: 12, fontSize: 8.5, color: "#555" },
});

function SegmentText({ segment }: { segment: Segment }) {
  if (segment.kind === "bold") return <Text style={styles.bold}>{segment.text}</Text>;
  if (segment.kind === "ref") return <Text style={styles.ref}>{segment.text}</Text>;
  return <Text>{segment.text}</Text>;
}

export default function NdaPdf({ data, terms }: { data: NdaData; terms: StandardTerms }) {
  return (
    <Document title="Mutual Non-Disclosure Agreement">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Mutual Non-Disclosure Agreement</Text>
        <Text style={styles.paragraph}>{COVER_PAGE_INTRO}</Text>

        {coverPageSections(data).map(({ heading, value }) => (
          <View key={heading} style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text>{value}</Text>
          </View>
        ))}

        <Text style={styles.paragraph}>{SIGNING_STATEMENT}</Text>

        <View style={styles.table} wrap={false}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.labelCell]} />
            <Text style={[styles.cell, styles.headerCell]}>PARTY 1</Text>
            <Text style={[styles.cell, styles.headerCell]}>PARTY 2</Text>
          </View>
          {partyRows(data).map(({ label, values }) => (
            <View key={label} style={styles.row}>
              <Text style={[styles.cell, styles.labelCell]}>{label}</Text>
              {values.map((value, i) => (
                <Text key={i} style={styles.cell}>
                  {value}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Standard Terms</Text>
        {terms.clauses.map((clause) => (
          <Text key={clause.number} style={styles.paragraph}>
            {clause.number}. <Text style={styles.bold}>{clause.title}</Text>.{" "}
            {clause.body.map((segment, i) => (
              <SegmentText key={i} segment={segment} />
            ))}
          </Text>
        ))}
        <Text style={styles.attribution}>{terms.attribution}</Text>
      </Page>
    </Document>
  );
}
