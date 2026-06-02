import { AuthSessionControl } from "@/components/auth-session-control";
import { EmptyState } from "@/components/empty-state";
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Games</p>
            <h1 className="mt-3 font-headline-lg text-4xl text-primary md:text-5xl">Game catalog</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
              Real games, leaderboards, and recent activity will appear here as the product is built.
            </p>
          </section>

          {gamesData.gameCards.length === 0 ? (
            <EmptyState title="No games yet" description="The catalog is ready for production game records." />
          ) : (
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
          )}

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

