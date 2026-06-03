"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL, CampusAuthSession, clearAuthSession, readAuthSession } from "@/lib/auth-client";
import { getInitials } from "@/lib/app-data";

type AuthSessionControlProps = {
  compact?: boolean;
};

export function AuthSessionControl({ compact = false }: AuthSessionControlProps) {
  const router = useRouter();
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  async function handleLogout() {
    const token = session?.token;
    setIsLoggingOut(true);
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      clearAuthSession();
      setSession(null);
      setIsLoggingOut(false);
      router.push("/auth");
      router.refresh();
    }
  }

  if (!session) {
    return (
      <Link
        href="/auth"
        className="inline-flex items-center gap-2 rounded-full border border-outline-variant/70 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
      >
        <span className="material-symbols-outlined text-base">login</span>
        <span className={compact ? "hidden sm:inline" : ""}>Sign in</span>
      </Link>
    );
  }

  const profileSlug = session.user.username || session.user.user_id || session.user.id;

  return (
    <div className="flex items-center gap-2">
      <Link href={`/${profileSlug}`} className="flex min-w-0 items-center gap-2 rounded-full bg-surface-container-low py-1 pl-1 pr-3">
        <span
          aria-label={`${session.user.name} profile`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary-fixed text-xs font-bold text-primary"
        >
          {session.user.acronym || session.user.initials || getInitials(session.user.name)}
        </span>
        <span className={compact ? "hidden max-w-28 truncate text-sm font-semibold text-on-surface md:inline" : "max-w-32 truncate text-sm font-semibold text-on-surface"}>
          {session.user.name}
        </span>
      </Link>
      <button
        disabled={isLoggingOut}
        className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-secondary disabled:opacity-60"
        type="button"
        onClick={handleLogout}
      >
        <span className="material-symbols-outlined text-xl">logout</span>
      </button>
    </div>
  );
}

