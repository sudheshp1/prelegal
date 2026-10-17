import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AuthGate from "./AuthGate";

const ada = { id: 1, name: "Ada Lovelace", email: "ada@example.com" };

function mockFetch(response: Partial<Response>) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, ...response } as Response);
}

function renderGate() {
  return render(
    <AuthGate>
      <p>Protected content</p>
    </AuthGate>,
  );
}

async function fillAndSubmit(name = "Ada Lovelace", email = "ada@example.com") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("AuthGate", () => {
  it("shows the login screen when signed out", () => {
    renderGate();

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("signs in through the API and shows the app", async () => {
    const fetchMock = mockFetch({ json: async () => ada });
    renderGate();

    await fillAndSubmit();

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signin",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" }) }),
    );
  });

  it("shows a validation message when the API rejects the details", async () => {
    mockFetch({ ok: false, status: 422 });
    renderGate();

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("valid email address");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows an error when the server cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    renderGate();

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server");
  });

  it("signs out back to the login screen", async () => {
    localStorage.setItem("prelegal.user", JSON.stringify(ada));
    renderGate();
    expect(screen.getByText("Protected content")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(screen.queryByText("Protected content")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(localStorage.getItem("prelegal.user")).toBeNull();
  });
});
