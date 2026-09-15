import { CampusIcon } from "@/components/campus-icon";
import Link from "next/link";
import { CampusShell } from "@/components/campus-shell";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { getCampusDataResult } from "@/lib/campus-api";
import { fallbackLeaderboard, type LeaderboardEntry, type LeaderboardData } from "@/lib/app-data";
import { cn } from "@/lib/utils";

const rankStyles: Record<number, { row: string; badge: string; avatar: string; score: string; icon: string }> = {
  1: {
    row: "border-secondary/30 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(255,244,235,0.96))] ",
    badge: "bg-secondary text-black ",
    avatar: "bg-primary text-white",
    score: "text-on-secondary-fixed-variant",
    icon: "workspace_premium",
  },
  2: {
    row: "border-primary/20 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(240,244,255,0.95))]",
    badge: "bg-primary text-white",
    avatar: "bg-primary-container text-white",
    score: "text-primary",
    icon: "military_tech",
  },
  3: {
    row: "border-tertiary/30 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(244,252,248,0.95))]",
    badge: "bg-tertiary text-white",
    avatar: "bg-tertiary text-white",
    score: "text-tertiary",
    icon: "emoji_events",
  },
};

function formatXp(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function leaderboardEntryStyle(entry: LeaderboardEntry) {
  return (
    rankStyles[entry.rank] ?? {
      row: "border-surface-container-highest bg-white",
      badge: "bg-surface-container-high text-on-surface",
      avatar: "bg-surface-container-high text-primary",
      score: "text-primary",
      icon: "leaderboard",
    }
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const style = leaderboardEntryStyle(entry);

  return (
    <article
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded border p-3  transition hover:-translate-y-0.5  sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-4 sm:p-4 ${style.row}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded text-sm font-black ${style.badge}`}>
        {entry.rank}
      </div>

      <div
        className={`hidden h-14 w-14 shrink-0 items-center justify-center rounded font-sans text-lg font-black tracking-normal sm:flex ${style.avatar}`}
      >
        {entry.acronym}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded font-sans text-sm font-black tracking-normal sm:hidden ${style.avatar}`}
          >
            {entry.acronym}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <CampusIcon name={style.icon} className={` hidden text-xl ${style.score} sm:inline-block`} />
              <h2 className="truncate font-headline-md text-lg text-on-surface sm:text-xl">{entry.name}</h2>
            </div>
            <p className="truncate text-xs font-semibold text-on-surface-variant sm:text-sm">{entry.userId}</p>
          </div>
        </div>
      </div>

      <div className="text-right">
        <p className={`font-sans text-xl font-black leading-tight tracking-normal sm:text-2xl ${style.score}`}>
          {formatXp(entry.totalXp)}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">XP</p>
      </div>
    </article>
  );
}

export default async function GameLeaderboardsPage() {
  const result = await getCampusDataResult<LeaderboardData>("/api/games/leaderboards", fallbackLeaderboard);
  if (result.error) return <CampusShell active="games"><LoadError /></CampusShell>;
  const leaderboard = result.data;
  const entries = leaderboard.entries;

  return (
    <>
      <CampusShell active="games"><div className="space-y-8">
          <section className="rounded border border-surface-container-highest bg-white p-6  md:p-8">
            <Link
              href="/games"
              className={cn(buttonVariants({ variant: "outline" }), "rounded px-4 text-on-surface-variant hover:text-primary")}
            >
              <CampusIcon name="arrow_back" className=" text-lg" />
              Games
            </Link>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-on-secondary-fixed-variant">Leaderboard</p>
                <h1 className="font-editorial font-medium mt-3  text-4xl text-primary md:text-5xl">XP rankings</h1>
              </div>
              <div className="rounded bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">
                {entries.length} ranked players
              </div>
            </div>
          </section>

          {entries.length === 0 ? (
            <EmptyState title="No XP yet" description="Players will appear here after games start awarding XP." />
          ) : (
            <section className="space-y-3">
              {entries.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </section>
          )}
        </div></CampusShell>
    </>
  );
}
