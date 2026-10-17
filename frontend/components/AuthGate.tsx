"use client";

import type { ReactNode } from "react";
import { useUser } from "@/lib/session";
import AppHeader from "./AppHeader";
import LoginScreen from "./LoginScreen";

/** Shows the login screen until a user has signed in, then the app with its header. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const user = useUser();

  // Unknown until the browser's storage is read; render nothing rather than flash the login screen.
  if (user === undefined) return null;
  if (user === null) return <LoginScreen />;

  return (
    <>
      <AppHeader user={user} />
      {children}
    </>
  );
}
