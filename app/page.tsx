import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { CreatePostOverlay } from "@/components/create-post-overlay";
import { EmptyState } from "@/components/empty-state";
import { getCampusData } from "@/lib/campus-api";
import { fallbackFeed, profileAvatar, type FeedData } from "@/lib/app-data";
import Link from "next/link";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const unnamedQuery = getSearchValue(resolvedSearchParams[""]);
  const mode = getSearchValue(resolvedSearchParams.mode);
  const view = getSearchValue(resolvedSearchParams.view);
  const showCreatePost =
    unnamedQuery === "createpost" || mode === "createpost" || view === "createpost";
  const feedData = await getCampusData<FeedData>("/api/feed", fallbackFeed);

  return (
    <CampusShell active="feed">
      <>
        {showCreatePost ? <CreatePostOverlay /> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="space-y-6">
          {feedData.feedCards.length === 0 ? (
            <EmptyState
              title="No posts yet"
              description="The feed is ready for real campus posts once publishing workflows are connected."
              action={
                <Link
                  href="/?=createpost"
                  className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Create post
                </Link>
              }
            />
          ) : (
            feedData.feedCards.map((card) => (
            <article
              key={card.title}
              className="overflow-hidden rounded-[28px] border border-outline-variant/60 bg-white/85 shadow-[0_12px_30px_rgba(27,27,35,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between px-5 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <img
                    alt={card.author}
                    className="h-11 w-11 rounded-full object-cover"
                    src={profileAvatar}
                  />
                  <div>
                    <h3 className="font-semibold text-on-surface">{card.author}</h3>
                    <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{card.meta}</p>
                  </div>
                </div>
                <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container">
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>

              <div className="relative aspect-[4/3] overflow-hidden bg-primary md:aspect-[16/10]">
                <img alt={card.title} className="h-full w-full object-cover" src={card.image} />
                <div className="absolute inset-x-0 bottom-0 bg-[rgba(34,29,92,0.72)] px-6 pb-6 pt-20 text-white">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h4 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight">{card.title}</h4>
                      <p className="mt-2 max-w-xl text-sm text-white/82">{card.body}</p>
                    </div>
                    <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                      {card.tag}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-4 md:px-6">
                <div className="flex gap-5 text-sm font-semibold text-on-surface-variant">
                  <button className="flex items-center gap-2 hover:text-primary">
                    <span className="material-symbols-outlined text-secondary">favorite</span>
                    {card.likes}
                  </button>
                  <button className="flex items-center gap-2 hover:text-primary">
                    <span className="material-symbols-outlined">chat_bubble</span>
                    {card.comments}
                  </button>
                  <button className="flex items-center gap-2 hover:text-primary">
                    <span className="material-symbols-outlined">share</span>
                    Share
                  </button>
                </div>
                <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container">
                  <span className="material-symbols-outlined">bookmark</span>
                </button>
              </div>
            </article>
            ))
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-outline-variant/60 bg-white/85 p-6 shadow-[0_12px_30px_rgba(27,27,35,0.06)]">
            <SectionTitle title="Trending" description="Topics will appear as real activity grows." />
            {feedData.trending.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                No trending topics yet.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {feedData.trending.map((item) => (
                <div key={item.tag} className="rounded-2xl bg-surface-container-low p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">{item.label}</p>
                  <p className="mt-2 font-['Space_Grotesk'] text-lg font-bold text-primary">{item.tag}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{item.posts}</p>
                </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-outline-variant/60 bg-white/85 p-6 shadow-[0_12px_30px_rgba(27,27,35,0.06)]">
            <SectionTitle title="Suggested People" description="Recommendations will appear after real profiles exist." />
            {feedData.suggestedPeople.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                No suggestions yet.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {feedData.suggestedPeople.map(({ name, subtitle }) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover"
                      src={profileAvatar}
                    />
                    <div>
                      <p className="font-semibold text-on-surface">{name}</p>
                      <p className="text-sm text-on-surface-variant">{subtitle}</p>
                    </div>
                  </div>
                  <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                    Follow
                  </button>
                </div>
                ))}
              </div>
            )}
          </div>
        </aside>
        </div>
      </>
    </CampusShell>
  );
}

