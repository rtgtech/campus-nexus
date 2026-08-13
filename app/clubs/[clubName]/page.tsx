import Link from "next/link";
import { notFound } from "next/navigation";
import { CampusHeader } from "@/components/campus-header";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { ClubFollowButton } from "@/components/club-follow-button";
import { ClubMembersButton } from "@/components/club-members-button";
import { ClubPostComposer } from "@/components/club-post-composer";
import { EmptyState } from "@/components/empty-state";
import { FeedPostCard } from "@/components/feed-post-card";
import { buttonVariants } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/campus-api";
import { fallbackClubDetail, type ClubDetailData } from "@/lib/app-data";
import { cn } from "@/lib/utils";

type ClubDetailPageProps = {
  params: Promise<{
    clubName: string;
  }>;
};

async function getClubDetail(slug: string): Promise<ClubDetailData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return fallbackClubDetail;
    }

    return (await response.json()) as ClubDetailData;
  } catch {
    return fallbackClubDetail;
  }
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { clubName } = await params;
  const detail = await getClubDetail(clubName);

  if (detail === null || !detail.club.slug) {
    notFound();
  }

  const { club, members, posts } = detail;
  const followers = detail.followers ?? club.followers ?? 0;
  const postsCount = detail.postsCount ?? club.postsCount ?? posts.length;

  return (
    <>
      <div className="min-h-screen bg-background pb-10 font-body-md text-on-background">
        <CampusHeader
          active="clubs"
          contextAction={
            <Link
              href="/clubs"
              className={cn(buttonVariants({ variant: "outline" }), "hidden rounded-full bg-white px-4 text-on-surface-variant hover:text-primary xl:inline-flex")}
            >
              Back to clubs
            </Link>
          }
          searchProps={{ placeholder: "Search campus clubs...", types: ["club"] }}
        />

        <CollapsibleSidebar active="clubs" />

        <main className="mx-auto max-w-7xl space-y-8 px-5 pt-8">
          <section className="overflow-hidden rounded-[10px] border border-surface-container-highest bg-white shadow-xs">
            <div className={`relative min-h-72 overflow-hidden ${club.bannerBg}`}>
              {club.bannerImage ? (
                <img alt={club.title} className="absolute inset-0 h-full w-full object-cover" src={club.bannerImage} />
              ) : null}
              <div className="absolute inset-0 bg-primary/70" />
              <div className="absolute right-5 top-5 z-10">
                <ClubMembersButton members={members} />
              </div>
              <div className="relative flex min-h-72 flex-col justify-end p-6 text-white md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div className="max-w-3xl">
                    <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 shadow-lg ${club.iconBg}`}>
                      <span className="material-symbols-outlined text-4xl text-white">{club.icon}</span>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/75">Club</p>
                    <h1 className="mt-2 font-headline-lg text-4xl text-white md:text-5xl">{club.title}</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-white/82 md:text-base">{club.description}</p>
                  </div>
                  {club.status ? (
                    <span className="rounded-full bg-white/14 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                      {club.status}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <ClubFollowButton clubSlug={club.slug} clubTitle={club.title} initialFollowers={followers} />

              <section className="rounded-[10px] border border-surface-container-highest bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Club Posts</p>
                    <h2 className="mt-2 font-headline-md text-2xl text-on-background">{postsCount}</h2>
                  </div>
                  <span className="material-symbols-outlined rounded-full bg-primary-fixed p-3 text-primary">article</span>
                </div>
              </section>
            </aside>

            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Club Posts</p>
                  <h2 className="mt-2 font-headline-md text-2xl text-on-background">
                    Latest updates
                    <span className="ml-3 align-middle text-base font-semibold text-on-surface-variant">({postsCount})</span>
                  </h2>
                </div>
                <ClubPostComposer clubSlug={club.slug} members={members} />
              </div>

              {posts.length === 0 ? (
                <EmptyState title="No club posts yet" description="Club updates will appear here after members publish posts." />
              ) : (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <FeedPostCard key={post.postId ?? post.title} post={post} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
