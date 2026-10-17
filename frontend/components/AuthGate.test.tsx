import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth";
import { mockApi } from "@/test/mockApi";
import AuthGate from "./AuthGate";

const ada = { id: 1, name: "Ada Lovelace", email: "ada@example.com" };
const SIGNED_OUT = { status: 401, body: { detail: "Please sign in." } };

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={signOut}>
      Sign out
    </button>
  );
}

function renderApp() {
  return render(
    <AuthProvider>
      <AuthGate>
        <p>Protected content</p>
        <SignOutButton />
      </AuthGate>
    </AuthProvider>,
  );
}

async function fill(fields: Record<string, string>) {
  const user = userEvent.setup();
  for (const [label, value] of Object.entries(fields)) await user.type(await screen.findByLabelText(label), value);
  return user;
}

describe("AuthGate", () => {
  it("shows the app straight away for an existing session", async () => {
    mockApi({ "GET /api/auth/me": { body: ada } });
    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("signs in to an existing account", async () => {
    const api = mockApi({
      "GET /api/auth/me": SIGNED_OUT,
      "POST /api/auth/signin": { body: ada },
    });
    renderApp();

    const user = await fill({ Email: "ada@example.com", Password: "secret password" });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    const [, init] = api.mock.calls.find(([url]) => url === "/api/auth/signin")!;
    expect(JSON.parse(init!.body as string)).toEqual({ email: "ada@example.com", password: "secret password" });
  });

  it("shows the server's message when sign-in fails", async () => {
    mockApi({
      "GET /api/auth/me": SIGNED_OUT,
      "POST /api/auth/signin": { status: 401, body: { detail: "Incorrect email or password." } },
    });
    renderApp();

    const user = await fill({ Email: "ada@example.com", Password: "wrong" });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("creates an account", async () => {
    const api = mockApi({
      "GET /api/auth/me": SIGNED_OUT,
      "POST /api/auth/signup": { status: 201, body: ada },
    });
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    expect(screen.getByText(/drafts, not legal advice/)).toBeInTheDocument();
    const user = await fill({ "Full name": "Ada Lovelace", Email: "ada@example.com", Password: "long enough" });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    const [, init] = api.mock.calls.find(([url]) => url === "/api/auth/signup")!;
    expect(JSON.parse(init!.body as string)).toEqual({ name: "Ada Lovelace", email: "ada@example.com", password: "long enough" });
  });

  it("explains a duplicate account", async () => {
    mockApi({
      "GET /api/auth/me": SIGNED_OUT,
      "POST /api/auth/signup": { status: 409, body: { detail: "An account with this email already exists." } },
    });
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));

    const user = await fill({ "Full name": "Ada", Email: "ada@example.com", Password: "long enough" });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });

  it("signs out back to the sign-in screen", async () => {
    mockApi({ "GET /api/auth/me": { body: ada }, "POST /api/auth/signout": { status: 204 } });
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("reports when the server can't be reached", async () => {
    mockApi({ "GET /api/auth/me": { status: 500 } });
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
  });
});
