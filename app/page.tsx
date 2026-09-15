import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { CampusShell } from "@/components/campus-shell";
import { FeedWorkspace } from "@/components/feed-workspace";
import { LoadError } from "@/components/load-error";
import { getCampusDataResult } from "@/lib/campus-api";
import { fallbackFeed, fallbackCampusEventsData, type FeedData, type CampusEventsData, type SignalBarData } from "@/lib/app-data";

export default async function HomePage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const mode = params.mode === "latest" ? "latest" : "for-you";
  const token = (await cookies()).get("campusNexusToken")?.value;
  const [feed, events, updates] = await Promise.all([
    getCampusDataResult<FeedData>("/api/feed?mode=" + mode + "&limit=20", fallbackFeed, token ? { headers: { Authorization: "Bearer " + token } } : {}),
    getCampusDataResult<CampusEventsData>("/api/events", fallbackCampusEventsData),
    getCampusDataResult<SignalBarData>("/api/signal-bar", { items: [], total: 0 }),
  ]);
  return <CampusShell active="feed" headerSearchProps={{ placeholder: "Search your campus", types: ["user", "club"] }}>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-7">
      <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">The campus edit</p>
        <h1 className="font-editorial font-medium text-4xl leading-tight sm:text-5xl">Good to see you here.</h1>
        <p className="mt-3 text-base text-muted-foreground">People, ideas, and everything happening around you.</p>
      </div>
      <Link href="/clubs" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Find your people <ArrowUpRight size={18} aria-hidden="true" /></Link>
    </div>
    <div className="mx-auto grid max-w-6xl gap-8 xl:grid-cols-[minmax(0,720px)_280px] xl:gap-10">
      <FeedWorkspace key={mode + (feed.data.snapshotId ?? "error")} initial={feed.data} initialError={feed.error} mode={mode} signedIn={Boolean(token)} />
      <aside className="space-y-8">
        <section aria-labelledby="campus-events-heading">
          <div className="mb-5 flex items-center gap-2"><CalendarDays size={18} className="text-primary" aria-hidden="true" /><h2 id="campus-events-heading" className="text-lg font-semibold">Around campus</h2></div>
          {events.error ? <LoadError message="Campus events are unavailable." /> : !events.data.items.length ? <p className="border-t py-5 text-sm text-muted-foreground">No events scheduled yet. Check back soon.</p> :
            <div className="divide-y border-y border-border">{events.data.items.map((event) => <article key={event.id} className="py-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary"><time dateTime={event.date}>{event.date}</time> · {event.type}</p>
              <h3 className="text-base font-semibold leading-6">{event.title}</h3><p className="mt-1 text-sm text-muted-foreground">{event.place}</p>
              <a className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline" href={event.link} aria-label={"Apply for " + event.title}>View event <ArrowUpRight size={16} aria-hidden="true" /></a>
            </article>)}</div>}
        </section>
        {!updates.error && updates.data.items.length > 0 && <section aria-labelledby="campus-updates-heading"><h2 id="campus-updates-heading" className="mb-3 text-lg font-semibold">Campus notes</h2>
          <ul className="divide-y border-y">{updates.data.items.map((item) => <li key={item.id}><a href={item.link} className="block py-4 text-sm leading-6 hover:underline">{item.title}</a></li>)}</ul>
        </section>}
        <Link href="/games/leaderboards" className="flex min-h-11 items-center justify-between border-t pt-4 text-sm font-medium text-primary">Campus leaderboard <ArrowUpRight size={18} aria-hidden="true" /></Link>
      </aside>
    </div>
  </CampusShell>;
}
