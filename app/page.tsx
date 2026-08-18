import Link from "next/link";
import { cookies } from "next/headers";
import { CampusShell } from "@/components/campus-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedPostCard } from "@/components/feed-post-card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  fallbackFeed,
  fallbackSignalBarData,
  getInitials,
  type FeedData,
  type SignalBarData,
} from "@/lib/app-data";
import { getCampusData } from "@/lib/campus-api";
import { cn } from "@/lib/utils";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const radarEvents = [
  {
    day: "14",
    month: "AUG",
    title: "HackCX Finals — registration closes tonight",
    source: "OFFICIAL",
    meta: "CS Dept · 217 registered",
    note: "closes in 8h",
    action: "Register",
    urgent: true,
  },
  {
    day: "15",
    month: "AUG",
    title: "UI/UX Bootcamp — Session 2",
    source: "CLUB",
    meta: "Design Club · 34 going",
    action: "Interested",
  },
  {
    day: "16",
    month: "AUG",
    title: "Battle of Bands — Amphitheatre",
    source: "STUDENT",
    meta: "Music Society · 217 going",
    action: "Interested",
  },
  {
    day: "19",
    month: "AUG",
    title: "Career Fair — 40+ companies",
    source: "OFFICIAL",
    meta: "Placement Cell",
    action: "Remind me",
  },
  {
    day: "21",
    month: "AUG",
    title: "Summer PM Internship — applications open",
    source: "EXTERNAL",
    meta: "via Unstop",
    action: "Apply",
  },
];

