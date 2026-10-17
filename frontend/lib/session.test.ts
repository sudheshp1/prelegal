import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { clearUser, parseUser, saveUser, useUser } from "./session";

const ada = { id: 1, name: "Ada Lovelace", email: "ada@example.com" };

describe("parseUser", () => {
  it("parses a stored user", () => {
    expect(parseUser(JSON.stringify(ada))).toEqual(ada);
  });

  it.each([null, "", "not json", "{}", JSON.stringify({ ...ada, id: "1" })])("rejects %j", (raw) => {
    expect(parseUser(raw)).toBeNull();
  });
});

describe("useUser", () => {
  it("is null when nobody has signed in", () => {
    const { result } = renderHook(() => useUser());
    expect(result.current).toBeNull();
  });

  it("updates when a user signs in and out", () => {
    const { result } = renderHook(() => useUser());

    act(() => saveUser(ada));
    expect(result.current).toEqual(ada);

    act(() => clearUser());
    expect(result.current).toBeNull();
  });

  it("restores the user saved by an earlier visit", () => {
    localStorage.setItem("prelegal.user", JSON.stringify(ada));
    const { result } = renderHook(() => useUser());
    expect(result.current).toEqual(ada);
  });
});
