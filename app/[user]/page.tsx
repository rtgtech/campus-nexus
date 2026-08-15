import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CampusShell } from "@/components/campus-shell";
import { ProfilePageView, type ProfileClubSummary } from "@/components/profile-page-view";
import { API_BASE_URL } from "@/lib/campus-api";
import {
  fallbackProfile,
  type CampusUser,
  type ClubDetailData,
  type ClubsData,
  type FeedCard,
  type LeaderboardData,
  type MarketplaceData,
  type ProfileData,
} from "@/lib/app-data";

type ProfilePageProps = {
  params: Promise<{
    user: string;
  }>;
};

type ClubFollowStatus = {
  isFollowing?: boolean;
  followers?: number;
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

async function getProfileUser(identifier: string): Promise<CampusUser | null> {
  const byId = await fetchApi<CampusUser | null>(`/api/users/${encodeURIComponent(identifier)}`, null);
  if (byId) {
    return byId;
  }

  const users = await fetchApi<CampusUser[]>(`/api/users?username=${encodeURIComponent(identifier)}`, []);
  const normalizedIdentifier = identifier.toLowerCase();
  return users.find(
    (candidate) =>
      candidate.userId === identifier || candidate.username.toLowerCase() === normalizedIdentifier,
  ) ?? null;
}

async function getCurrentUser(token: string | undefined) {
  if (!token) {
    return null;
  }
  const payload = await fetchApi<{ user?: CampusUser }>("/api/auth/me", {}, token);
  return payload.user ?? null;
}

async function getProfileClubs(targetUserId: string, token: string | undefined, isSelf: boolean) {
  const clubsData = await fetchApi<ClubsData>("/api/clubs", {
    spotlightClubs: [],
    clubCards: [],
    stats: [],
  });

  const rows = await Promise.all(
    clubsData.clubCards.map(async (club) => {
      const detail = await fetchApi<ClubDetailData | null>(
        `/api/clubs/${encodeURIComponent(club.slug)}`,
        null,
        token,
      );
      const membership = detail?.members.find((member) => member.userId === targetUserId);
      const enrichedClub = {
        ...club,
        followers: detail?.followers ?? detail?.club.followers ?? club.followers,
      };
      let isFollowing = false;

      if (isSelf && token) {
        const follow = await fetchApi<ClubFollowStatus>(
          `/api/clubs/${encodeURIComponent(club.slug)}/follow`,
          {},
          token,
        );
        isFollowing = Boolean(follow.isFollowing);
        if (follow.followers !== undefined) {
          enrichedClub.followers = follow.followers;
        }
      }

      return { club: enrichedClub, membership, isFollowing };
    }),
  );

  return {
    memberships: rows
      .filter((row): row is typeof row & { membership: NonNullable<typeof row.membership> } => Boolean(row.membership))
      .map<ProfileClubSummary>((row) => ({
        club: row.club,
        membership: row.membership,
        followers: row.club.followers,
      })),
    followedClubs: rows.filter((row) => row.isFollowing).map((row) => row.club),
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { user: identifier } = await params;
  const token = (await cookies()).get("campusNexusToken")?.value;
  const [profileUser, currentUser] = await Promise.all([
    getProfileUser(identifier),
    getCurrentUser(token),
  ]);

  if (!profileUser) {
    notFound();
  }

  const isSelf = currentUser?.userId === profileUser.userId;
  const [profile, posts, marketplace, leaderboard, profileClubs] = await Promise.all([
    fetchApi<ProfileData>(`/api/profiles/${encodeURIComponent(profileUser.username || profileUser.userId)}`, fallbackProfile, token),
    fetchApi<FeedCard[]>("/api/posts", [], token),
    fetchApi<MarketplaceData>("/api/marketplace", { items: [] }, token),
    fetchApi<LeaderboardData>("/api/games/leaderboards", { entries: [] }, token),
    getProfileClubs(profileUser.userId, token, isSelf),
  ]);

  const userPosts = posts.filter((post) => post.authorId === profileUser.userId);
  const userListings = marketplace.items.filter(
    (item) => item.contact.trim().toLowerCase() === profileUser.email.trim().toLowerCase(),
  );
  const leaderboardEntry = leaderboard.entries.find((entry) => entry.userId === profileUser.userId);

  return (
    <CampusShell active="profile" headerSearchProps={{ placeholder: "Search people...", types: ["user"] }}>
      <ProfilePageView
        currentUserId={currentUser?.userId}
        followedClubs={profileClubs.followedClubs}
        leaderboardEntry={leaderboardEntry}
        listings={userListings}
        memberships={profileClubs.memberships}
        posts={userPosts}
        profile={profile}
        user={profileUser}
      />
    </CampusShell>
  );
}
