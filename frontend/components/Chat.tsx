"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "@/lib/api";

type Props = {
  messages: ChatMessage[];
  pending: boolean;
  error: string;
  onSend: (text: string) => Promise<boolean>; // resolves false when the message was not sent
};

export default function Chat({ messages, pending, error, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view, and return focus to the input once the AI has replied.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    if (!pending) inputRef.current?.focus();
  }, [messages, pending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    if (!(await onSend(text))) setDraft(text); // restore it so the user can retry
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <ol ref={listRef} aria-label="Conversation" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <li key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                message.role === "user" ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-900"
              }`}
            >
              {message.content}
            </p>
          </li>
        ))}
        {pending && (
          <li className="flex justify-start">
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-brand-muted">Thinking…</p>
          </li>
        )}
      </ol>

      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={2}
          value={draft}
          disabled={pending}
          placeholder="Type your answer…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="self-end rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
