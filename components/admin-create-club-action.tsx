"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAdminUser, readAuthSession } from "@/lib/auth-client";

type AdminCreateClubActionProps = {
  variant?: "button" | "floating";
};

export function AdminCreateClubAction({ variant = "button" }: AdminCreateClubActionProps) {
  const [canCreateClub, setCanCreateClub] = useState(false);

  useEffect(() => {
    const session = readAuthSession();
    setCanCreateClub(isAdminUser(session?.user));
  }, []);

  if (!canCreateClub) {
    return null;
  }

  if (variant === "floating") {
    return (
      <Link href="/clubs?mode=createclub" className="group fixed bottom-24 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-2xl transition-all hover:scale-110 active:scale-90">
        <span className="material-symbols-outlined text-3xl">group_add</span>
        <span className="absolute right-full mr-4 whitespace-nowrap rounded-2xl bg-primary px-4 py-2 text-sm font-label-md text-white opacity-0 transition-opacity group-hover:opacity-100">
          Create Club
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/clubs?mode=createclub"
      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
    >
      <span className="material-symbols-outlined text-base">group_add</span>
      Create club
    </Link>
  );
}
