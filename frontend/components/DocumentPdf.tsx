import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  DISCLAIMER,
  coverPageSections,
  introText,
  partyRows,
  signingStatement,
  type DocumentData,
  type LegalDocument,
} from "@/lib/documents";
import type { Segment } from "@/lib/templates";

// PDF counterpart of DocumentPreview. Only loaded on demand by the download button.

const styles = StyleSheet.create({
  page: { padding: 56, paddingBottom: 76, fontFamily: "Times-Roman", fontSize: 10.5, lineHeight: 1.45 },
  title: { fontFamily: "Times-Bold", fontSize: 16, textAlign: "center", marginBottom: 14 },
  draft: { fontFamily: "Times-Bold", fontSize: 9, textAlign: "center", color: "#a16207", marginTop: -8, marginBottom: 14 },
  footer: { position: "absolute", bottom: 30, left: 56, right: 56, fontSize: 8, color: "#555", textAlign: "center" },
  paragraph: { marginBottom: 10 },
  heading: { fontFamily: "Times-Bold" },
  section: { marginBottom: 8 },
  table: { marginTop: 6, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#999" },
  row: { flexDirection: "row" },
  cell: { flex: 2, minHeight: 24, padding: 5, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#999" },
  labelCell: { flex: 1, fontFamily: "Times-Bold" },
  headerCell: { fontFamily: "Times-Bold", textAlign: "center", textTransform: "uppercase" },
  bold: { fontFamily: "Times-Bold" },
  ref: { textDecoration: "underline" },
  attribution: { marginTop: 12, fontSize: 8.5, color: "#555" },
});

const INDENT_PER_LEVEL = 18;

/** Repeated at the bottom of every page. */
function Footer() {
  return (
    <Text style={styles.footer} fixed>
      {DISCLAIMER}
    </Text>
  );
}

function SegmentText({ segment }: { segment: Segment }) {
  if (segment.kind === "bold") return <Text style={styles.bold}>{segment.text}</Text>;
  if (segment.kind === "ref") return <Text style={styles.ref}>{segment.text}</Text>;
  return <Text>{segment.text}</Text>;
}

export default function DocumentPdf({ doc, data }: { doc: LegalDocument; data: DocumentData }) {
  return (
    <Document title={doc.title}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.draft}>DRAFT — SUBJECT TO LEGAL REVIEW</Text>
        <Text style={styles.paragraph}>{introText(doc)}</Text>

        {coverPageSections(doc, data).map(({ heading, value }) => (
          <View key={heading} style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text>{value}</Text>
          </View>
        ))}

        <Text style={styles.paragraph}>{signingStatement(doc)}</Text>

        <View style={styles.table} wrap={false}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.labelCell]} />
            {doc.parties.map((role) => (
              <Text key={role} style={[styles.cell, styles.headerCell]}>
                {role}
              </Text>
            ))}
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
        <Footer />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Standard Terms</Text>
        {doc.clauses.map((clause, index) => (
          <Text key={index} style={[styles.paragraph, { marginLeft: clause.depth * INDENT_PER_LEVEL }]}>
            {clause.number}{" "}
            {clause.body.map((segment, i) => (
              <SegmentText key={i} segment={segment} />
            ))}
          </Text>
        ))}
        <Text style={styles.attribution}>{doc.attribution}</Text>
        <Footer />
      </Page>
    </Document>
  );
}
