import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DocumentSummary } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { emptyDocument } from "@/lib/documents";
import { mockApi } from "@/test/mockApi";
import AppShell from "./AppShell";
import AuthGate from "./AuthGate";

const ada = { id: 1, name: "Ada Lovelace", email: "ada@example.com" };

const summary = (id: number, title: string, complete = false): DocumentSummary => ({
  id,
  title,
  companies: ["Acme", "Globex"],
  complete,
  updatedAt: "2026-10-17T10:00:00Z",
});

const saved = (id: number, title: string, lastMessage: string) => ({
  body: {
    ...summary(id, title),
    document: emptyDocument,
    messages: [
      { role: "user", content: "hello" },
      { role: "assistant", content: lastMessage },
    ],
  },
});

function renderShell() {
  render(
    <AuthProvider>
      <AuthGate>
        <AppShell documents={[]} />
      </AuthGate>
    </AuthProvider>,
  );
}

const sidebar = () => within(screen.getByRole("list", { name: "Your documents" }));
const sidebarLoaded = async () => within(await screen.findByRole("list", { name: "Your documents" }));
const deleteCalls = (api: ReturnType<typeof mockApi>) => api.mock.calls.filter(([, init]) => init?.method === "DELETE");

describe("AppShell", () => {
  it("shows the user and their saved documents", async () => {
    mockApi({
      "GET /api/auth/me": { body: ada },
      "GET /api/documents": { body: [summary(2, "Pilot Agreement", true), summary(1, "Untitled draft")] },
    });
    renderShell();

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect((await sidebarLoaded()).getByText("Pilot Agreement")).toBeInTheDocument();
    expect(sidebar().getByText("Ready")).toBeInTheDocument();
    expect(sidebar().getByText("In progress")).toBeInTheDocument();
    expect(sidebar().getAllByText("Acme · Globex")).toHaveLength(2);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("drafts, not legal advice");
  });

  it("explains the empty state", async () => {
    mockApi({ "GET /api/auth/me": { body: ada }, "GET /api/documents": { body: [] } });
    renderShell();

    expect(await screen.findByText(/No documents yet/)).toBeInTheDocument();
  });

  it("opens a saved document and starts a new one with the input focused", async () => {
    mockApi({
      "GET /api/auth/me": { body: ada },
      "GET /api/documents": { body: [summary(2, "Pilot Agreement")] },
      "GET /api/documents/2": saved(2, "Pilot Agreement", "What is the pilot period?"),
    });
    renderShell();

    await userEvent.click((await sidebarLoaded()).getByText("Pilot Agreement"));

    expect(await screen.findByText("What is the pilot period?")).toBeInTheDocument();
    expect(sidebar().getByRole("button", { name: /Pilot Agreement/, current: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "New document" }));

    expect(screen.queryByText("What is the pilot period?")).not.toBeInTheDocument();
    expect(sidebar().queryByRole("button", { current: true })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveFocus();
  });

  it("does not select a document whose reply arrives after the user moved on", async () => {
    let reply!: () => void;
    const handlers: Parameters<typeof mockApi>[0] = {
      "GET /api/auth/me": { body: ada },
      "GET /api/documents": { body: [] },
      "POST /api/chat": () =>
        new Promise((resolve) => {
          reply = () => resolve({ body: { documentId: 5, reply: "Hi", document: emptyDocument, complete: false } });
        }),
    };
    mockApi(handlers);
    renderShell();
    await screen.findByText(/No documents yet/);

    await userEvent.type(screen.getByLabelText("Message"), "An NDA please{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "New document" }));
    handlers["GET /api/documents"] = { body: [summary(5, "Untitled draft")] };
    reply();

    // The new document shows up in the list, but the fresh workspace stays unselected.
    expect((await screen.findByRole("list", { name: "Your documents" })).textContent).toContain("Untitled draft");
    expect(sidebar().queryByRole("button", { current: true })).not.toBeInTheDocument();
  });

  it("deletes a document after confirming in the dialog", async () => {
    const handlers: Parameters<typeof mockApi>[0] = {
      "GET /api/auth/me": { body: ada },
      "GET /api/documents": { body: [summary(2, "Pilot Agreement")] },
      "DELETE /api/documents/2": { status: 204 },
    };
    const api = mockApi(handlers);
    renderShell();

    await userEvent.click((await sidebarLoaded()).getByRole("button", { name: "Delete Pilot Agreement" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete document?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    handlers["GET /api/documents"] = { body: [] };
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/No documents yet/)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteCalls(api)).toHaveLength(1);
  });

  it.each([
    ["the Cancel button", () => userEvent.click(screen.getByRole("button", { name: "Cancel" }))],
    ["Escape", () => userEvent.keyboard("{Escape}")],
  ])("keeps the document when deletion is cancelled with %s", async (_, cancel) => {
    const api = mockApi({
      "GET /api/auth/me": { body: ada },
      "GET /api/documents": { body: [summary(2, "Pilot Agreement")] },
    });
    renderShell();

    await userEvent.click((await sidebarLoaded()).getByRole("button", { name: "Delete Pilot Agreement" }));
    await cancel();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(sidebar().getByText("Pilot Agreement")).toBeInTheDocument();
    expect(deleteCalls(api)).toHaveLength(0);
  });

  it("returns to sign-in when the session has expired", async () => {
    mockApi({
      "GET /api/auth/me": { body: ada },
      "GET /api/documents": { status: 401, body: { detail: "Please sign in." } },
    });
    renderShell();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });
});
