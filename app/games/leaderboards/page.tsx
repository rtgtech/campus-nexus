import Link from "next/link";
import { AuthSessionControl } from "@/components/auth-session-control";
import { EmptyState } from "@/components/empty-state";
import { SourceBottomNav } from "@/components/source-bottom-nav";
import { getCampusData } from "@/lib/campus-api";
import { fallbackLeaderboard, type LeaderboardEntry, type LeaderboardData } from "@/lib/app-data";

const rankStyles: Record<number, { row: string; badge: string; avatar: string; score: string; icon: string }> = {
  1: {
    row: "border-secondary/30 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(255,244,235,0.96))] shadow-[0_18px_48px_rgba(236,32,36,0.12)]",
    badge: "bg-secondary text-white shadow-[0_10px_24px_rgba(236,32,36,0.22)]",
    avatar: "bg-primary text-white",
    score: "text-secondary",
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
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[24px] border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-4 sm:p-4 ${style.row}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${style.badge}`}>
        {entry.rank}
      </div>

      <div
        className={`hidden h-14 w-14 shrink-0 items-center justify-center rounded-full font-['Space_Grotesk'] text-lg font-black tracking-normal sm:flex ${style.avatar}`}
      >
        {entry.acronym}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-['Space_Grotesk'] text-sm font-black tracking-normal sm:hidden ${style.avatar}`}
          >
            {entry.acronym}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`material-symbols-outlined hidden text-xl ${style.score} sm:inline-block`}>{style.icon}</span>
              <h2 className="truncate font-headline-md text-lg text-on-surface sm:text-xl">{entry.name}</h2>
            </div>
            <p className="truncate text-xs font-semibold text-on-surface-variant sm:text-sm">{entry.userId}</p>
          </div>
        </div>
      </div>

      <div className="text-right">
        <p className={`font-['Space_Grotesk'] text-xl font-black leading-tight tracking-normal sm:text-2xl ${style.score}`}>
          {formatXp(entry.totalXp)}
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">XP</p>
      </div>
    </article>
  );
}

export default async function GameLeaderboardsPage() {
  const leaderboard = await getCampusData<LeaderboardData>("/api/games/leaderboards", fallbackLeaderboard);
  const entries = leaderboard.entries;

  return (
    <>
      <div className="min-h-screen bg-background pb-32 font-body-md text-on-surface">
        <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-white/80 shadow-sm shadow-primary/5 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
            <Link href="/games" className="font-['Space_Grotesk'] text-2xl font-black tracking-normal text-primary">
              Campus Nexus
            </Link>
            <div className="flex items-center gap-4">
              <button className="material-symbols-outlined rounded-full p-2 text-outline transition-all duration-200 ease-out hover:bg-surface-container active:scale-95">
                notifications
              </button>
              <AuthSessionControl compact />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-8 px-4 pt-8 md:px-10">
          <section className="rounded-[32px] border border-surface-container-highest bg-white p-6 shadow-sm md:p-8">
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Games
            </Link>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Leaderboard</p>
                <h1 className="mt-3 font-headline-lg text-4xl text-primary md:text-5xl">XP rankings</h1>
              </div>
              <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">
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
        </main>
      </div>

      <SourceBottomNav active="games" variant="games" />
    </>
  );
}
