import { readFileSync } from "node:fs";
import path from "node:path";
import type { DocumentSpec, LegalDocument } from "./documents";
import { parseClauses } from "./templates";

// Runs at build time (the page is prerendered). documents.json, catalog.json and
// templates/ live in the repo root so the backend shares the same definitions.

const ROOT = path.join(process.cwd(), "..");

function readRepoFile(...parts: string[]): string {
  const file = path.join(ROOT, ...parts);
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`Could not read ${file}. Build the app from the frontend/ directory of a full repo checkout.`, {
      cause: error,
    });
  }
}

export function loadDocuments(): LegalDocument[] {
  const { documents } = JSON.parse(readRepoFile("documents.json")) as { documents: DocumentSpec[] };
  const { license } = JSON.parse(readRepoFile("catalog.json")) as { license: string };
  return documents.map((doc) => ({
    ...doc,
    clauses: parseClauses(readRepoFile("templates", doc.filename)),
    attribution: `Based on the Common Paper ${doc.title} standard terms, free to use under ${license}.`,
  }));
}
