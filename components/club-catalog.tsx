"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClubFollowButton } from "@/components/club-follow-button";
import { getInitials, type ClubCard } from "@/lib/app-data";
import { formatPostTime } from "@/lib/post-time";
import { cn } from "@/lib/utils";

type ClubCatalogProps = {
  clubs: ClubCard[];
};

type SortMode = "alphabetical" | "active" | "followed";

const categories = ["Tech", "Cultural", "Sports", "Literary", "Social Impact"];

function memberCount(club: ClubCard) {
  return club.memberCount ?? club.membersCount;
}

function latestPostText(club: ClubCard) {
  return club.latestPost?.caption || club.latestPost?.body || club.latestPost?.title || "Not available yet";
}

function statusDotClass(status: string) {
  const normalizedStatus = status.trim().toLowerCase();
  if (normalizedStatus.includes("recruit")) {
    return "animate-pulse bg-[#202020]";
  }
  if (["active", "open"].some((label) => normalizedStatus.includes(label))) {
    return "bg-[#202020]";
  }
  return "bg-[#8a8a83]";
}

export function ClubCatalog({ clubs }: ClubCatalogProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<SortMode>("alphabetical");
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const hasCategoryData = clubs.some((club) => Boolean(club.category));
  const canSortByActivity = clubs.some((club) => club.postsCount !== undefined);
  const canSortByFollowers = clubs.some((club) => club.followers !== undefined);

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

    return [...filtered].sort((left, right) => {
      if (sort === "active") {
        return (right.postsCount ?? -1) - (left.postsCount ?? -1);
      }
      if (sort === "followed") {
        return (right.followers ?? -1) - (left.followers ?? -1);
      }
      return left.title.localeCompare(right.title);
    });
  }, [clubs, filter, query, sort]);

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1240px] px-5 pb-16 pt-8 text-[#171717] md:px-8 md:pl-24">
      <section aria-labelledby="clubs-heading">
        <div className="flex flex-col items-start justify-between gap-5 border-b border-[#e2e2dc] pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#72726c]">Campus directory</p>
            <h1 id="clubs-heading" className="text-[28px] font-bold tracking-[-0.03em]">Clubs</h1>
            <p className="mt-2 max-w-[500px] text-[13px] leading-6 text-[#686862]">
              Every club on campus, what they are working on, and where you can join in.
            </p>
          </div>

          <label className="relative w-full sm:w-[280px]">
            <span className="sr-only">Search clubs</span>
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#777770]">
              search
            </span>
            <input
              className="h-11 w-full rounded-[10px] border border-[#d9d9d3] bg-white py-2 pl-10 pr-3 text-[13px] text-[#171717] outline-none placeholder:text-[#92928b] focus:border-[#85857e] focus:ring-0"
              placeholder="Search clubs…"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" aria-label="Club filters">
          {["All", ...categories, "Recruiting now"].map((label) => {
            const unavailable = categories.includes(label) && !hasCategoryData;
            const selected = filter === label;
            return (
              <button
                key={label}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold transition",
                  selected
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-[#d9d9d3] bg-white text-[#686862] hover:border-[#9c9c95] hover:text-[#171717]",
                  unavailable && "cursor-not-allowed opacity-45 hover:border-[#d9d9d3] hover:text-[#686862]",
                )}
                disabled={unavailable}
                title={unavailable ? `${label} filtering will be available when the API provides club categories.` : undefined}
                type="button"
                onClick={() => setFilter(label)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-end">
          <label className="flex items-center gap-2 text-xs text-[#72726c]">
            <span>Sort</span>
            <select
              aria-label="Sort clubs"
              className="rounded-[8px] border border-[#d9d9d3] bg-white px-3 py-2 text-xs text-[#555550] focus:border-[#85857e] focus:ring-0"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
            >
              <option value="alphabetical">A–Z</option>
              <option disabled={!canSortByActivity} value="active">Most active</option>
              <option disabled={!canSortByFollowers} value="followed">Most followed</option>
            </select>
          </label>
        </div>

        <div className="mb-3 mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">All clubs</h2>
            <p className="mt-1 text-[11px] text-[#72726c]">
              {visibleClubs.length} {visibleClubs.length === 1 ? "club" : "clubs"}
            </p>
          </div>
          {query || filter !== "All" ? (
            <button
              className="border-b border-[#9a9a93] text-xs text-[#686862] hover:text-[#171717]"
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
          <div className="rounded-[12px] border border-[#deded8] bg-white px-6 py-14 text-center">
            <span className="material-symbols-outlined text-3xl text-[#8a8a83]">groups</span>
            <h3 className="mt-3 text-sm font-semibold">No clubs found</h3>
            <p className="mt-1 text-xs text-[#72726c]">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleClubs.map((club) => {
              const count = memberCount(club);
              const latestPostTime = club.latestPost?.createdAt && now
                ? formatPostTime(club.latestPost.createdAt, now)
                : "—";

              return (
                <article
                  key={club.slug}
                  className="flex min-h-[330px] flex-col rounded-[12px] border border-[#deded8] bg-white p-4 transition-colors hover:border-[#a6a69f]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      aria-label={`Open ${club.title}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#deded8] bg-[#f1f1ed] text-xs font-bold text-[#4f4f4a] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/60"
                      href={`/clubs/${encodeURIComponent(club.slug)}`}
                    >
                      {club.bannerImage ? (
                        <img alt="" className="h-full w-full object-cover" src={club.bannerImage} />
                      ) : (
                        getInitials(club.title)
                      )}
                    </Link>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-[#70706a]">
                      <span className={cn("h-[7px] w-[7px] rounded-full", statusDotClass(club.status))} />
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
                    <p className="mt-1 font-mono text-[10px] uppercase text-[#72726c]">
                      {club.category || "Category —"} · {count === undefined ? "—" : count} members
                    </p>
                  </div>

                  <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[#686862]">
                    {club.description || "Description not available yet."}
                  </p>

                  <div className="mt-3 rounded-[8px] border border-[#e2e2dc] bg-[#f5f5f1] px-3 py-2.5">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#72726c]">
                      Latest post · {latestPostTime}
                    </p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-[#353532]">{latestPostText(club)}</p>
                  </div>

                  <div className="mt-auto pt-4">
                    <ClubFollowButton
                      clubSlug={club.slug}
                      clubTitle={club.title}
                      initialFollowers={club.followers}
                      layout="inline"
                    />
                    <p className="mt-3 border-t border-[#e5e5df] pt-3 text-[10px] text-[#7c7c75]">
                      {club.mutualFollowers === undefined
                        ? "Mutual follows unavailable"
                        : `${club.mutualFollowers} friends follow this`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
