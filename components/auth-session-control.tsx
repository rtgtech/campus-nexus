"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { API_BASE_URL, CampusAuthSession, authFetch, clearAuthSession, readAuthSession } from "@/lib/auth-client";
import { getInitials } from "@/lib/app-data";
import { cn } from "@/lib/utils";

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
    setIsLoggingOut(true);
    try {
      if (session) {
        await authFetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
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
        className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-4 text-on-surface-variant hover:text-primary")}
      >
        <span className="material-symbols-outlined text-base">login</span>
        <span className={compact ? "hidden sm:inline" : ""}>Sign in</span>
      </Link>
    );
  }

  const profileSlug = session.user.username || session.user.userId;

  return (
    <div className="flex items-center gap-2">
      <Link href={`/${profileSlug}`} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-auto min-w-0 rounded-full bg-surface-container-low py-1 pl-1 pr-3")}>
        <Avatar
          aria-label={`${session.user.name} profile`}
          className="size-9 border-2 border-primary bg-primary-fixed text-xs font-bold text-primary"
        >
          <AvatarFallback className="bg-transparent text-inherit">
            {session.user.initials || getInitials(session.user.name)}
          </AvatarFallback>
        </Avatar>
        <span className={compact ? "hidden max-w-28 truncate text-sm font-semibold text-on-surface md:inline" : "max-w-32 truncate text-sm font-semibold text-on-surface"}>
          {session.user.name}
        </span>
      </Link>
      <Button
        aria-label="Sign out"
        disabled={isLoggingOut}
        className="rounded-full text-on-surface-variant hover:text-secondary"
        size="icon"
        type="button"
        variant="ghost"
        onClick={handleLogout}
      >
        <span className="material-symbols-outlined text-xl">logout</span>
      </Button>
    </div>
  );
}

