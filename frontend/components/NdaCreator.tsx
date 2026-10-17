"use client";

import { useState } from "react";
import { sendChat, type ChatMessage } from "@/lib/api";
import { defaultNdaData, pdfFileName, type NdaData } from "@/lib/nda";
import type { StandardTerms } from "@/lib/standardTerms";
import NdaChat from "./NdaChat";
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

// Only recent messages are sent: the current fields carry everything gathered so far,
// and this keeps long chats within the backend's request limits.
export const MAX_HISTORY = 40;

// Shown locally so opening the page doesn't cost an AI call.
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you draft a Mutual Non-Disclosure Agreement. To start, which two companies are entering into the NDA?",
};

export default function NdaCreator({ terms }: { terms: StandardTerms }) {
  const [data, setData] = useState<NdaData>(defaultNdaData);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "error">("idle");

  const handleSend = async (text: string) => {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setPending(true);
    setChatError("");
    try {
      const response = await sendChat(history.slice(-MAX_HISTORY), data);
      setMessages([...history, { role: "assistant", content: response.reply }]);
      setData(response.nda);
      setComplete(response.complete);
      return true;
    } catch (error) {
      console.error(error);
      setMessages(messages); // drop the unanswered message; NdaChat puts it back in the input
      setChatError("Sorry, I couldn't get a reply. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const handleDownload = async () => {
    setPdfStatus("generating");
    try {
      await downloadPdf(data, terms);
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
        <NdaChat messages={messages} pending={pending} error={chatError} onSend={handleSend} />
      </section>

      <section aria-labelledby="preview-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="preview-heading" className="text-lg font-semibold text-slate-900">
            Preview
          </h2>
          {complete ? (
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
            <p className="text-sm text-brand-gray">Download is available once all details are gathered.</p>
          )}
        </div>
        {pdfStatus === "error" && (
          <p role="alert" className="text-sm text-red-600">
            Sorry, the PDF could not be generated. Please try again.
          </p>
        )}
        <div className="max-h-[75vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <NdaPreview data={data} terms={terms} />
        </div>
      </section>
    </div>
  );
}
