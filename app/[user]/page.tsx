import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CampusShell } from "@/components/campus-shell";
import { ProfilePageView, type ProfileClubSummary } from "@/components/profile-page-view";
import { API_BASE_URL } from "@/lib/campus-api";
import {
  getInitials,
  type CampusUser,
  type FeedCard,
  type LeaderboardEntry,
  type ProfileOverviewData,
} from "@/lib/app-data";

type ProfilePageProps = {
  params: Promise<{
    user: string;
  }>;
};

async function fetchApi<T>(path: string, fallback: T, token?: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

async function getProfileOverview(identifier: string, token?: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(identifier)}/profile-overview`,
      {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ProfileOverviewData;
  } catch {
    return null;
  }
}

async function getCurrentUser(token: string | undefined) {
  if (!token) {
    return null;
  }
  const payload = await fetchApi<{ user?: CampusUser }>("/api/auth/me", {}, token);
  return payload.user ?? null;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { user: identifier } = await params;
  const token = (await cookies()).get("campusNexusToken")?.value;
  const [overview, currentUser] = await Promise.all([
    getProfileOverview(identifier, token),
    getCurrentUser(token),
  ]);

  if (!overview) {
    notFound();
  }

  const posts = await fetchApi<FeedCard[]>(
    `/api/posts?authorId=${encodeURIComponent(overview.user.userId)}&limit=20`,
    [],
    token,
  );
  const memberships = overview.clubs.memberOf.map<ProfileClubSummary>((summary) => ({
    ...summary,
    followers: summary.club.followers,
  }));
  const leaderboardEntry: LeaderboardEntry | undefined = overview.stats.rank === null
    ? undefined
    : {
        rank: overview.stats.rank,
        acronym: getInitials(overview.user.name),
        name: overview.user.name,
        userId: overview.user.userId,
        totalXp: overview.stats.totalXp,
      };

  return (
    <CampusShell active="profile" headerSearchProps={{ placeholder: "Search people...", types: ["user"] }}>
      <ProfilePageView
        badges={overview.badges}
        currentUserId={currentUser?.userId}
        followedClubs={overview.clubs.following}
        friendsPreview={overview.friendsPreview}
        leaderboardEntry={leaderboardEntry}
        listings={overview.marketplace.activeListings}
        marketplaceSummary={overview.marketplace}
        memberships={memberships}
        mutualFriendsPreview={overview.mutualFriendsPreview}
        posts={posts}
        preferences={overview.preferences}
        profile={overview.profile}
        profileStats={overview.stats}
        user={overview.user}
      />
    </CampusShell>
  );
}
