"use client";

import { useState, useSyncExternalStore } from "react";
import { defaultNdaData, pdfFileName, todayIsoDate, type NdaData } from "@/lib/nda";
import type { StandardTerms } from "@/lib/standardTerms";
import NdaForm from "./NdaForm";
import NdaPreview from "./NdaPreview";

async function downloadPdf(data: NdaData, terms: StandardTerms) {
  // Load the PDF renderer only when needed; it is large and browser-only.
  const [{ pdf }, { default: NdaPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./NdaPdf"),
  ]);
  const blob = await pdf(<NdaPdf data={data} terms={terms} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFileName(data);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const subscribeToNothing = () => () => {};

export default function NdaCreator({ terms }: { terms: StandardTerms }) {
  const [formData, setFormData] = useState<NdaData>(defaultNdaData);
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");

  // The Effective Date defaults to today, as in the template. "Today" depends on the
  // user's time zone, so it is read on the client only (empty during prerendering).
  const today = useSyncExternalStore(subscribeToNothing, todayIsoDate, () => "");
  const data = formData.effectiveDate ? formData : { ...formData, effectiveDate: today };

  const handleDownload = async () => {
    setStatus("generating");
    try {
      await downloadPdf(data, terms);
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="details-heading" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="details-heading" className="sr-only">
          NDA details
        </h2>
        <NdaForm data={data} onChange={setFormData} />
      </section>

      <section aria-labelledby="preview-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="preview-heading" className="text-lg font-semibold text-slate-900">
            Preview
          </h2>
          <button
            type="button"
            onClick={handleDownload}
            disabled={status === "generating"}
            aria-busy={status === "generating"}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            {status === "generating" ? "Generating…" : "Download PDF"}
          </button>
        </div>
        {status === "error" && (
          <p role="alert" className="text-sm text-red-600">
            Sorry, the PDF could not be generated. Please try again.
          </p>
        )}
        <div className="max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <NdaPreview data={data} terms={terms} />
        </div>
      </section>
    </div>
  );
}
