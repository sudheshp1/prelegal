import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyDocument, type DocumentData, type LegalDocument } from "@/lib/documents";
import { mockApi } from "@/test/mockApi";
import DocumentCreator, { GREETING } from "./DocumentCreator";

const pilot: LegalDocument = {
  id: "pilot-agreement",
  filename: "Pilot-Agreement.md",
  title: "Pilot Agreement",
  parties: ["Provider", "Customer"],
  fields: [
    { key: "pilotPeriod", label: "Pilot Period", description: "How long", required: true },
    { key: "fees", label: "Fees", description: "Any fees" },
  ],
  clauses: [{ depth: 0, number: "1.", body: [{ kind: "bold", text: "Pilot" }] }],
  attribution: "Based on Common Paper",
};

const pilotDocument = (values: Record<string, string> = {}): DocumentData => ({
  ...emptyDocument,
  documentType: "pilot-agreement",
  values: { pilotPeriod: "", fees: "", ...values },
});

const reply = (content: string, document: DocumentData = emptyDocument, complete = false, documentId = 7) => ({
  body: { documentId, reply: content, document, complete },
});

async function say(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Message"));
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

function renderCreator(initialDocumentId: number | null = null) {
  const onSaved = vi.fn();
  render(<DocumentCreator documents={[pilot]} initialDocumentId={initialDocumentId} onSaved={onSaved} />);
  return { onSaved };
}

const conversation = () => within(screen.getByRole("list", { name: "Conversation" }));

describe("DocumentCreator", () => {
  it("greets the user without calling the API and waits for a document choice", () => {
    const api = mockApi({});
    renderCreator();

    expect(conversation().getByText(GREETING.content)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText(/Your document will appear here/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Draft — subject to legal review");
  });

  it("starts a new document and keeps chatting in it", async () => {
    const requests: unknown[] = [];
    mockApi({
      "POST /api/chat": (body) => {
        requests.push(body);
        return requests.length === 1
          ? reply("Great, a Pilot Agreement. How long is the pilot?", pilotDocument())
          : reply("Thanks!", pilotDocument({ pilotPeriod: "90 days" }));
      },
    });
    const { onSaved } = renderCreator();

    await say("I want to run a pilot with a customer");
    expect(await conversation().findByText(/How long is the pilot/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pilot Agreement", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("[Pilot Period]")).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith(7);

    await say("90 days");
    expect(await conversation().findByText("Thanks!")).toBeInTheDocument();

    expect(requests).toEqual([
      { documentId: null, message: "I want to run a pilot with a customer" },
      { documentId: 7, message: "90 days" },
    ]);
  });

  it("reopens a saved document with its conversation", async () => {
    mockApi({
      "GET /api/documents/3": {
        body: {
          id: 3,
          title: "Pilot Agreement",
          companies: [],
          complete: true,
          updatedAt: "2026-10-17T10:00:00Z",
          document: pilotDocument({ pilotPeriod: "90 days" }),
          messages: [
            { role: "user", content: "A 90 day pilot" },
            { role: "assistant", content: "All done!" },
          ],
        },
      },
    });
    renderCreator(3);

    expect(screen.getByRole("status")).toHaveTextContent("Opening document");
    expect(await screen.findByText("All done!")).toBeInTheDocument();
    expect(conversation().getByText(GREETING.content)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByText("90 days", { selector: "dd" })).toBeInTheDocument();
  });

  it("explains when a saved document can't be opened", async () => {
    mockApi({ "GET /api/documents/3": { status: 404, body: { detail: "Document not found." } } });
    renderCreator(3);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't open this document");
  });

  it("offers the PDF once the document is complete", async () => {
    mockApi({ "POST /api/chat": reply("All done!", pilotDocument({ pilotPeriod: "90 days" }), true) });
    renderCreator();

    await say("90 days");

    expect(await screen.findByRole("button", { name: "Download PDF" })).toBeInTheDocument();
  });

  it("restores the message and shows an error when the AI is unavailable", async () => {
    mockApi({ "POST /api/chat": { status: 502, body: { detail: "The AI assistant is unavailable." } } });
    renderCreator();

    await say("An NDA please");

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't get a reply");
    expect(screen.getByLabelText("Message")).toHaveValue("An NDA please");
    expect(conversation().queryByText("An NDA please")).not.toBeInTheDocument();
  });

  it("locks the input while waiting for a reply", async () => {
    let respond!: () => void;
    mockApi({
      "POST /api/chat": () => new Promise((resolve) => (respond = () => resolve(reply("Thanks!")))),
    });
    renderCreator();

    await say("Acme");

    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(conversation().getByText("Thinking…")).toBeInTheDocument();

    respond();

    expect(await conversation().findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeEnabled();
    expect(screen.getByLabelText("Message")).toHaveFocus();
  });

  it("does not send blank messages", async () => {
    const api = mockApi({});
    renderCreator();

    await userEvent.type(screen.getByLabelText("Message"), "   {Enter}");

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(api).not.toHaveBeenCalled();
  });
});