const fallbackPeople = [
  { name: "Riya Kapoor", subtitle: "ECE · Year 2 · 4 mutual" },
  { name: "Sam Verghese", subtitle: "Design Club · 2 mutual" },
];

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedView = resolvedSearchParams.view === "discover" ? "discover" : "home";
  const token = (await cookies()).get("campusNexusToken")?.value;
  const [feedData, signalBarData] = await Promise.all([
    getCampusData<FeedData>(
      "/api/feed",
      fallbackFeed,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    ),
    getCampusData<SignalBarData>("/api/signal-bar", fallbackSignalBarData),
  ]);
  const suggestedPeople = feedData.suggestedPeople.length > 0 ? feedData.suggestedPeople : fallbackPeople;

  return (
    <CampusShell
      active="feed"
      feedView={feedView}
      headerSearchProps={{
        placeholder: "Search people and clubs...",
        types: ["user", "club"],
      }}
    >
      {feedView === "home" ? (
        <>
          {signalBarData.items.length > 0 ? (
            <section
              aria-label="Live campus updates"
              className="mb-6 flex h-11 overflow-hidden rounded-full border border-outline-variant/70 bg-white"
            >
              <div className="z-10 flex shrink-0 items-center gap-2 bg-on-surface px-4 font-mono text-[11px] font-bold tracking-[0.08em] text-white">
                <span className="size-2 animate-pulse rounded-full bg-white" />
                LIVE
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="campus-signal-scroll flex h-full w-max items-center gap-10 whitespace-nowrap px-5">
                  {[...signalBarData.items, ...signalBarData.items].map((signal, index) => (
                    <a
                      key={`${signal.id}-${index}`}
                      className="text-[13px] font-medium text-on-surface underline-offset-4 transition hover:underline focus-visible:underline focus-visible:outline-none"
                      href={signal.link}
                    >
                      {signal.title}
                    </a>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h1 className="font-['Space_Grotesk'] text-[28px] font-bold tracking-tight text-on-background">
                    Hey there
                  </h1>
                  <p className="mt-1 text-[13px] text-on-surface-variant">
                    Six things are happening today, pulled from four sources so you don&apos;t miss them.
                  </p>
                </div>
              </div>

              <section aria-labelledby="campus-radar-heading">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 id="campus-radar-heading" className="font-['Space_Grotesk'] text-base font-semibold text-on-background">
                      Campus Radar
                    </h2>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      Every hackathon, workshop and fest — official, club, or student-posted — in one feed
                    </p>
                  </div>
                  <Link className="shrink-0 border-b border-on-surface-variant text-xs text-on-surface-variant transition hover:text-on-surface" href="/?view=discover">
                    Full calendar
                  </Link>
                </div>

                <div aria-label="Campus Radar sources" className="mb-3.5 flex flex-wrap gap-2">
                  {["ALL", "OFFICIAL", "DEPT", "CLUB", "STUDENT", "EXTERNAL"].map((source, index) => (
                    <span
                      key={source}
                      className={cn(
                        "rounded-[7px] border px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.04em]",
                        index === 0
                          ? "border-on-surface bg-on-surface text-white"
                          : "border-outline-variant/80 bg-white text-on-surface-variant",
                      )}
                    >
                      {source}
                    </span>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {radarEvents.map((event) => (
                    <article
                      key={`${event.day}-${event.title}`}
                      className={cn(
                        "grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-[10px] border bg-white px-4 py-3 sm:grid-cols-[48px_minmax(0,1fr)_auto]",
                        event.urgent ? "border-on-surface" : "border-outline-variant/70",
                      )}
                    >
                      <time className="text-center font-mono" dateTime={`2026-08-${event.day}`}>
                        <span className="block text-xl font-bold leading-none text-on-surface">{event.day}</span>
                        <span className="mt-1 block text-[9px] font-bold tracking-widest text-on-surface-variant">{event.month}</span>
                      </time>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-on-surface">{event.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                          <span className="rounded-[5px] border border-outline-variant/80 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wide">
                            {event.source}
                          </span>
                          <span>{event.meta}</span>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                        {event.note ? <span className="text-[11px] text-on-surface-variant">{event.note}</span> : null}
                        <span
                          className={cn(
                            "rounded-[8px] border px-3 py-1.5 text-xs font-bold",
                            event.urgent
                              ? "border-on-surface bg-on-surface text-white"
                              : "border-outline-variant bg-white text-on-surface",
                          )}
                        >
                          {event.action}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section aria-labelledby="your-network-heading" className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="your-network-heading" className="font-['Space_Grotesk'] text-base font-semibold text-on-background">
                    Your Network
                  </h2>
                  <Link className="border-b border-on-surface-variant text-xs text-on-surface-variant transition hover:text-on-surface" href="/my_activity">
                    Customize
                  </Link>
                </div>

                {feedData.feedCards.length === 0 ? (
                  <EmptyState
                    title="No posts yet"
                    description="Posts from your campus network will appear here."
                    action={
                      <Link
                        href="/?=createpost"
                        className={cn(buttonVariants({ size: "lg" }), "rounded-full px-5")}
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        Create post
                      </Link>
                    }
                  />
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {feedData.feedCards.map((card) => (
                      <FeedPostCard key={card.postId ?? card.title} post={card} showDeleteButton={false} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4">

              <Link
                className="flex items-center justify-between border-b border-outline-variant py-2 text-sm font-semibold text-on-surface transition hover:border-on-surface"
                href="/games/leaderboards"
              >
                View campus leaderboard
                <span aria-hidden="true" className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>

              <section className="rounded-[10px] border border-outline-variant/70 bg-white p-4" aria-labelledby="people-heading">
                <h2 id="people-heading" className="mb-2 font-['Space_Grotesk'] text-[13px] font-semibold">People you may know</h2>
                {suggestedPeople.slice(0, 2).map(({ name, subtitle }) => (
                  <div key={name} className="flex items-center gap-2.5 py-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-surface-container-low text-[10px] font-bold text-on-surface">
                      {getInitials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{name}</p>
                      <p className="truncate text-[10px] text-on-surface-variant">{subtitle}</p>
                    </div>
                    <Button className="rounded-[8px] px-3 text-[10px] font-bold" size="sm" variant="outline">
                      Add
                    </Button>
                  </div>
                ))}
              </section>
            </aside>
          </div>
        </>
      ) : (
        <div className="flex min-h-72 items-center justify-center rounded-[10px] border border-outline-variant/60 bg-white px-6 text-center">
          <p className="text-base font-medium text-on-surface-variant">To be added soon</p>
        </div>
      )}
    </CampusShell>
  );
}
