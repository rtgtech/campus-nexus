import { CampusIcon } from "@/components/campus-icon";
import Link from "next/link";
import { CampusShell } from "@/components/campus-shell";
import { buttonVariants } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { getCampusDataResult } from "@/lib/campus-api";
import { fallbackGames, type GamesData } from "@/lib/app-data";
import { cn } from "@/lib/utils";

export default async function GamesPage() {
  const result = await getCampusDataResult<GamesData>("/api/games", fallbackGames);
  const gamesData = result.data;

  return (
    <>
      <CampusShell active="games"><div className="space-y-10">{result.error && <LoadError message="Campus game activity is unavailable. You can still play below." />}
          <section className="rounded border border-surface-container-highest bg-white p-6  md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-on-secondary-fixed-variant">Games</p>
                <h1 className="font-editorial font-medium mt-3  text-4xl text-primary md:text-5xl">Game catalog</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
                  Take a study break. Challenge your memory, solve a puzzle, and find your place on the leaderboard.
                </p>
              </div>
              <Link
                href="/games/leaderboards"
                className={cn(buttonVariants({ size: "lg" }), "w-full rounded px-5  md:w-auto")}
              >
                <CampusIcon name="leaderboard" className=" text-lg" />
                Leaderboard
              </Link>
            </div>
          </section>

          <section className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-secondary-fixed-variant">Available now</p>
              <h2 className="mt-2 font-headline-lg text-headline-lg">Play now</h2>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Link
                href="/games/mind-snap"
                className="group grid overflow-hidden rounded border border-surface-container-highest bg-white  transition hover:-translate-y-1  md:grid-cols-[minmax(0,1fr)_260px]"
              >
                <div className="space-y-4 p-6 md:p-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded bg-primary text-white ">
                    <CampusIcon name="grid_view" className=" text-3xl" />
                  </div>
                  <div>
                    <h2 className="font-headline-lg text-3xl text-primary">Mind Snap</h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-on-surface-variant md:text-base">
                      Memorize the flashed squares, then select them before the 45 second timer runs out.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded bg-secondary px-5 py-3 text-sm font-semibold text-black ">
                    <CampusIcon name="play_arrow" className=" text-lg" />
                    Play
                  </div>
                </div>

                <div className="bg-white p-6">
                  <div className="grid aspect-square grid-cols-3 gap-2 rounded border border-primary/20 bg-primary p-3">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => {
                      const isLit = [0, 2, 4, 7].includes(cell);
                      return (
                        <span
                          key={cell}
                          className={[
                            "rounded border transition duration-200",
                            isLit
                              ? "border-primary bg-secondary "
                              : "border-primary/20 bg-primary-fixed",
                          ].join(" ")}
                        />
                      );
                    })}
                  </div>
                </div>
              </Link>

              <Link
                href="/games/sudoku"
                className="group grid overflow-hidden rounded border border-surface-container-highest bg-white  transition hover:-translate-y-1  md:grid-cols-[minmax(0,1fr)_260px]"
              >
                <div className="space-y-4 p-6 md:p-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded bg-primary text-white ">
                    <CampusIcon name="apps" className=" text-3xl" />
                  </div>
                  <div>
                    <h2 className="font-headline-lg text-3xl text-primary">Sudoku</h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-on-surface-variant md:text-base">
                      Solve a 6 x 6 board with 2 x 3 boxes. Each complete puzzle gives 100 XP.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded bg-secondary px-5 py-3 text-sm font-semibold text-black ">
                    <CampusIcon name="play_arrow" className=" text-lg" />
                    Play
                  </div>
                </div>

                <div className="bg-white p-6">
                  <div className="grid aspect-square grid-cols-6 border-2 border-primary bg-primary p-1 ">
                    {[1, 0, 3, 0, 5, 0, 0, 5, 0, 1, 0, 3, 0, 0, 4, 0, 6, 0, 5, 0, 0, 2, 0, 4, 0, 4, 0, 0, 1, 0, 0, 0, 2, 3, 0, 5].map((value, index) => (
                      <span
                        key={`${value}-${index}`}
                        className={[
                          "flex aspect-square items-center justify-center border border-outline-variant bg-white text-xs font-bold",
                          value ? "text-primary" : "bg-primary-fixed/50",
                          (index + 1) % 3 === 0 && (index + 1) % 6 !== 0 ? "border-r-2 border-r-primary" : "",
                          Math.floor(index / 6) === 1 || Math.floor(index / 6) === 3 ? "border-b-2 border-b-primary" : "",
                        ].join(" ")}
                      >
                        {value || ""}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </div>
          </section>

          {gamesData.gameCards.length > 0 ? (
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {gamesData.gameCards.map((card) => (
                <article
                  key={card.title}
                  className="overflow-hidden rounded border border-outline-variant bg-white "
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
            <section className="rounded border border-surface-container-highest bg-white p-6 ">
              <h2 className="font-headline-lg text-headline-lg">Top rated</h2>
              <div className="mt-5 space-y-3">
                {gamesData.topRated.map((game) => (
                  <div key={`${game.rank}-${game.title}`} className="flex items-center gap-4 rounded bg-surface-container-low p-4">
                    <span className="font-display-lg text-primary">{game.rank}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-headline-md text-headline-md">{game.title}</h3>
                      <p className="text-sm text-on-surface-variant">{game.subtitle}</p>
                    </div>
                    <span className="text-sm font-semibold text-on-secondary-fixed-variant">{game.rating}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {gamesData.recentActivity.length > 0 ? (
            <section className="rounded border border-surface-container-highest bg-white p-6 ">
              <h2 className="font-headline-lg text-headline-lg">Recent activity</h2>
              <div className="mt-5 space-y-3">
                {gamesData.recentActivity.map((item) => (
                  <div key={item.title} className="rounded bg-surface-container-low p-4">
                    <p className="font-semibold text-on-surface">{item.title}</p>
                    <p className="text-sm text-on-surface-variant">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div></CampusShell>
    </>
  );
}

