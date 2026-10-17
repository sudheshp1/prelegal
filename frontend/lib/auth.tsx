"use client";

// The signed-in user, from the server session (an HttpOnly cookie the page can't read).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "./api";
import type { User } from "./api";

type AuthState = {
  /** undefined while the session is being checked, null when signed out. */
  user: User | null | undefined;
  /** Set when the session check itself failed, e.g. the server is unreachable. */
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    api.setUnauthorizedHandler(() => setUser(null));
    api.getCurrentUser().then(setUser, () => {
      setError("Prelegal is unavailable right now. Please refresh to try again.");
      setUser(null);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.signIn(email, password));
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setUser(await api.signUp(name, email, password));
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut().catch(() => {}); // the session is gone locally either way
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, error, signIn, signUp, signOut }), [user, error, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
