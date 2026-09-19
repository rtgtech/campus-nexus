"use client";

import { CampusIcon } from "@/components/campus-icon";


import Link from "next/link";
import { useMemo, useState } from "react";
import { ClubFollowButton } from "@/components/club-follow-button";
import { getInitials, type ClubCard } from "@/lib/app-data";
import { cn } from "@/lib/utils";

type ClubCatalogProps = {
  clubs: ClubCard[];
};

const categories = ["Tech", "Cultural", "Sports", "Literary", "Social Impact"];

function memberCount(club: ClubCard) {
  return club.memberCount ?? club.membersCount;
}

function statusDotClass(status: string) {
  const normalizedStatus = status.trim().toLowerCase();
  if (normalizedStatus.includes("recruit")) {
    return "animate-pulse bg-secondary";
  }
  if (["active", "open"].some((label) => normalizedStatus.includes(label))) {
    return "bg-primary";
  }
  return "bg-outline";
}

export function ClubCatalog({ clubs }: ClubCatalogProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const hasCategoryData = clubs.some((club) => Boolean(club.category));

  const visibleClubs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = clubs.filter((club) => {
      const matchesSearch =
        !normalizedQuery ||
        [club.title, club.description, club.category, club.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      const matchesFilter =
        filter === "All" ||
        (filter === "Recruiting now"
          ? club.status.toLowerCase().includes("recruit")
          : club.category?.toLowerCase() === filter.toLowerCase());
      return matchesSearch && matchesFilter;
    });

    return [...filtered].sort((left, right) => left.title.localeCompare(right.title));
  }, [clubs, filter, query]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="clubs-heading">
        <div className="flex flex-col items-start justify-between gap-5 border-b border-primary/15 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[#72726c]">Campus directory</p>
            <h1 id="clubs-heading" className="text-[28px] font-bold tracking-[-0.03em]">Clubs</h1>
            <p className="mt-2 max-w-[500px] text-[13px] leading-6 text-[#686862]">
              Every club on campus, what they are working on, and where you can join in.
            </p>
          </div>

          <label className="relative w-full sm:w-[280px]">
            <span className="sr-only">Search clubs</span>
            <CampusIcon name="search" className=" pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#777770]" />
            <input
              className="h-11 w-full rounded border border-primary/15 bg-white py-2 pl-10 pr-3 text-[13px] text-black outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Search clubs…"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" aria-label="Club filters">
          {["All", ...(hasCategoryData ? categories : []), "Recruiting now"].map((label) => {
            const unavailable = categories.includes(label) && !hasCategoryData;
            const selected = filter === label;
            return (
              <button
                key={label}
                className={cn(
                  "rounded border px-4 py-2 text-xs font-semibold transition",
                  selected
                    ? "border-primary bg-primary text-white "
                    : "border-primary/15 bg-primary-fixed/70 text-black hover:border-primary/40",
                  unavailable && "cursor-not-allowed opacity-45 hover:border-primary/15",
                )}
                disabled={unavailable}

                type="button"
                onClick={() => setFilter(label)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mb-3 mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">All clubs</h2>
            <p className="mt-1 text-xs text-[#72726c]">
              {visibleClubs.length} {visibleClubs.length === 1 ? "club" : "clubs"}
            </p>
          </div>
          {query || filter !== "All" ? (
            <button
              className="border-b border-primary/25 text-xs text-black hover:border-primary"
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("All");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {visibleClubs.length === 0 ? (
          <div className="rounded border border-primary/15 bg-white px-6 py-14 text-center ">
            <CampusIcon name="groups" className=" text-3xl text-[#8a8a83]" />
            <h3 className="mt-3 text-sm font-semibold">No clubs found</h3>
            <p className="mt-1 text-xs text-[#72726c]">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleClubs.map((club) => {
              const count = memberCount(club);

              return (
                <article
                  key={club.slug}
                  className="flex flex-col rounded border border-primary/12 bg-white p-4  transition hover:-translate-y-0.5 hover:border-primary/35 "
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      aria-label={`Open ${club.title}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-primary/15 bg-primary-fixed text-xs font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      href={`/clubs/${encodeURIComponent(club.slug)}`}
                    >
                      {club.bannerImage ? (
                        <img alt="" className="h-full w-full object-cover" src={club.bannerImage} />
                      ) : (
                        getInitials(club.title)
                      )}
                    </Link>
                    <span className="flex items-center gap-1.5 font-mono text-xs uppercase text-[#70706a]">
                      <span className={cn("h-[7px] w-[7px] rounded", statusDotClass(club.status))} />
                      {club.status || "Status —"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <Link
                      className="text-[15px] font-bold tracking-[-0.01em] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
                      href={`/clubs/${encodeURIComponent(club.slug)}`}
                    >
                      {club.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs uppercase text-[#72726c]">
                      {count === undefined ? "—" : count} members
                    </p>
                  </div>

                  <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[#686862]">
                    {club.description || "Description not available yet."}
                  </p>

                  <div className="mt-auto pt-4">
                    <ClubFollowButton
                      clubSlug={club.slug}
                      clubTitle={club.title}
                      initialFollowers={club.followers}
                      layout="inline"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
