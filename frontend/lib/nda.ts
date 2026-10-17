// Data model and text helpers shared by the HTML preview and the PDF export,
// so both always render the same document.

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaData = {
  purpose: string;
  effectiveDate: string; // ISO yyyy-mm-dd, as produced by <input type="date">
  mndaTermType: "expires" | "untilTerminated";
  mndaTermYears: number;
  confidentialityTermType: "years" | "perpetual";
  confidentialityTermYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [Party, Party];
};

const emptyParty = (): Party => ({ name: "", title: "", company: "", noticeAddress: "" });

// Defaults mirror the pre-filled values in templates/Mutual-NDA-coverpage.md.
export const defaultNdaData: NdaData = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "", // NdaCreator falls back to today
  mndaTermType: "expires",
  mndaTermYears: 1,
  confidentialityTermType: "years",
  confidentialityTermYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  parties: [emptyParty(), emptyParty()],
};

export const COVER_PAGE_INTRO =
  "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“Cover Page”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“Standard Terms”) identical to those posted at commonpaper.com/standards/mutual-nda/1.0. Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.";

export const SIGNING_STATEMENT =
  "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.";

/** Returns the trimmed value, or a bracketed placeholder when it is blank. */
export function orPlaceholder(value: string, label: string): string {
  return value.trim() || `[${label}]`;
}

function years(n: number): string {
  return `${n} year${n === 1 ? "" : "s"}`;
}

/** Today's date in the user's local time zone, as yyyy-mm-dd. */
export function todayIsoDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return "[Effective Date]";
  // Parse as local midnight so the displayed day never shifts with the time zone.
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function describeMndaTerm(data: NdaData): string {
  return data.mndaTermType === "expires"
    ? `Expires ${years(data.mndaTermYears)} from Effective Date.`
    : "Continues until terminated in accordance with the terms of the MNDA.";
}

export function describeConfidentialityTerm(data: NdaData): string {
  return data.confidentialityTermType === "years"
    ? `${years(data.confidentialityTermYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
    : "In perpetuity.";
}

export type CoverPageSection = { heading: string; value: string };

export function coverPageSections(data: NdaData): CoverPageSection[] {
  return [
    { heading: "Purpose", value: orPlaceholder(data.purpose, "Purpose") },
    { heading: "Effective Date", value: formatDate(data.effectiveDate) },
    { heading: "MNDA Term", value: describeMndaTerm(data) },
    { heading: "Term of Confidentiality", value: describeConfidentialityTerm(data) },
    { heading: "Governing Law", value: orPlaceholder(data.governingLaw, "Governing Law") },
    { heading: "Jurisdiction", value: orPlaceholder(data.jurisdiction, "Jurisdiction") },
    { heading: "MNDA Modifications", value: data.modifications.trim() || "None." },
  ];
}

export type PartyRow = { label: string; values: [string, string] };

/** Signature table rows; Signature and Date are left blank for signing. */
export function partyRows(data: NdaData): PartyRow[] {
  const [a, b] = data.parties;
  const row = (label: string, pick: (p: Party) => string): PartyRow => ({
    label,
    values: [pick(a), pick(b)],
  });
  return [
    row("Signature", () => ""),
    row("Print Name", (p) => p.name),
    row("Title", (p) => p.title),
    row("Company", (p) => p.company),
    row("Notice Address", (p) => p.noticeAddress),
    row("Date", () => ""),
  ];
}

export function pdfFileName(data: NdaData): string {
  const companies = data.parties
    .map((p) => p.company.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return ["Mutual-NDA", ...companies].join("_") + ".pdf";
}
