"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import AuthScreen from "./AuthScreen";

/** Shows the sign-in screen until the server confirms a session, then the app. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <div role="status" className="grid min-h-screen place-items-center text-sm text-brand-muted">
        <span className="flex items-center gap-3">
          <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-blue" />
          Loading…
        </span>
      </div>
    );
  }
  return user ? children : <AuthScreen />;
}
