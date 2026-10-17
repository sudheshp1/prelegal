"use client";

import { useEffect, useState } from "react";
import { getDocument, sendChat, type ChatMessage } from "@/lib/api";
import { DISCLAIMER, emptyDocument, pdfFileName, type DocumentData, type LegalDocument } from "@/lib/documents";
import Chat from "./Chat";
import DocumentPreview from "./DocumentPreview";

async function downloadPdf(doc: LegalDocument, data: DocumentData) {
  // Load the PDF renderer only when needed; it is large and browser-only.
  const [{ pdf }, { default: DocumentPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./DocumentPdf"),
  ]);
  const blob = await pdf(<DocumentPdf doc={doc} data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFileName(doc, data);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Shown locally (and not saved) so opening a new document doesn't cost an AI call.
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I can help you draft common legal agreements, such as NDAs, cloud service, pilot, data processing and software license agreements. What would you like to create?",
};

type Props = {
  documents: LegalDocument[];
  initialDocumentId: number | null; // null starts a new document
  onSaved: (documentId: number) => void;
};

export default function DocumentCreator({ documents, initialDocumentId, onSaved }: Props) {
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [loading, setLoading] = useState(initialDocumentId !== null);
  const [loadError, setLoadError] = useState("");
  const [data, setData] = useState<DocumentData>(emptyDocument);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "error">("idle");

  useEffect(() => {
    if (initialDocumentId === null) return;
    getDocument(initialDocumentId).then(
      (saved) => {
        setData(saved.document);
        setMessages(saved.messages);
        setComplete(saved.complete);
        setLoading(false);
      },
      () => {
        setLoadError("Couldn't open this document. It may have been deleted.");
        setLoading(false);
      },
    );
  }, [initialDocumentId]);

  const doc = documents.find((d) => d.id === data.documentType);

  const handleSend = async (text: string) => {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setPending(true);
    setChatError("");
    try {
      const response = await sendChat(documentId, text);
      setDocumentId(response.documentId);
      setMessages([...history, { role: "assistant", content: response.reply }]);
      setData(response.document);
      setComplete(response.complete);
      onSaved(response.documentId);
      return true;
    } catch {
      setMessages(messages); // drop the unanswered message; Chat puts it back in the input
      setChatError("Sorry, I couldn't get a reply. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const handleDownload = async () => {
    if (!doc) return;
    setPdfStatus("generating");
    try {
      await downloadPdf(doc, data);
      setPdfStatus("idle");
    } catch (error) {
      console.error(error);
      setPdfStatus("error");
    }
  };

  if (loading || loadError) {
    return (
      <p role={loadError ? "alert" : "status"} className="py-24 text-center text-sm text-brand-muted">
        {loadError || "Opening document…"}
      </p>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="chat-heading" className="space-y-3">
        <h2 id="chat-heading" className="text-lg font-semibold text-brand-navy">
          Assistant
        </h2>
        <Chat messages={[GREETING, ...messages]} pending={pending} error={chatError} onSend={handleSend} />
      </section>

      <section aria-labelledby="preview-heading" className="space-y-3">
        <div className="flex min-h-9 items-center justify-between gap-4">
          <h2 id="preview-heading" className="text-lg font-semibold text-brand-navy">
            {doc ? doc.title : "Preview"}
          </h2>
          {doc && complete ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={pdfStatus === "generating"}
              aria-busy={pdfStatus === "generating"}
              className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {pdfStatus === "generating" ? "Generating…" : "Download PDF"}
            </button>
          ) : (
            doc && <p className="text-sm text-brand-muted">Download is available once all details are gathered.</p>
          )}
        </div>
        {pdfStatus === "error" && (
          <p role="alert" className="text-sm text-red-600">
            Sorry, the PDF could not be generated. Please try again.
          </p>
        )}
        <p role="note" className="flex gap-2 rounded-lg border border-brand-yellow/40 bg-brand-yellow/10 px-3 py-2 text-xs text-slate-700">
          <span aria-hidden className="font-bold text-brand-yellow">!</span>
          <span>
            <strong>Draft — subject to legal review.</strong> {DISCLAIMER}
          </span>
        </p>
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {doc ? (
            <DocumentPreview doc={doc} data={data} />
          ) : (
            <p className="py-24 text-center text-sm text-brand-muted">
              Your document will appear here once you and the assistant have chosen what to draft.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
