import {
  coverPageSections,
  introText,
  partyRows,
  signingStatement,
  type DocumentData,
  type LegalDocument,
} from "@/lib/documents";
import type { Segment } from "@/lib/templates";

type Props = { doc: LegalDocument; data: DocumentData };

function SegmentText({ segment }: { segment: Segment }) {
  if (segment.kind === "bold") return <strong>{segment.text}</strong>;
  if (segment.kind === "ref") return <span className="underline decoration-dotted">{segment.text}</span>;
  return <>{segment.text}</>;
}

export default function DocumentPreview({ doc, data }: Props) {
  return (
    <article className="space-y-6 font-serif text-[13px] leading-relaxed text-slate-900">
      <h3 className="text-center text-xl font-bold">{doc.title}</h3>
      <p>{introText(doc)}</p>

      <dl className="space-y-3">
        {coverPageSections(doc, data).map(({ heading, value }) => (
          <div key={heading}>
            <dt className="font-bold">{heading}</dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>

      <p>{signingStatement(doc)}</p>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="w-1/4 border border-slate-300 p-2" />
            {doc.parties.map((role) => (
              <th key={role} className="border border-slate-300 p-2 text-center uppercase">
                {role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {partyRows(data).map(({ label, values }) => (
            <tr key={label}>
              <th className="border border-slate-300 p-2 font-semibold">{label}</th>
              {values.map((value, i) => (
                <td key={i} className="h-9 border border-slate-300 p-2">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="pt-4 text-center text-lg font-bold">Standard Terms</h3>
      <div className="space-y-3">
        {doc.clauses.map((clause, index) => (
          <p key={index} style={{ marginLeft: `${clause.depth * 1.25}rem` }}>
            {clause.number}{" "}
            {clause.body.map((segment, i) => (
              <SegmentText key={i} segment={segment} />
            ))}
          </p>
        ))}
      </div>

      <p className="text-xs text-slate-500">{doc.attribution}</p>
    </article>
  );
}
