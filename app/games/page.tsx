import { SourceBottomNav } from "@/components/source-bottom-nav";
import { getDemoData } from "@/lib/campus-api";
import { fallbackGames, type GamesData } from "@/lib/demo-data";

const gameCards = [
  {
    title: "Tower Stack",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBOOakKeb6IoVrU5kd864OVTeVipTVWOplb4rNtNfmXAlXersoymDg6E4aZEZ9fBXsjy0Xtx-4nEVkZGHzo4sJzG8l54_09_FzDOVBcsQNDY7eK4h_5-09Na0vqXzRFZZHJmPjsXE1Gjr5ZVUbscev9lrftNECvbxhgDiigWGsSiWY3OXm4xVGWHG9Ojn6OT0Ituus9sSdLzhKHhYo_CqePYLeQeB6DzXUS6tVWYB6GTgrab14ZXF8qFjq8Wio_sipiyB6yCtvrHlo",
    online: "1.2k Online",
    rating: "4.8",
  },
  {
    title: "Campus Quest",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCZgxMvce-RQKRBBOEP2fTZHMAYNZUDCigRuiqZisqy_mZn5SMMjAnIGkWK0TehBpLOrJVjPLoLQP6oiUFXWh3-QF_bnRn_0r6Ajrh2R-dFH60veIsu_9Vbo2O6nAKPl5a8BxQd72y3_4B1KlBws0HNbcfx1a8JgiEdKtOgatpMOJRoDdlAruaXYCYz6Odwm5iPpgyGlWNRJlXYGY5q7atjjP0kymYlMs8AxoA3uDhqltFjqtYiN4Q9PZxihcCwQpfIr1m0HpKVd4A",
    online: "840 Online",
    rating: "4.9",
  },
  {
    title: "Neon Pong",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDBng5saUttVc-mB6g9MGdxWLPLk9V4ym-2q2eG_q2vh_GagmQJrWD5iy0PE7VQh0JMlT5Z7jSBZTBUN0lQmZcnI6O5lHuyaDQJiUMV6g6d9ITaBVpGKYZEYH__daBqr9P2sd5nF0m-yfgUEXOrb8aG--6hOW-RcK4cYHI6LJgcZCPUAleB9V16LeBCvV1HP4-opT2l8f3j1ZW7D7_V3DFAAsXcPHAOHh1yA466Zl3rzVg2ouacbX_j0ZAA1U9-wO_gcssMyRpjdro",
    online: "3.5k Online",
    rating: "4.7",
  },
  {
    title: "Social Trivia",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBs2yaKtWs6uTt59SLpmArNvnvzTIVohN75iFaaBWWR09ojT210H7O1otZpqiYkoP_mP0fEpE7paQx9EtK4Dm_PFm-K5JVBOVtmyzVW8wGWUXRBpLdk_FH_xBsT6j41ZZKY5SobeyC0zlzsz-XqVrM_zSA1xdX5RORdEu5KHK59fGOBRBgde1E625zELBTY65vRzmhtoGSzlF8QkFaUmn6n-gi2uuljWuJ27hofVAdmhKHZxDem_-Ya8WTT7kU3REsYS4unc7M4I0A",
    online: "2.1k Online",
    rating: "4.6",
  },
];

const topRated = [
  {
    rank: "01",
    title: "Word Blitz",
    subtitle: "Action Puzzle • 12k plays",
    rating: "5.0",
    badge: "Trending",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBYVfjvZn9wm6xy8l3AYTZA4dUKQQ8CQlY4eZ3Nz1AoKXjEZdgF8oxFh5lWvDUg3lxBy3rFLboLP377J9E2P6t94vysLEfDR1ZS0kWa9JiHFTw996ZvTEwnguBgTexOSrNAjZVztuq8oIvoDPVYLkP4dC-oqvOP_rT896MNie6bsE74_JrDNeCyoY-LKkCfNyHsxwYF-IgV-KveD6hb98d7OKu9--hix6SxCVgZ_KQFLX5fjiM_NYgVTEX--8jN4xfNPAfYbmo0c9E",
    badgeClass: "text-secondary",
  },
  {
    rank: "02",
    title: "Campus Run",
    subtitle: "Endless Runner • 8.4k plays",
    rating: "4.9",
    badge: "Stable",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAQFBZmIV8jyjb0-LWpeHQDrTrHe1c8H8dWKHhEM_Qaa_cQvfrXIs8bz-N9VlTgyQPlUVJiUK0HwlroHyEnyWzjG0ExMa8vVoRXzMo2IXtHAaXRyW9TY1thuDxd7D7L0IBtseY77jl3nLPV0zjir7lnrSnDy2rUqAtKHjaEb_rJDctThbXQZ7yWKumlf6yY3wFVzvxJr6KTJeanX93hhauV2WHMT2LzkjymWVrgeGLBpSeyqg0o-GLoDqbFuivPZOm51E5U3AJJTLk",
    badgeClass: "text-outline",
  },
];

