import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyDocument, type DocumentData, type LegalDocument } from "@/lib/documents";
import DocumentCreator, { GREETING, MAX_HISTORY } from "./DocumentCreator";

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

function reply(content: string, document: DocumentData = emptyDocument, complete = false) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ reply: content, document, complete }),
  } as Response);
}

async function say(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Message"));
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

const renderCreator = () => render(<DocumentCreator documents={[pilot]} />);
const conversation = () => within(screen.getByRole("list", { name: "Conversation" }));

describe("DocumentCreator", () => {
  it("greets the user without calling the API and waits for a document choice", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderCreator();

    expect(conversation().getByText(GREETING.content)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Your document will appear here/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
  });

  it("shows the chosen document's preview once the AI picks a type", async () => {
    const fetchMock = reply("Great, a Pilot Agreement. How long is the pilot?", pilotDocument());
    renderCreator();

    await say("I want to run a pilot with a customer");

    expect(await conversation().findByText(/How long is the pilot/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pilot Agreement", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("[Pilot Period]")).toBeInTheDocument();
    expect(screen.getByText(/Download is available once/)).toBeInTheDocument();

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.messages).toEqual([GREETING, { role: "user", content: "I want to run a pilot with a customer" }]);
    expect(body.document).toEqual(emptyDocument);
  });

  it("updates the preview and offers the PDF once complete", async () => {
    reply("All done! You can download it.", pilotDocument({ pilotPeriod: "90 days" }), true);
    renderCreator();

    await say("90 days");

    expect(await screen.findByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByText("90 days", { selector: "dd" })).toBeInTheDocument();
  });

  it("restores the message and shows an error when the AI is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false, status: 502 } as Response);
    renderCreator();

    await say("An NDA please");

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't get a reply");
    expect(screen.getByLabelText("Message")).toHaveValue("An NDA please");
    expect(conversation().queryByText("An NDA please")).not.toBeInTheDocument();
  });

  it("sends on Enter and focuses the input after the reply", async () => {
    reply("Thanks!");
    renderCreator();

    await userEvent.type(screen.getByLabelText("Message"), "Acme{Enter}");

    expect(await conversation().findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.getByLabelText("Message")).toHaveFocus();
  });

  it("locks the input while waiting for a reply", async () => {
    let respond!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));
    renderCreator();

    await say("Acme");

    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(conversation().getByText("Thinking…")).toBeInTheDocument();

    respond({ ok: true, status: 200, json: async () => ({ reply: "Thanks!", document: emptyDocument, complete: false }) } as Response);

    expect(await conversation().findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeEnabled();
  });

  it("sends only the most recent messages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderCreator();

    for (let turn = 1; turn <= MAX_HISTORY / 2 + 1; turn++) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ reply: `Reply ${turn}`, document: emptyDocument, complete: false }),
      } as Response);
      await say(`Message ${turn}`);
      await conversation().findByText(`Reply ${turn}`);
    }

    const lastBody = JSON.parse(fetchMock.mock.lastCall![1]!.body as string);
    expect(lastBody.messages).toHaveLength(MAX_HISTORY);
    expect(lastBody.messages.at(-1)).toEqual({ role: "user", content: `Message ${MAX_HISTORY / 2 + 1}` });
  });

  it("does not send blank messages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderCreator();

    await userEvent.type(screen.getByLabelText("Message"), "   {Enter}");

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
