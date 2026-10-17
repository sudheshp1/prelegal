"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DISCLAIMER } from "@/lib/documents";
import Logo from "./Logo";

type Mode = "signIn" | "signUp";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

const FEATURES = [
  "11 Common Paper standard agreements, from NDAs to DPAs",
  "An AI assistant that guides you through every key term",
  "Live preview and PDF export, saved to your account",
];

function Field({ id, label, ...input }: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={id} required className={inputClass} {...input} />
    </div>
  );
}

export default function AuthScreen() {
  const { signIn, signUp, error: sessionError } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (mode === "signUp") await signUp(name, email, password);
      else await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 422
          ? err.message
          : mode === "signUp"
            ? "Please enter your name, a valid email and a password of at least 8 characters."
            : "Please enter a valid email and your password.",
      );
      setSubmitting(false);
    }
  };

  const isSignUp = mode === "signUp";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-12 text-white lg:flex">
        <Logo inverted />
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Draft legal agreements <span className="text-brand-yellow">in minutes</span>, not days.
          </h1>
          <p className="max-w-md text-lg text-slate-300">
            Tell our assistant what you need. Prelegal fills in a market-standard agreement as you chat.
          </p>
          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-slate-200">
                <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-yellow" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">Based on Common Paper standard agreements (CC BY 4.0).</p>
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-blue/20" />
      </aside>

      <main className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-brand-navy">{isSignUp ? "Create your account" : "Welcome back"}</h2>
            <p className="text-sm text-brand-muted">
              {isSignUp ? "Start drafting agreements in a few minutes." : "Sign in to continue drafting your agreements."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label={isSignUp ? "Create account" : "Sign in"}>
            {isSignUp && (
              <Field id="auth-name" label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <Field
              id="auth-email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              id="auth-password"
              label="Password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? 8 : undefined}
              aria-describedby={isSignUp ? "auth-password-hint" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isSignUp && (
              <p id="auth-password-hint" className="text-xs text-brand-muted">
                At least 8 characters.
              </p>
            )}

            {(error || sessionError) && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error || sessionError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="w-full rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600">
            {isSignUp ? "Already have an account?" : "New to Prelegal?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isSignUp ? "signIn" : "signUp")}
              className="font-semibold text-brand-blue hover:underline"
            >
              {isSignUp ? "Sign in instead" : "Create an account"}
            </button>
          </p>

          {isSignUp && <p className="text-xs leading-relaxed text-brand-muted">{DISCLAIMER}</p>}
        </div>
      </main>
    </div>
  );
}
