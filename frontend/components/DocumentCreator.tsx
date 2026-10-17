"use client";

import { useState } from "react";
import { sendChat, type ChatMessage } from "@/lib/api";
import { emptyDocument, pdfFileName, type DocumentData, type LegalDocument } from "@/lib/documents";
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

// Only recent messages are sent: the current document carries everything gathered so far,
// and this keeps long chats within the backend's request limits.
export const MAX_HISTORY = 40;

// Shown locally so opening the page doesn't cost an AI call.
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I can help you draft common legal agreements, such as NDAs, cloud service, pilot, data processing and software license agreements. What would you like to create?",
};

export default function DocumentCreator({ documents }: { documents: LegalDocument[] }) {
  const [data, setData] = useState<DocumentData>(emptyDocument);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "error">("idle");

  const doc = documents.find((d) => d.id === data.documentType);

  const handleSend = async (text: string) => {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setPending(true);
    setChatError("");
    try {
      const response = await sendChat(history.slice(-MAX_HISTORY), data);
      setMessages([...history, { role: "assistant", content: response.reply }]);
      setData(response.document);
      setComplete(response.complete);
      return true;
    } catch (error) {
      console.error(error);
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

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="chat-heading" className="space-y-4">
        <h2 id="chat-heading" className="text-lg font-semibold text-slate-900">
          Chat
        </h2>
        <Chat messages={messages} pending={pending} error={chatError} onSend={handleSend} />
      </section>

      <section aria-labelledby="preview-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="preview-heading" className="text-lg font-semibold text-slate-900">
            {doc ? doc.title : "Preview"}
          </h2>
          {doc && complete ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={pdfStatus === "generating"}
              aria-busy={pdfStatus === "generating"}
              className="rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pdfStatus === "generating" ? "Generating…" : "Download PDF"}
            </button>
          ) : (
            doc && <p className="text-sm text-brand-gray">Download is available once all details are gathered.</p>
          )}
        </div>
        {pdfStatus === "error" && (
          <p role="alert" className="text-sm text-red-600">
            Sorry, the PDF could not be generated. Please try again.
          </p>
        )}
        <div className="max-h-[75vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {doc ? (
            <DocumentPreview doc={doc} data={data} />
          ) : (
            <p className="py-24 text-center text-sm text-brand-gray">
              Your document will appear here once you and the assistant have chosen what to draft.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
