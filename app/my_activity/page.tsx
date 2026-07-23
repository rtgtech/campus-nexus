import Link from "next/link";
import { cookies } from "next/headers";
import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedPostCard } from "@/components/feed-post-card";
import { API_BASE_URL, getCampusData } from "@/lib/campus-api";
import { fallbackFeed, type CampusUser, type FeedCard, type FeedData } from "@/lib/app-data";

async function getCurrentUser(token: string | undefined): Promise<CampusUser | null> {
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { user?: CampusUser };
    return payload.user ?? null;
  } catch {
    return null;
  }
}

function belongsToUser(post: FeedCard, user: CampusUser) {
  return post.authorId === user.userId;
}

function isLikedByViewer(post: FeedCard) {
  return Boolean(post.likedByCurrentUser ?? post.viewerHasLiked);
}

export default async function MyActivityPage() {
  const token = (await cookies()).get("campusNexusToken")?.value;
  const currentUser = await getCurrentUser(token);
  const feedData = await getCampusData<FeedData>(
    "/api/feed",
    fallbackFeed,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  const myPosts = currentUser ? feedData.feedCards.filter((post) => belongsToUser(post, currentUser)) : [];
  const likedPosts = feedData.feedCards.filter(isLikedByViewer);
  const profileKey = currentUser?.username || currentUser?.userId;

  return (
    <CampusShell active="profile">
      <div className="space-y-8">
        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)] md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">My Activity</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-['Space_Grotesk'] text-4xl font-bold tracking-tight text-primary">
                {currentUser ? `${currentUser.name}'s activity` : "Your activity"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
                Review posts you shared and posts you liked across Campus Nexus.
              </p>
            </div>
            <Link
              href={profileKey ? `/${encodeURIComponent(profileKey)}` : "/auth"}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">person</span>
              Profile
            </Link>
          </div>
        </section>

        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)]">
          <SectionTitle
            title="My Posts"
            description={myPosts.length > 0 ? `${myPosts.length} posts you shared.` : "Posts you create will appear here."}
          />
          <div className="mt-6">
            {myPosts.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {myPosts.map((post) => (
                  <FeedPostCard key={post.postId ?? post.title} post={post} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={currentUser ? "No posts yet" : "Sign in required"}
                description={currentUser ? "Your published posts will appear here." : "Sign in to see your activity."}
                action={
                  currentUser ? (
                    <Link
                      href="/?=createpost"
                      className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      Create post
                    </Link>
                  ) : (
                    <Link
                      href="/auth"
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
                    >
                      <span className="material-symbols-outlined text-base">login</span>
                      Sign in
                    </Link>
                  )
                }
              />
            )}
          </div>
        </section>

        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)]">
          <SectionTitle
            title="Liked Posts"
            description={likedPosts.length > 0 ? `${likedPosts.length} posts you liked.` : "Posts you like will appear here."}
          />
          <div className="mt-6">
            {likedPosts.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {likedPosts.map((post) => (
                  <FeedPostCard key={post.postId ?? post.title} post={post} />
                ))}
              </div>
            ) : (
              <EmptyState title="No liked posts yet" description="Use the heart action on posts to build this list." />
            )}
          </div>
        </section>
      </div>
    </CampusShell>
  );
}
