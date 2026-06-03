import Link from "next/link";
import { AuthSessionControl } from "@/components/auth-session-control";
import { SourceBottomNav } from "@/components/source-bottom-nav";
import { getCampusData } from "@/lib/campus-api";
import { fallbackGames, type GamesData } from "@/lib/app-data";

export default async function GamesPage() {
  const gamesData = await getCampusData<GamesData>("/api/games", fallbackGames);

  return (
    <>
      <div className="min-h-screen bg-background pb-32 font-body-md text-on-surface">
        <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-white/80 shadow-sm shadow-primary/5 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
            <div className="font-['Space_Grotesk'] text-2xl font-black tracking-tighter text-primary">
              Campus Nexus
            </div>
            <div className="flex items-center gap-4">
              <button className="material-symbols-outlined rounded-full p-2 text-outline transition-all duration-200 ease-out hover:bg-surface-container active:scale-95">
                notifications
              </button>
              <AuthSessionControl compact />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-10 px-4 pt-8 md:px-10">
          <section className="rounded-[32px] border border-surface-container-highest bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Games</p>
                <h1 className="mt-3 font-headline-lg text-4xl text-primary md:text-5xl">Game catalog</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
                  Real games, leaderboards, and recent activity will appear here as the product is built.
                </p>
              </div>
              <Link
                href="/games/leaderboards"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(56,72,96,0.18)] transition hover:scale-[1.02] md:w-auto"
              >
                <span className="material-symbols-outlined text-lg">leaderboard</span>
                Leaderboard
              </Link>
            </div>
          </section>

          <section className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Available now</p>
              <h2 className="mt-2 font-headline-lg text-headline-lg">Play Mind Snap</h2>
            </div>

            <Link
              href="/games/mind-snap"
              className="group grid overflow-hidden rounded-[28px] border border-surface-container-highest bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:grid-cols-[minmax(0,1fr)_320px]"
            >
              <div className="space-y-4 p-6 md:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_14px_34px_rgba(34,29,92,0.18)]">
                  <span className="material-symbols-outlined text-3xl">grid_view</span>
                </div>
                <div>
                  <h2 className="font-headline-lg text-3xl text-primary">Mind Snap</h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-on-surface-variant md:text-base">
                    Memorize the flashed squares, then select them before the 45 second timer runs out.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)]">
                  <span className="material-symbols-outlined text-lg">play_arrow</span>
                  Play
                </div>
              </div>

              <div className="bg-[#090817] p-6">
                <div className="grid aspect-square grid-cols-3 gap-2 rounded-[24px] border border-[#14f1df]/20 bg-[#050511] p-3 shadow-[inset_0_0_34px_rgba(20,241,223,0.08)]">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => {
                    const isLit = [0, 2, 4, 7].includes(cell);
                    return (
                      <span
                        key={cell}
                        className={[
                          "rounded-2xl border transition duration-200",
                          isLit
                            ? "border-[#14f1df] bg-[#9657f5] shadow-[0_0_18px_rgba(20,241,223,0.62)] group-hover:shadow-[0_0_28px_rgba(20,241,223,0.82)]"
                            : "border-[#1b1740] bg-[#100d24]",
                        ].join(" ")}
                      />
                    );
                  })}
                </div>
              </div>
            </Link>
          </section>

          {gamesData.gameCards.length > 0 ? (
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {gamesData.gameCards.map((card) => (
                <article
                  key={card.title}
                  className="overflow-hidden rounded-[24px] border border-outline-variant bg-white shadow-sm"
                >
                  <div className="relative aspect-square overflow-hidden bg-primary-fixed">
                    {card.image ? <img alt={card.title} className="h-full w-full object-cover" src={card.image} /> : null}
                  </div>
                  <div className="space-y-3 p-4">
                    <h2 className="font-headline-md text-headline-md">{card.title}</h2>
                    <div className="flex items-center justify-between text-sm text-on-surface-variant">
                      <span>{card.online}</span>
                      <span>{card.rating}</span>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          {gamesData.topRated.length > 0 ? (
            <section className="rounded-[32px] border border-surface-container-highest bg-white p-6 shadow-sm">
              <h2 className="font-headline-lg text-headline-lg">Top rated</h2>
              <div className="mt-5 space-y-3">
                {gamesData.topRated.map((game) => (
                  <div key={`${game.rank}-${game.title}`} className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-4">
                    <span className="font-display-lg text-primary">{game.rank}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-headline-md text-headline-md">{game.title}</h3>
                      <p className="text-sm text-on-surface-variant">{game.subtitle}</p>
                    </div>
                    <span className="text-sm font-semibold text-secondary">{game.rating}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {gamesData.recentActivity.length > 0 ? (
            <section className="rounded-[32px] border border-surface-container-highest bg-white p-6 shadow-sm">
              <h2 className="font-headline-lg text-headline-lg">Recent activity</h2>
              <div className="mt-5 space-y-3">
                {gamesData.recentActivity.map((item) => (
                  <div key={item.title} className="rounded-2xl bg-surface-container-low p-4">
                    <p className="font-semibold text-on-surface">{item.title}</p>
                    <p className="text-sm text-on-surface-variant">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <SourceBottomNav active="games" variant="games" />
    </>
  );
}

