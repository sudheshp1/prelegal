"use client";

import type { User } from "@/lib/api";
import Logo from "./Logo";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function AppHeader({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-full bg-brand-blue text-xs font-semibold text-white"
          >
            {initials(user.name)}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block font-medium text-brand-navy">{user.name}</span>
            <span className="block text-xs text-brand-muted">{user.email}</span>
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
