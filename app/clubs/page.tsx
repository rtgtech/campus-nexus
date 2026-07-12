import { AuthSessionControl } from "@/components/auth-session-control";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { EmptyState } from "@/components/empty-state";
import { HeaderSearch } from "@/components/header-search";
import { getCampusData } from "@/lib/campus-api";
import { fallbackClubs, type ClubsData } from "@/lib/app-data";
import Link from "next/link";

export default async function ClubsPage() {
  const clubsData = await getCampusData<ClubsData>("/api/clubs", fallbackClubs);

  return (
    <>
      <div className="min-h-screen bg-background pb-10 font-body-md text-on-background">
        <header className="fixed top-0 z-50 w-full border-b border-surface-container-highest bg-white/95 shadow-sm backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <span className="font-headline-lg text-2xl font-black tracking-tighter text-primary">
                Campus Nexus
              </span>
            </div>
            <HeaderSearch className="hidden w-88 md:block" placeholder="Search campus clubs..." types={["club"]} />
            <div className="flex items-center gap-4">
              <button className="material-symbols-outlined rounded-full p-2 text-primary transition-all duration-200 ease-out hover:bg-surface-container active:scale-95">
                notifications
              </button>
              <button className="material-symbols-outlined rounded-full p-2 text-secondary transition-all duration-200 ease-out hover:bg-secondary/10 active:scale-95">
                bolt
              </button>
              <AuthSessionControl compact />
            </div>
          </div>
        </header>

        <CollapsibleSidebar active="club" />

        <main className="mx-auto max-w-7xl space-y-16 px-5 pt-24">
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-background">Featured Clubs</h2>
                <p className="font-body-md text-on-surface-variant">Rising student communities across campus</p>
              </div>
              { clubsData.spotlightClubs.length > 4 && (
                <div className="flex gap-2">
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
              )}
            </div>
            {clubsData.spotlightClubs.length === 0 ? (
              <EmptyState title="No spotlight clubs yet" description="Featured clubs will appear here when real clubs are added." />
            ) : (
              <div className="flex snap-x gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {clubsData.spotlightClubs.map((club) => (
                <div
                  key={club.title}
                  className="group relative aspect-[16/9] min-w-[320px] snap-start cursor-pointer overflow-hidden rounded-[24px] shadow-xl md:min-w-[450px]"
                >
                  <img
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    src={club.image}
                  />
                  <div className="absolute inset-0 bg-primary/65" />
                  <div className="absolute bottom-0 left-0 p-6 text-white">
                    <span className={`mb-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-white ${club.badgeClass} ${club.badge === "Trending" ? "animate-pulse" : ""}`}>
                      <span
                        className="material-symbols-outlined text-xs"
                        style={club.badgeFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {club.icon}
                      </span>
                      {club.badge}
                    </span>
                    <h3 className="mb-1 font-headline-md text-headline-md">{club.title}</h3>
                    <p className="line-clamp-1 font-body-md opacity-80">{club.description}</p>
                  </div>
                </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6">
            {clubsData.clubCards.length === 0 ? (
              <EmptyState
                title="No clubs yet"
                description="Club discovery is ready for real club records."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clubsData.clubCards.map((card) => (
                <Link
                  key={card.slug}
                  href={`/clubs/${card.slug}`}
                  className="group overflow-hidden rounded-[28px] border border-surface-container-highest bg-white shadow-sm transition-all duration-300 hover:shadow-xl"
                >
                  <div className={`relative h-32 overflow-hidden ${card.bannerBg}`}>
                    <img
                      className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                      src={card.bannerImage}
                    />
                  </div>
                  <div className="space-y-6 p-6">
                    <div className="flex items-start justify-between">
                      <div className={`relative z-10 -mt-12 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-white shadow-md ${card.iconBg}`}>
                        <span className="material-symbols-outlined text-3xl text-white">{card.icon}</span>
                      </div>
                      <span className="rounded-xl bg-surface-container-low p-2 text-primary transition-all group-hover:bg-primary group-hover:text-white">
                        <span className="material-symbols-outlined">add</span>
                      </span>
                    </div>
                    <div>
                      <h4 className="font-headline-md text-on-background">{card.title}</h4>
                      <p className="mt-1 line-clamp-2 text-sm font-body-md text-on-surface-variant">
                        {card.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-container-highest pt-3">
                      <div className="flex -space-x-2">
                        {card.avatars.map((avatar) => (
                          <img
                            key={avatar}
                            alt="Member avatar"
                            className="h-8 w-8 rounded-full border-2 border-white"
                            src={avatar}
                          />
                        ))}
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold ${card.extraMembersClass}`}>
                          {card.extraMembers}
                        </div>
                      </div>
                      <span className={`text-xs font-label-md uppercase tracking-tight ${card.statusClass}`}>
                        {card.status}
                      </span>
                    </div>
                  </div>
                </Link>
                ))}
              </div>
            )}
          </section>

          {clubsData.stats.length > 0 ? (
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {clubsData.stats.map((stat) => (
                <div key={stat.label} className={stat.className}>
                  <span className={stat.valueClass}>{stat.value}</span>
                  <span className={stat.labelClass}>{stat.label}</span>
                </div>
              ))}
            </section>
          ) : null}
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .glass-card {
              background: rgba(255, 255, 255, 0.7);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
            }

            .pulse-indicator {
              position: relative;
            }

            .pulse-indicator::after {
              content: "";
              position: absolute;
              top: 0;
              right: 0;
              width: 10px;
              height: 10px;
              background-color: #EC2024;
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 0 8px rgba(236, 32, 36, 0.5);
            }

            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }

            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `,
        }}
      />
    </>
  );
}


