import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultNdaData, type NdaData } from "@/lib/nda";
import type { StandardTerms } from "@/lib/standardTerms";
import NdaCreator, { GREETING, MAX_HISTORY } from "./NdaCreator";

const terms: StandardTerms = { clauses: [], attribution: "" };

function reply(content: string, nda: Partial<NdaData>, complete = false) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ reply: content, nda: { ...defaultNdaData, ...nda }, complete }),
  } as Response);
}

async function say(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Message"), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

const conversation = () => within(screen.getByRole("list", { name: "Conversation" }));

describe("NdaCreator", () => {
  it("greets the user without calling the API", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<NdaCreator terms={terms} />);

    expect(conversation().getByText(GREETING.content)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
  });

  it("sends the conversation and fields, then shows the reply and updates the preview", async () => {
    const fetchMock = reply("Great, which state's law applies?", { governingLaw: "Delaware" });
    render(<NdaCreator terms={terms} />);

    await say("Acme and Globex");

    expect(await conversation().findByText("Great, which state's law applies?")).toBeInTheDocument();
    expect(conversation().getByText("Acme and Globex")).toBeInTheDocument();
    expect(screen.getAllByText("Delaware").length).toBeGreaterThan(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.messages).toEqual([GREETING, { role: "user", content: "Acme and Globex" }]);
    expect(body.nda).toEqual(defaultNdaData);
  });

  it("offers the PDF download once the document is complete", async () => {
    reply("All done! You can download your NDA.", { governingLaw: "Delaware" }, true);
    render(<NdaCreator terms={terms} />);

    await say("Delaware");

    expect(await screen.findByRole("button", { name: "Download PDF" })).toBeInTheDocument();
  });

  it("restores the message and shows an error when the AI is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false, status: 502 } as Response);
    render(<NdaCreator terms={terms} />);

    await say("Acme and Globex");

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't get a reply");
    expect(screen.getByLabelText("Message")).toHaveValue("Acme and Globex");
    expect(conversation().queryByText("Acme and Globex")).not.toBeInTheDocument();
  });

  it("sends on Enter and focuses the input after the reply", async () => {
    reply("Thanks!", {});
    render(<NdaCreator terms={terms} />);

    await userEvent.type(screen.getByLabelText("Message"), "Acme{Enter}");

    expect(await conversation().findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.getByLabelText("Message")).toHaveFocus();
  });

  it("locks the input while waiting for a reply", async () => {
    let respond!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));
    render(<NdaCreator terms={terms} />);

    await say("Acme");

    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(conversation().getByText("Thinking…")).toBeInTheDocument();

    respond({ ok: true, status: 200, json: async () => ({ reply: "Thanks!", nda: defaultNdaData, complete: false }) } as Response);

    expect(await conversation().findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeEnabled();
  });

  it("sends only the most recent messages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<NdaCreator terms={terms} />);

    for (let turn = 1; turn <= MAX_HISTORY / 2 + 1; turn++) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ reply: `Reply ${turn}`, nda: defaultNdaData, complete: false }),
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
    render(<NdaCreator terms={terms} />);

    await userEvent.type(screen.getByLabelText("Message"), "   {Enter}");

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
