"use client";

import type { User } from "@/lib/api";
import { clearUser } from "@/lib/session";

export default function AppHeader({ user }: { user: User }) {
  return (
    <header className="border-b-4 border-brand-yellow bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <span className="text-xl font-bold text-brand-navy">Prelegal</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-brand-gray sm:inline">
            Signed in as <span className="font-medium text-brand-navy">{user.name}</span>
          </span>
          <button type="button" onClick={clearUser} className="font-semibold text-brand-blue hover:underline">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
