"use client";

import Link from "next/link";
import { useState } from "react";

export function DismissibleCampusPulse() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[32px] border border-outline-variant/60 bg-primary p-6 text-white shadow-[0_24px_60px_rgba(34,29,92,0.24)] md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/75">Campus Pulse</p>
          <h1 className="mt-3 max-w-2xl font-['Space_Grotesk'] text-4xl font-bold tracking-tight md:text-5xl">
            One feed for campus spaces, student clubs, matches, and city life.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/85 md:text-base">
            Track hackathons, college fest lineups, league tables, and the student communities building across campus.
          </p>
        </div>
        <button
          aria-label="Close Campus Pulse"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/16 hover:text-white"
          onClick={() => setIsVisible(false)}
          type="button"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/?=createpost"
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-primary transition hover:scale-[1.02]"
        >
          Share Update
        </Link>
        <Link
          href="/clubs"
          className="rounded-full border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Explore Clubs
        </Link>
      </div>
    </div>
  );
}
