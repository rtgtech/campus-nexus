import Link from "next/link";
import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { EmptyState } from "@/components/empty-state";
import { FriendButton } from "@/components/follow-button";
import { ProfilePostsGrid } from "@/components/profile-posts-grid";
import { API_BASE_URL, getCampusData } from "@/lib/campus-api";
import { fallbackFeed, fallbackProfile, getInitials, type CampusUser, type FeedData, type ProfileData } from "@/lib/app-data";

type ProfilePageProps = {
  params: Promise<{
    user: string;
  }>;
};

function formatName(user: string) {
  return decodeURIComponent(user)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function getProfileUser(user: string): Promise<CampusUser | null> {
  try {
    const byIdResponse = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(user)}`, {
      cache: "no-store",
    });

    if (byIdResponse.ok) {
      return (await byIdResponse.json()) as CampusUser;
    }

    const usernameResponse = await fetch(`${API_BASE_URL}/api/users?username=${encodeURIComponent(user)}`, {
      cache: "no-store",
    });

    if (!usernameResponse.ok) {
      return null;
    }

    const users = (await usernameResponse.json()) as CampusUser[];
    return users.find((candidate) => candidate.username === user || candidate.user_id === user || candidate.userId === user) ?? null;
  } catch {
    return null;
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { user } = await params;
  const profileUser = await getProfileUser(user);
  const displayName = profileUser?.name || formatName(user) || "Profile";
  const usernameLabel = profileUser?.username ? `@${profileUser.username}` : "";
  const profile = await getCampusData<ProfileData>(`/api/profile/${encodeURIComponent(user)}`, fallbackProfile);
  const feedData = await getCampusData<FeedData>("/api/feed", fallbackFeed);
  const userPosts = profileUser
    ? feedData.feedCards.filter((post) => (post.author_id ?? post.authorId) === profileUser.user_id)
    : [];

  return (
    <CampusShell active="profile">
      <div className="space-y-8">
        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)] md:p-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            <div className="relative">
              <div className="h-36 w-36 rounded-full bg-primary p-1 md:h-40 md:w-40">
                <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-white bg-primary-fixed text-4xl font-bold text-primary md:text-5xl">
                  {getInitials(displayName)}
                </div>
              </div>
            </div>

            <div className="flex-1">
              <h1 className="font-['Space_Grotesk'] text-4xl font-bold tracking-tight text-primary">{displayName}</h1>
              {usernameLabel ? (
                <p className="mt-2 text-sm font-semibold text-secondary">{usernameLabel}</p>
              ) : null}
              <p className="mt-3 text-lg text-on-surface-variant">{profile.major}</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">{profile.bio}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {profileUser ? (
                  <FriendButton targetUserId={profileUser.user_id} targetName={displayName} />
                ) : (
                  <button className="rounded-full bg-surface-container px-6 py-3 text-sm font-semibold text-on-surface-variant" disabled>
                    Profile unavailable
                  </button>
                )}
                <button className="rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface">
                  Share
                </button>
                <Link
                  href="/my_activity"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary/90"
                >
                  <span className="material-symbols-outlined text-base">history</span>
                  My Activity
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)]">
          <SectionTitle
            title="Posts"
            description={userPosts.length > 0 ? `${userPosts.length} posts shared by ${displayName}.` : "Posts for this profile will appear here."}
          />
          <div className="mt-6">
            {profileUser && userPosts.length > 0 ? (
              <ProfilePostsGrid ownerUserId={profileUser.user_id} posts={userPosts} />
            ) : (
              <EmptyState title="No posts yet" description="Profile posts will appear here when this user publishes content." />
            )}
          </div>
        </section>
      </div>
    </CampusShell>
  );
}
