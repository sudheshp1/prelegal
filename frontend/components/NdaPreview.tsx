import {
  COVER_PAGE_INTRO,
  SIGNING_STATEMENT,
  coverPageSections,
  partyRows,
  type NdaData,
} from "@/lib/nda";
import type { Segment, StandardTerms } from "@/lib/standardTerms";

type Props = { data: NdaData; terms: StandardTerms };

function SegmentText({ segment }: { segment: Segment }) {
  if (segment.kind === "bold") return <strong>{segment.text}</strong>;
  if (segment.kind === "ref") return <span className="underline decoration-dotted">{segment.text}</span>;
  return <>{segment.text}</>;
}

export default function NdaPreview({ data, terms }: Props) {
  return (
    <article className="space-y-6 font-serif text-[13px] leading-relaxed text-slate-900">
      <h3 className="text-center text-xl font-bold">Mutual Non-Disclosure Agreement</h3>
      <p>{COVER_PAGE_INTRO}</p>

      <dl className="space-y-3">
        {coverPageSections(data).map(({ heading, value }) => (
          <div key={heading}>
            <dt className="font-bold">{heading}</dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>

      <p>{SIGNING_STATEMENT}</p>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="w-1/4 border border-slate-300 p-2" />
            <th className="border border-slate-300 p-2 text-center">PARTY 1</th>
            <th className="border border-slate-300 p-2 text-center">PARTY 2</th>
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
      <ol className="space-y-3">
        {terms.clauses.map((clause) => (
          <li key={clause.number}>
            {clause.number}. <strong>{clause.title}</strong>.{" "}
            {clause.body.map((segment, i) => (
              <SegmentText key={i} segment={segment} />
            ))}
          </li>
        ))}
      </ol>

      <p className="text-xs text-slate-500">{terms.attribution}</p>
    </article>
  );
}
