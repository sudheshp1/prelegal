import { describe, expect, it } from "vitest";
import {
  coverPageSections,
  emptyDocument,
  introText,
  pdfFileName,
  signingStatement,
  type DocumentData,
  type DocumentSpec,
} from "./documents";

const spec: DocumentSpec = {
  id: "pilot-agreement",
  filename: "Pilot-Agreement.md",
  title: "Pilot Agreement",
  parties: ["Provider", "Customer"],
  fields: [
    { key: "effectiveDate", label: "Effective Date", description: "", kind: "date", required: true },
    { key: "pilotPeriod", label: "Pilot Period", description: "", required: true },
    { key: "fees", label: "Fees", description: "" },
  ],
};

const data = (values: Record<string, string>, companies = ["", ""]): DocumentData => ({
  documentType: spec.id,
  values,
  parties: [
    { ...emptyDocument.parties[0], company: companies[0] },
    { ...emptyDocument.parties[1], company: companies[1] },
  ],
});

describe("coverPageSections", () => {
  it("formats dates and shows placeholders for missing values", () => {
    expect(coverPageSections(spec, data({ effectiveDate: "2026-10-17", pilotPeriod: " " }))).toEqual([
      { heading: "Effective Date", value: "October 17, 2026" },
      { heading: "Pilot Period", value: "[Pilot Period]" },
      { heading: "Fees", value: "None." },
    ]);
  });
});

describe("cover page text", () => {
  it("uses a generic intro and signing statement unless the spec overrides them", () => {
    expect(introText(spec)).toContain("This Pilot Agreement consists of");
    expect(signingStatement(spec)).toBe("By signing this Cover Page, each party agrees to enter into this Pilot Agreement.");
    expect(introText({ ...spec, intro: "Custom." })).toBe("Custom.");
  });
});

describe("pdfFileName", () => {
  it("combines the title and company names", () => {
    expect(pdfFileName(spec, data({}, ["Acme Corp.", "Globex, Inc"]))).toBe("Pilot-Agreement_Acme-Corp_Globex-Inc.pdf");
    expect(pdfFileName(spec, data({}))).toBe("Pilot-Agreement.pdf");
  });
});
