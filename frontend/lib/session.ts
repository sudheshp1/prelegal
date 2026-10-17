// The signed-in user, kept in localStorage. Sign-in is a placeholder for now
// (no passwords or server sessions), so this is all the "session" there is.

import { useMemo, useSyncExternalStore } from "react";
import type { User } from "./api";

const STORAGE_KEY = "prelegal.user";
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked, e.g. some private browsing modes
  }
}

function write(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore: the user simply won't stay signed in across reloads.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify); // keep other tabs in sync
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return typeof user?.id === "number" && typeof user?.name === "string" && typeof user?.email === "string"
      ? user
      : null;
  } catch {
    return null;
  }
}

export const saveUser = (user: User) => write(JSON.stringify(user));
export const clearUser = () => write(null);

/**
 * The signed-in user, null when signed out, or undefined while prerendering,
 * when the browser's storage is not yet known.
 */
export function useUser(): User | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parseUser(raw)), [raw]);
}