const recentActivity = [
  {
    title: "Cyber Drift",
    subtitle: "Last played 2h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA5aMIC2BC_PNfU79OHfSgC7EMuHi3glbdRh5bh49TdcJVUXQ3TmYLpdlnXekg4pJcM5xHDK46cHTEObU9sy1qz425P9mPeUS3xWMoLEMFZH4GwPDoxB0TttqafCWCUz-2o_AW8ul2v72ZBqU8Z0ku7DheAzzYw9RRYK8MDmUtlQL1p9B2llZ6PhMbm11FpgvswQwzE23rRUtTh-olq_XUje06fQOmo5-GC5v1GWeD_oJwoncgjYs2iMLd_voBTzZmj53nxj1g-a3M",
  },
  {
    title: "Tower Stack",
    subtitle: "Last played Yesterday",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDJ65dK-WM3Vmo_XqC9ADeuv64W3y7gBM8k1AlDOdCXolMjNEOxAgI-t7vCgz9o0XUHm9kR7smm-us6YDfk_PE3zUkEFolJgG7atPv_ZhOr2JP6I8ZmzmeFOY_HR2pzmcaG3keXBBZFR6YvO2fi3VjiWJZY0ONs_oxwr8s6m-FypouOGkc3fAvNw-JMqYuRDqkpB-4XWzMUI5q9l1KOq641_Upc92f2Kmw-qjKCVGOsDGi-K8Eeag7ChHhdFGIsdHFZJuqQFkLvRN0",
  },
];

