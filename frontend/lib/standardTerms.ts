import { readFileSync } from "node:fs";
import path from "node:path";

// The Standard Terms are read from the repo's shared templates directory so
// there is a single source of truth for the agreement text.

/** A run of clause text: plain, bold (a defined term) or a Cover Page reference. */
export type Segment = { kind: "text" | "bold" | "ref"; text: string };

export type Clause = { number: number; title: string; body: Segment[] };

export type StandardTerms = { clauses: Clause[]; attribution: string };

const TEMPLATE_PATH = path.join(process.cwd(), "..", "templates", "Mutual-NDA.md");

const CLAUSE_PATTERN = /^(\d+)\.\s+\*\*(.+?)\*\*\.\s+(.*)$/;
const INLINE_PATTERN = /\*\*(.+?)\*\*|<span class="coverpage_link">(.+?)<\/span>/g;
const LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > last) segments.push({ kind: "text", text: text.slice(last, match.index) });
    segments.push(match[1] ? { kind: "bold", text: match[1] } : { kind: "ref", text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

export function parseStandardTerms(markdown: string): StandardTerms {
  const clauses: Clause[] = [];
  let attribution = "";
  for (const line of markdown.split(/\r?\n/).map((l) => l.trim())) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(CLAUSE_PATTERN);
    if (match) {
      clauses.push({ number: Number(match[1]), title: match[2], body: parseSegments(match[3]) });
    } else {
      attribution = line.replace(LINK_PATTERN, "$1");
    }
  }
  return { clauses, attribution };
}

/** Runs at build time (the page is prerendered), so the repo's templates/ directory must be present. */
export function loadStandardTerms(): StandardTerms {
  let markdown: string;
  try {
    markdown = readFileSync(TEMPLATE_PATH, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read the Mutual NDA template at ${TEMPLATE_PATH}. Build the app from the frontend/ directory of a full repo checkout.`,
      { cause: error },
    );
  }
  return parseStandardTerms(markdown);
}
