import { describe, expect, it } from "vitest";
import { loadDocuments } from "./loadDocuments";
import { parseClauses } from "./templates";

describe("parseClauses", () => {
  it("parses flat clauses with bold titles and cover page references", () => {
    const [clause] = parseClauses(
      '# Standard Terms\n\n1. **Introduction**. Use for the <span class="coverpage_link">Purpose</span> only.',
    );

    expect(clause).toEqual({
      depth: 0,
      number: "1.",
      body: [
        { kind: "bold", text: "Introduction" },
        { kind: "text", text: ". Use for the " },
        { kind: "ref", text: "Purpose" },
        { kind: "text", text: " only." },
      ],
    });
  });

  it("numbers nested clauses and lettered or roman sub-items", () => {
    const clauses = parseClauses(
      [
        '1. <span class="header_2" id="1">Service</span>',
        '    1. <span class="header_3" id="1.1">Access.</span>  Text.',
        "    2. Second.",
        "        a. Letter.",
        "            i. Roman.",
        "2. Next",
        "    1. Again.",
      ].join("\n"),
    );

    expect(clauses.map((c) => [c.depth, c.number])).toEqual([
      [0, "1."],
      [1, "1.1"],
      [1, "1.2"],
      [2, "(a)"],
      [3, "(i)"],
      [0, "2."],
      [1, "2.1"],
    ]);
    expect(clauses[0].body).toEqual([{ kind: "bold", text: "Service" }]);
    expect(clauses[1].body[0]).toEqual({ kind: "bold", text: "Access." });
  });

  it("strips id-only spans and markdown links", () => {
    const [clause] = parseClauses(
      '    6. <span id="4.6">**"SLA Terms"**</span> are posted at <https://example.com/sla> and [here](https://x.y).',
    );

    expect(clause.body).toEqual([
      { kind: "bold", text: '"SLA Terms"' },
      { kind: "text", text: " are posted at https://example.com/sla and here." },
    ]);
  });

  it("keeps references inside bold passages", () => {
    const [clause] = parseClauses(
      '1. **Liability is capped at the <span class="keyterms_link">General Cap Amount</span>.**',
    );

    expect(clause.body).toEqual([
      { kind: "bold", text: "Liability is capped at the " },
      { kind: "ref", text: "General Cap Amount" },
      { kind: "bold", text: "." },
    ]);
  });

  it("skips headings and unnumbered lines", () => {
    expect(parseClauses("# Title\n\nCommon Paper attribution [CC BY 4.0](https://x).")).toEqual([]);
  });
});

describe("loadDocuments", () => {
  const documents = loadDocuments();

  it("loads all supported documents with their standard terms", () => {
    expect(documents).toHaveLength(11);
    for (const doc of documents) {
      expect(doc.clauses.length, doc.id).toBeGreaterThan(3);
      expect(doc.attribution).toContain("CC BY 4.0");
    }
  });

  it("leaves no raw markup in any template", () => {
    for (const doc of documents) {
      for (const clause of doc.clauses) {
        const text = clause.body.map((s) => s.text).join("");
        expect(text, `${doc.id} ${clause.number}`).not.toMatch(/<\/?span|\*\*|\]\(/);
      }
    }
  });
});
