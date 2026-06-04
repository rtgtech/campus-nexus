import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { CreatePostOverlay } from "@/components/create-post-overlay";
import { EmptyState } from "@/components/empty-state";
import { FeedPostCard } from "@/components/feed-post-card";
import { getCampusData } from "@/lib/campus-api";
import { fallbackFeed, getInitials, type FeedData } from "@/lib/app-data";
import Link from "next/link";
import { cookies } from "next/headers";

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
  const token = (await cookies()).get("campusNexusToken")?.value;
  const feedData = await getCampusData<FeedData>(
    "/api/feed",
    fallbackFeed,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );

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
            <FeedPostCard
              key={card.post_id ?? card.title}
              post={card}
            />
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                      {getInitials(name)}
                    </span>
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

