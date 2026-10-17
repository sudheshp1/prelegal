// Parses the Common Paper standard terms in templates/*.md into numbered clauses.
// The templates are nested numbered lists (4 spaces per level) using bold text,
// header spans for clause titles and *_link spans for references to cover-page terms.

/** A run of clause text: plain, bold (a title or defined term) or a Cover Page reference. */
export type Segment = { kind: "text" | "bold" | "ref"; text: string };

export type Clause = { depth: number; number: string; body: Segment[] };

const LINE_PATTERN = /^( *)(\d+|[a-z]+)\.\s+(.*)$/;
const ID_SPAN_PATTERN = /<span id="[^"]*">(.*?)<\/span>/g;
const LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)|<(https?:\/\/[^>]+)>/g;
const INLINE_PATTERN = /\*\*(.+?)\*\*|<span class="header_\d"[^>]*>(.+?)<\/span>|<span class="\w+_link"[^>]*>(.+?)<\/span>/g;
const INDENT = 4;

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > last) segments.push({ kind: "text", text: text.slice(last, match.index) });
    const [, bold, header, ref] = match;
    if (ref) segments.push({ kind: "ref", text: ref });
    else if (header) segments.push({ kind: "bold", text: header });
    // Bold passages can contain references, e.g. the liability caps.
    else segments.push(...parseInline(bold).map((s): Segment => (s.kind === "text" ? { ...s, kind: "bold" } : s)));
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

function parseSegments(text: string): Segment[] {
  return parseInline(text.replace(ID_SPAN_PATTERN, "$1").replace(LINK_PATTERN, (_, label, url) => label ?? url));
}

/**
 * Numbers clauses the way the agreements cite them: 1., 1.1, then (a) and (i)
 * for lettered and roman sub-items. Headings and unnumbered lines (such as the
 * NDA's attribution) are skipped; attribution is generated from the catalog.
 */
export function parseClauses(markdown: string): Clause[] {
  const clauses: Clause[] = [];
  const path: number[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(LINE_PATTERN);
    if (!match) continue;
    const [, indent, marker, text] = match;
    const depth = Math.floor(indent.length / INDENT);
    let number: string;
    if (/^\d+$/.test(marker)) {
      path.length = depth;
      path[depth] = Number(marker);
      number = depth === 0 ? `${marker}.` : path.join(".");
    } else {
      number = `(${marker})`;
    }
    clauses.push({ depth, number, body: parseSegments(text) });
  }
  return clauses;
}
