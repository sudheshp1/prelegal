"use client";

import type { DocumentSummary } from "@/lib/api";

type Props = {
  documents: DocumentSummary[] | undefined; // undefined while loading
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
};

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DocumentList({ documents, selectedId, onSelect, onDelete }: Props) {
  if (documents === undefined) return <p className="px-3 text-sm text-brand-muted">Loading documents…</p>;
  if (documents.length === 0) {
    return (
      <p className="px-3 text-sm leading-relaxed text-brand-muted">
        No documents yet. Start a chat and your drafts will be saved here automatically.
      </p>
    );
  }

  return (
    <ul aria-label="Your documents" className="space-y-1">
      {documents.map((doc) => {
        const selected = doc.id === selectedId;
        return (
          <li key={doc.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(doc.id)}
              aria-current={selected ? "true" : undefined}
              className={`w-full rounded-lg px-3 py-2.5 pr-9 text-left transition ${
                selected ? "bg-brand-blue/10 ring-1 ring-brand-blue/30" : "hover:bg-slate-100"
              }`}
            >
              <span className="block truncate text-sm font-medium text-brand-navy">{doc.title}</span>
              <span className="block truncate text-xs text-brand-muted">
                {doc.companies.length ? doc.companies.join(" · ") : "Parties not set"}
              </span>
              <span className="mt-1 flex items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    doc.complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {doc.complete ? "Ready" : "In progress"}
                </span>
                <span className="text-slate-500">{formatUpdated(doc.updatedAt)}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Delete ${doc.title}`}
              onClick={() => onDelete(doc.id)}
              className="absolute right-2 top-2 rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M7 3h6l1 2h3v2H3V5h3l1-2Zm-2 6h10l-1 8H6L5 9Z" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