export default async function GamesPage() {
  const gamesData = await getDemoData<GamesData>("/api/games", fallbackGames);

  return (
    <>
      <div className="min-h-screen bg-background pb-32 font-body-md text-on-surface">
        <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-white/80 shadow-sm shadow-primary/5 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
            <div className="font-['Space_Grotesk'] text-2xl font-black tracking-tighter text-primary dark:text-white">
              Campus Nexus
            </div>
            <div className="mx-8 hidden max-w-md flex-1 md:flex">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                  search
                </span>
                <input
                  className="w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 focus:ring-2 focus:ring-secondary"
                  placeholder="Search games..."
                  type="text"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="material-symbols-outlined rounded-full p-2 text-outline transition-all duration-200 ease-out hover:bg-surface-container active:scale-95">
                bolt
              </button>
              <button className="material-symbols-outlined rounded-full p-2 text-outline transition-all duration-200 ease-out hover:bg-surface-container active:scale-95">
                notifications
              </button>
              <div className="relative">
                <img
                  alt="User avatar"
                  className="h-10 w-10 rounded-full border-2 border-primary"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDO2bR3gKDwaVwXAXzVloFcBN9opAJpN3ZBR51qUmVFYHEAdSzlTAmDSHslnVX72B2Mpkd4GQTx-jWDjK4CVJoFiq91gJnefkOCATczeafCVp2Ol79-Gf0GmwG-sOsH_23InP8uyD7AcWIvbJcflNt5xsM2EGg1EFCXUjk0A-nLf-M2Fg3bsSfY_onZVku88dnHgA5vL3abIQJYR75qPLzacIDnJ_Drj_vMeK8qB4bjsooGSMpSREKkjRCNEvlWvx4EkhPZswqBNPs"
                />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-secondary shadow-[0_0_15px_rgba(236,32,36,0.5)]" />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto mt-2 max-w-7xl px-4 md:px-10">
          <section className="relative mb-6 flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-[32px] bg-primary p-6 md:aspect-[21/9]">
            <div className="absolute inset-0 z-0">
              <img
                alt="Weekly Challenge Banner"
                className="h-full w-full object-cover opacity-60 mix-blend-overlay"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWI2rirGazMHGyN_eEnIY0YZaBJO9hUxHfun-bi5kK83MA5cbLFBp4rRfHOb6lEeyuRNYzapIV9wRF0g0VkObJ-2wxIXJc2ctTJO2bxEadD4rlix1P9zprDrJ-WGFwh0a_hQ4pVCNBQcvG3-MXif1gn0iRDhyCuo0WGfMJ0RfnCCqpsUvd6_YBydh-2GBZJxP9v95YXFYe2z4mXk318Z0XDAIoBEQmP4KZbKNaIkUM0ZZI6u98wiSRtV7NuxotxEDhlhAti5ith8Y"
              />
              <div className="absolute inset-0 bg-primary/70" />
            </div>
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center rounded-full bg-secondary px-4 py-1 font-label-md text-label-md text-white animate-pulse">
                <span
                  className="material-symbols-outlined mr-2 text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  military_tech
                </span>
                WEEKLY CHALLENGE
              </div>
              <h1 className="max-w-2xl font-display-lg text-display-lg leading-none text-white">
                Nexus Arena: Cyber Drift
              </h1>
              <p className="max-w-lg font-body-lg text-white/80">
                Beat the Bengaluru high score of 42,500 and earn the &apos;Speed Demon&apos; digital badge +
                500 Nexus Credits.
              </p>
              <div className="flex gap-4 pt-4">
                <button className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-headline-md text-headline-md text-primary shadow-xl transition-all hover:scale-105 active:scale-95">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    play_arrow
                  </span>
                  Play Now
                </button>
                <button className="rounded-xl border border-white/20 bg-white/70 px-8 py-4 font-headline-md text-headline-md text-white backdrop-blur-[20px] transition-all hover:bg-white/10 active:scale-95">
                  Leaderboard
                </button>
              </div>
            </div>
          </section>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-6">
            {["All Games", "Multiplayer", "Puzzle", "Action", "Social", "Tournaments"].map((tab, index) => (
              <button
                key={tab}
                className={
                  index === 0
                    ? "whitespace-nowrap rounded-full bg-primary px-6 py-2 font-label-md text-label-md text-on-primary"
                    : "whitespace-nowrap rounded-full bg-surface-container px-6 py-2 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-primary-fixed"
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <section className="mt-8">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="font-headline-lg text-headline-lg">Nexus Originals</h2>
                <p className="text-on-surface-variant">Hand-picked mini-games for hostel breaks and Bengaluru downtime.</p>
              </div>
              <button className="flex items-center gap-1 font-label-md text-label-md text-secondary hover:underline">
                View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {gamesData.gameCards.map((card) => (
                <div
                  key={card.title}
                  className="group relative overflow-hidden rounded-[24px] border border-outline-variant bg-surface-container transition-all duration-300 hover:border-secondary"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      alt={card.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      src={card.image}
                    />
                    <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-primary/40 px-3 py-1 text-[12px] text-white backdrop-blur-md">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
                      {card.online}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-headline-md text-headline-md">{card.title}</h3>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-secondary">
                        <span
                          className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        <span className="font-bold">{card.rating}</span>
                      </div>
                      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Play Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 grid grid-cols-1 gap-6 pb-12 lg:grid-cols-3">
            <div className="glass-card lg:col-span-2 rounded-[32px] border-2 border-primary/5 p-6">
              <div className="mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">auto_awesome</span>
                <h2 className="font-headline-lg text-headline-lg">Top Rated This Semester</h2>
              </div>
              <div className="space-y-4">
                {gamesData.topRated.map((game) => (
                  <div
                    key={game.rank}
                    className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-surface-container-highest hover:bg-white"
                  >
                    <span className="font-display-lg text-surface-container-highest transition-colors group-hover:text-primary">
                      {game.rank}
                    </span>
                    <img alt={game.title} className="h-16 w-16 rounded-xl object-cover" src={game.image} />
                    <div className="flex-1">
                      <h4 className="font-headline-md text-headline-md">{game.title}</h4>
                      <p className="text-sm text-on-surface-variant">{game.subtitle}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 text-secondary">
                        <span
                          className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        <span className="font-bold">{game.rating}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${game.badgeClass}`}>
                        {game.badge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border-2 border-primary/5 bg-surface-container p-6">
              <div className="mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                <h2 className="font-headline-lg text-headline-lg">Jump Back In</h2>
              </div>
              <div className="space-y-6">
                {gamesData.recentActivity.map((item) => (
                  <div key={item.title} className="flex items-center gap-4 p-2">
                    <div className="relative">
                      <img alt={item.title} className="h-12 w-12 rounded-lg object-cover" src={item.image} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="text-xs text-on-surface-variant">{item.subtitle}</p>
                    </div>
                    <button className="material-symbols-outlined text-primary transition-colors hover:text-secondary">
                      play_circle
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-2xl bg-primary-container p-6 text-white">
                <h5 className="mb-1 text-sm font-bold">Nexus Pro Tip</h5>
                <p className="text-xs opacity-90">Multiplayer games earn 2x Credits on Fridays after 6 PM in Bengaluru!</p>
              </div>
            </div>
          </section>
        </main>
      </div>

      <SourceBottomNav active="games" variant="games" />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .glass-card {
              background: rgba(255, 255, 255, 0.7);
              backdrop-filter: blur(20px);
              border: 1px solid rgba(0, 10, 30, 0.1);
            }

            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }

            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `,
        }}
      />
    </>
  );
}
