"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProfilePostsGrid } from "@/components/profile-posts-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, authFetch } from "@/lib/auth-client";
import {
  getInitials,
  type CampusUser,
  type ClubCard,
  type ClubMember,
  type FeedCard,
  type LeaderboardEntry,
  type MarketplaceItem,
  type MarketplaceSellerSummary,
  type ProfileBadge,
  type ProfileData,
  type ProfileFriend,
  type ProfileOverviewData,
  type ProfilePreferences,
} from "@/lib/app-data";
import { formatPostTime } from "@/lib/post-time";
import { cn } from "@/lib/utils";

export type ProfileClubSummary = {
  club: ClubCard;
  membership: ClubMember;
  followers?: number;
};

type FriendshipUser = {
  userId: string;
  name: string;
  username?: string | null;
  initials?: string;
  acronym?: string;
};

type FriendshipStatus = {
  isFriend: boolean;
  isSelf: boolean;
  friends: number;
  friendsList?: FriendshipUser[];
  mutualsList?: FriendshipUser[];
};

type ProfilePageViewProps = {
  badges: ProfileBadge[];
  currentUserId?: string;
  followedClubs: ClubCard[];
  friendsPreview: ProfileFriend[];
  leaderboardEntry?: LeaderboardEntry;
  listings: MarketplaceItem[];
  marketplaceSummary: MarketplaceSellerSummary;
  memberships: ProfileClubSummary[];
  mutualFriendsPreview: ProfileFriend[];
  posts: FeedCard[];
  preferences?: ProfilePreferences;
  profile: ProfileData;
  profileStats: ProfileOverviewData["stats"];
  user: CampusUser;
};

type ProfileTab = "posts" | "clubs" | "marketplace" | "settings";
type RequestStatus = "idle" | "loading" | "saving" | "error";

const baseTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "clubs", label: "Clubs" },
  { id: "marketplace", label: "Marketplace" },
];

const notificationSourceLabels: Array<{ key: keyof ProfilePreferences["notificationSources"]; label: string }> = [
  { key: "official", label: "Official" },
  { key: "department", label: "Department" },
  { key: "club", label: "Club" },
  { key: "student", label: "Student" },
  { key: "external", label: "External" },
];

const privacyLabels: Array<{ key: keyof ProfilePreferences["privacy"]; label: string }> = [
  { key: "profileVisibility", label: "Profile visibility" },
  { key: "eventHistoryVisibility", label: "Event history" },
  { key: "marketplaceActivityVisibility", label: "Marketplace activity" },
];

function profileHref(user: FriendshipUser) {
  return `/${encodeURIComponent(user.username || user.userId)}`;
}

function membershipDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `Member since ${date.getFullYear()}` : "Member since —";
}

function listingTime(value: string, now: number) {
  return now ? formatPostTime(value, now) || "Date unavailable" : "Date unavailable";
}

function FriendPreview({ friend }: { friend: FriendshipUser }) {
  return (
    <Link className="min-w-0 text-center" href={profileHref(friend)}>
      <span className="mx-auto flex aspect-square w-full items-center justify-center rounded-[10px] border border-[#deded8] bg-[#f3f3ef] text-xs font-bold text-[#454541] transition hover:border-[#aaa]">
        {friend.initials || friend.acronym || getInitials(friend.name)}
      </span>
      <span className="mt-1.5 block truncate text-[10px] text-[#6f6f69]">{friend.name.split(" ")[0]}</span>
    </Link>
  );
}

function ClubRow({ summary }: { summary: ProfileClubSummary }) {
  const { club, membership } = summary;
  return (
    <Link className="flex items-center gap-3 border-b border-[#e8e8e2] py-3 last:border-0" href={`/clubs/${encodeURIComponent(club.slug)}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-[#deded8] bg-[#f3f3ef] text-[10px] font-bold">
        {club.bannerImage ? <img alt="" className="h-full w-full object-cover" src={club.bannerImage} /> : getInitials(club.title)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[#222]">{club.title}</span>
        <span className="mt-0.5 block text-[10px] text-[#777770]">{membershipDate(membership.createdAt)}</span>
      </span>
      {membership.title && membership.title.toLowerCase() !== "member" ? (
        <span className="rounded-[4px] border border-[#d8d8d2] px-2 py-1 font-mono text-[8px] uppercase text-[#686862]">
          {membership.title}
        </span>
      ) : null}
    </Link>
  );
}

function FollowedClubRow({ club }: { club: ClubCard }) {
  return (
    <Link className="flex items-center gap-3 py-2" href={`/clubs/${encodeURIComponent(club.slug)}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[#deded8] bg-[#f3f3ef] text-[9px] font-bold">
        {club.bannerImage ? <img alt="" className="h-full w-full object-cover" src={club.bannerImage} /> : getInitials(club.title)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{club.title}</span>
        <span className="mt-0.5 block text-[10px] text-[#777770]">
          {club.followers === undefined ? "Followers unavailable" : `${club.followers} followers`}
        </span>
      </span>
    </Link>
  );
}

function PlaceholderCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-[#deded8] bg-white p-4">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ProfilePageView({
  badges,
  currentUserId,
  followedClubs,
  friendsPreview,
  leaderboardEntry,
  listings,
  marketplaceSummary,
  memberships,
  mutualFriendsPreview,
  posts,
  preferences: initialPreferences,
  profile: initialProfile,
  profileStats,
  user,
}: ProfilePageViewProps) {
  const router = useRouter();
  const isSelf = currentUserId === user.userId;
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [friendship, setFriendship] = useState<FriendshipStatus | null>(null);
  const [friendStatus, setFriendStatus] = useState<RequestStatus>("loading");
  const [friendMessage, setFriendMessage] = useState("");
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [editOpen, setEditOpen] = useState(false);
  const [editMajor, setEditMajor] = useState(initialProfile.major);
  const [editBio, setEditBio] = useState(initialProfile.bio);
  const [editBatchYear, setEditBatchYear] = useState(initialProfile.batchYear?.toString() ?? "");
  const [editInterests, setEditInterests] = useState(initialProfile.interests.join(", "));
  const [editStatus, setEditStatus] = useState<RequestStatus>("idle");
  const [editMessage, setEditMessage] = useState("");
  const [messageStatus, setMessageStatus] = useState<RequestStatus>("idle");
  const [messageError, setMessageError] = useState("");
  const [preferences, setPreferences] = useState<ProfilePreferences | undefined>(initialPreferences);
  const [preferencesStatus, setPreferencesStatus] = useState<RequestStatus>("idle");
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [now, setNow] = useState(0);

  const tabs = useMemo(
    () => (isSelf ? [...baseTabs, { id: "settings" as const, label: "Settings" }] : baseTabs),
    [isSelf],
  );

  const loadFriendship = useCallback(async () => {
    if (!currentUserId) {
      setFriendStatus("idle");
      return;
    }
    setFriendStatus("loading");
    setFriendMessage("");
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/users/${encodeURIComponent(user.userId)}/friends?includeLists=true`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Friends could not be loaded");
      }
      setFriendship(data as FriendshipStatus);
      setFriendStatus("idle");
    } catch (error) {
      setFriendStatus("error");
      setFriendMessage(error instanceof Error ? error.message : "Friends could not be loaded");
    }
  }, [currentUserId, user.userId]);

  useEffect(() => {
    setNow(Date.now());
    loadFriendship();
  }, [loadFriendship]);

  async function toggleFriendship() {
    if (isSelf || friendStatus === "saving") {
      return;
    }
    setFriendStatus("saving");
    setFriendMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/users/${encodeURIComponent(user.userId)}/friends`, {
        method: friendship?.isFriend ? "DELETE" : "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Friendship action failed");
      }
      await loadFriendship();
    } catch (error) {
      setFriendStatus("error");
      setFriendMessage(error instanceof Error ? error.message : "Friendship action failed");
    }
  }

  async function removeFriend(friendId: string) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/users/${encodeURIComponent(friendId)}/friends`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Unfriend failed");
      }
      await loadFriendship();
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : "Unfriend failed");
    }
  }

  async function shareProfile() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${user.name} on Campus Nexus`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  async function startConversation() {
    if (isSelf || messageStatus === "saving") {
      return;
    }
    setMessageStatus("saving");
    setMessageError("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/messages/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserId: user.userId, threadType: "direct" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Conversation could not be created");
      }
      const href = typeof data.href === "string" ? data.href : `/chat?thread=${encodeURIComponent(String(data.threadId ?? data.id))}`;
      router.push(href);
    } catch (error) {
      setMessageStatus("error");
      setMessageError(error instanceof Error ? error.message : "Conversation could not be created");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSelf || editStatus === "saving") {
      return;
    }
    setEditStatus("saving");
    setEditMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profiles/${encodeURIComponent(user.username || user.userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          major: editMajor.trim(),
          bio: editBio.trim(),
          batchYear: editBatchYear.trim() ? Number(editBatchYear) : null,
          interests: editInterests.split(",").map((interest) => interest.trim()).filter(Boolean),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Profile update failed");
      }
      setProfile((current) => ({
        ...current,
        major: typeof data.major === "string" ? data.major : editMajor.trim(),
        bio: typeof data.bio === "string" ? data.bio : editBio.trim(),
        batchYear: typeof data.batchYear === "number" ? data.batchYear : null,
        interests: Array.isArray(data.interests) ? data.interests : current.interests,
      }));
      setEditStatus("idle");
      setEditOpen(false);
    } catch (error) {
      setEditStatus("error");
      setEditMessage(error instanceof Error ? error.message : "Profile update failed");
    }
  }

  async function savePreferences() {
    if (!isSelf || !preferences || preferencesStatus === "saving") {
      return;
    }
    setPreferencesStatus("saving");
    setPreferencesMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/users/${encodeURIComponent(user.userId)}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Preferences could not be saved");
      }
      setPreferences(data as ProfilePreferences);
      setPreferencesStatus("idle");
      setPreferencesMessage("Preferences saved.");
      router.refresh();
    } catch (error) {
      setPreferencesStatus("error");
      setPreferencesMessage(error instanceof Error ? error.message : "Preferences could not be saved");
    }
  }

  const friends = friendship?.friendsList ?? friendsPreview;
  const mutuals = friendship?.mutualsList ?? mutualFriendsPreview;
  const visibleFriendPreview = isSelf ? friends.slice(0, 3) : mutuals.slice(0, 3);
  const friendCount = friendship?.friends ?? profileStats.friends;
  const yearLabel = user.yearOfStudy ? `Year ${user.yearOfStudy}` : "Year —";
  const rankLabel = leaderboardEntry ? `Rank #${leaderboardEntry.rank}` : "Rank —";
  const activityLabel = profile.isOnline
    ? "Active now"
    : profile.lastActiveAt
      ? `Active ${listingTime(profile.lastActiveAt, now)}`
      : "Activity not recorded";

  return (
    <div className="mx-auto max-w-[1100px] pb-12 md:pl-16">
      <section className="rounded-[14px] border border-[#deded8] bg-white p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#deded8] bg-[#f1f1ed] text-xl font-bold text-[#353532]">
            {profile.avatar ? (
              <img alt={`${user.name} profile`} className="h-full w-full object-cover" src={profile.avatar} />
            ) : (
              getInitials(user.name)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#171717]">{user.name}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8d8d2] px-2.5 py-1 font-mono text-[10px] font-bold text-[#454541]">
                    <span className="material-symbols-outlined text-[12px]">leaderboard</span>
                    {rankLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6d6d67]">
                  {profile.major || user.department || "Department —"} · {yearLabel} · {profile.batchYear ? `Batch ${profile.batchYear}` : "Batch —"}
                </p>
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase text-[#85857e]">
                  <span className={cn("h-[7px] w-[7px] rounded-full", profile.isOnline ? "bg-emerald-500" : "bg-[#92928b]")} />
                  {activityLabel}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!isSelf ? (
                  <Button
                    className="h-9 rounded-[8px] border-[#d8d8d2] px-4 text-xs"
                    disabled={messageStatus === "saving"}
                    type="button"
                    variant="outline"
                    onClick={startConversation}
                  >
                    {messageStatus === "saving" ? "Opening…" : "Message"}
                  </Button>
                ) : null}
                <Button className="h-9 rounded-[8px] border-[#d8d8d2] px-4 text-xs" type="button" variant="outline" onClick={shareProfile}>
                  Share profile
                </Button>
                {isSelf ? (
                  <Button className="h-9 rounded-[8px] bg-[#171717] px-4 text-xs text-white hover:bg-[#353532]" type="button" onClick={() => setEditOpen(true)}>
                    Edit profile
                  </Button>
                ) : (
                  <Button
                    className={cn(
                      "h-9 rounded-[8px] px-4 text-xs",
                      friendship?.isFriend
                        ? "border-[#d8d8d2] bg-white text-[#5f5f59] hover:bg-[#f3f3ef] hover:text-[#171717]"
                        : "bg-[#171717] text-white hover:bg-[#353532]",
                    )}
                    disabled={friendStatus === "loading" || friendStatus === "saving"}
                    type="button"
                    variant={friendship?.isFriend ? "outline" : "default"}
                    onClick={toggleFriendship}
                  >
                    {friendStatus === "loading" ? "Checking…" : friendStatus === "saving" ? "Saving…" : friendship?.isFriend ? "Friends" : "Add friend"}
                  </Button>
                )}
              </div>
            </div>

            <p className="mt-3 max-w-[560px] text-[13px] leading-6 text-[#353532]">
              {profile.bio || "Bio not added yet."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.interests.length > 0 ? profile.interests.map((interest) => (
                <span key={interest} className="rounded-full border border-[#d3d3cd] px-2.5 py-1 font-mono text-[9px] uppercase text-[#686862]">
                  {interest}
                </span>
              )) : (
                <span className="text-[10px] text-[#85857e]">No interests added.</span>
              )}
            </div>

            {messageError ? <p className="mt-2 text-xs font-semibold text-destructive">{messageError}</p> : null}

            <button className="mt-4 text-left" type="button" onClick={() => setFriendsOpen(true)}>
              <strong className="block text-base">{friendCount === undefined ? "—" : friendCount}</strong>
              <span className="text-[10px] text-[#777770]">Friends</span>
            </button>

            {!isSelf && mutuals.length > 0 ? (
              <button className="mt-3 flex items-center gap-2 text-left" type="button" onClick={() => setFriendsOpen(true)}>
                <span className="flex -space-x-1.5">
                  {mutuals.slice(0, 3).map((friend) => (
                    <span key={friend.userId} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#ededE8] text-[7px] font-bold">
                      {friend.initials || friend.acronym || getInitials(friend.name)}
                    </span>
                  ))}
                </span>
                <span className="text-[10px] text-[#777770]">
                  {mutuals.length} mutual {mutuals.length === 1 ? "friend" : "friends"}
                </span>
              </button>
            ) : null}
            {friendMessage ? <p className="mt-2 text-xs font-semibold text-destructive">{friendMessage}</p> : null}
          </div>
        </div>
      </section>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-[#deded8]" role="tablist" aria-label="Profile sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-selected={activeTab === tab.id}
            className={cn(
              "border-b-2 border-transparent px-4 py-3 text-xs font-semibold text-[#777770] transition hover:text-[#171717]",
              activeTab === tab.id && "border-[#171717] text-[#171717]",
            )}
            role="tab"
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "posts" ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" role="tabpanel">
          <div className="min-w-0">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Posts</h2>
                <p className="mt-1 text-[10px] text-[#777770]">{posts.length} published {posts.length === 1 ? "post" : "posts"}</p>
              </div>
              {isSelf ? (
                <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-[7px] text-xs")} href="/my_activity">
                  My activity
                </Link>
              ) : null}
            </div>
            <ProfilePostsGrid ownerUserId={user.userId} posts={posts} />
          </div>

          <aside className="space-y-3">
            <PlaceholderCard title="Badges">
              {badges.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge.id}
                      aria-label={`${badge.name}${badge.earned ? ", earned" : ", locked"}`}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-[9px] border bg-[#f7f7f4]",
                        badge.earned ? "border-[#aaa] text-[#353532]" : "border-dashed border-[#d8d8d2] text-[#aaa]",
                      )}
                      title={badge.name}
                    >
                      <span className="material-symbols-outlined text-base">{badge.earned ? badge.icon : "lock"}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#777770]">No badges are configured.</p>
              )}
            </PlaceholderCard>

            <PlaceholderCard title={isSelf ? "Friends" : `Mutual friends (${mutuals.length})`}>
              {visibleFriendPreview.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {visibleFriendPreview.map((friend) => <FriendPreview key={friend.userId} friend={friend} />)}
                </div>
              ) : (
                <p className="text-[11px] text-[#777770]">
                  {friendStatus === "loading" ? "Loading friends…" : isSelf ? "No friends yet." : "No mutual friends yet."}
                </p>
              )}
              <button className="mt-3 text-[10px] font-semibold text-[#5f5f59] underline underline-offset-4" type="button" onClick={() => setFriendsOpen(true)}>
                See all
              </button>
            </PlaceholderCard>
          </aside>
        </section>
      ) : null}

      {activeTab === "clubs" ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" role="tabpanel">
          <PlaceholderCard title="Member of">
            {memberships.length > 0 ? memberships.map((summary) => <ClubRow key={summary.club.slug} summary={summary} />) : (
              <p className="text-[11px] text-[#777770]">No club memberships yet.</p>
            )}
          </PlaceholderCard>
          {isSelf ? (
            <PlaceholderCard title="Following">
              {followedClubs.length > 0 ? followedClubs.map((club) => <FollowedClubRow key={club.slug} club={club} />) : (
                <p className="text-[11px] text-[#777770]">No followed clubs yet.</p>
              )}
            </PlaceholderCard>
          ) : <div />}
        </section>
      ) : null}

      {activeTab === "marketplace" ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" role="tabpanel">
          <PlaceholderCard title={`Active listings (${listings.length})`}>
            {listings.length > 0 ? listings.map((listing) => (
              <Link key={listing.id || listing.postId || listing.title} className="flex items-center gap-3 border-b border-[#e8e8e2] py-3 last:border-0" href={`/marketplace#${listing.postId || listing.id || ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-[#deded8] bg-[#f3f3ef]">
                  {listing.image ? <img alt="" className="h-full w-full object-cover" src={listing.image} /> : <span className="material-symbols-outlined text-base text-[#85857e]">sell</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{listing.title}</span>
                  <span className="mt-0.5 block text-[10px] text-[#777770]">{listing.price || "Price unavailable"} · {listingTime(listing.createdAt, now)}</span>
                </span>
              </Link>
            )) : <p className="text-[11px] text-[#777770]">No active listings.</p>}
          </PlaceholderCard>
          <PlaceholderCard title="Trust">
            <div className="space-y-3">
              <div>
                <strong className="block text-base">
                  {marketplaceSummary.sellerRating === null ? "No ratings" : `${marketplaceSummary.sellerRating.toFixed(1)} / 5`}
                </strong>
                <span className="text-[10px] text-[#777770]">Seller rating · {marketplaceSummary.sellerRatingCount} reviews</span>
              </div>
              <div><strong className="block text-base">{marketplaceSummary.successfulTrades}</strong><span className="text-[10px] text-[#777770]">Successful trades</span></div>
            </div>
          </PlaceholderCard>
        </section>
      ) : null}

      {activeTab === "settings" && isSelf ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" role="tabpanel">
          <PlaceholderCard title="Notification sources">
            {preferences ? (
              <div className="flex flex-wrap gap-2">
                {notificationSourceLabels.map(({ key, label }) => {
                  const enabled = preferences.notificationSources[key];
                  return (
                    <button
                      key={key}
                      aria-pressed={enabled}
                      className={cn(
                        "rounded-[6px] border px-3 py-2 font-mono text-[9px] uppercase",
                        enabled ? "border-[#171717] bg-[#171717] text-white" : "border-[#d8d8d2] text-[#686862]",
                      )}
                      type="button"
                      onClick={() => setPreferences((current) => current ? {
                        ...current,
                        notificationSources: {
                          ...current.notificationSources,
                          [key]: !current.notificationSources[key],
                        },
                      } : current)}
                    >
                      {label} · {enabled ? "On" : "Off"}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-[11px] text-[#777770]">Preferences could not be loaded.</p>}
          </PlaceholderCard>
          <PlaceholderCard title="Privacy">
            {preferences ? privacyLabels.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3 border-b border-[#e8e8e2] py-3 first:pt-0 last:border-0 last:pb-0">
                <p className="text-xs font-semibold">{label}</p>
                <NativeSelect
                  aria-label={label}
                  className="w-28 [&_select]:rounded-[6px]"
                  size="sm"
                  value={preferences.privacy[key]}
                  onChange={(event) => setPreferences((current) => current ? {
                    ...current,
                    privacy: {
                      ...current.privacy,
                      [key]: event.target.value as ProfilePreferences["privacy"][typeof key],
                    },
                  } : current)}
                >
                  {(["campus", "friends", "private"] as const).map((value) => (
                    <NativeSelectOption key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )) : <p className="text-[11px] text-[#777770]">Preferences could not be loaded.</p>}
            {preferencesMessage ? (
              <p className={cn("mt-3 text-[10px]", preferencesStatus === "error" ? "text-destructive" : "text-[#5f5f59]")}>{preferencesMessage}</p>
            ) : null}
            <Button
              className="mt-4 w-full rounded-[7px] bg-[#171717] text-white hover:bg-[#353532]"
              disabled={!preferences || preferencesStatus === "saving"}
              size="sm"
              type="button"
              onClick={savePreferences}
            >
              {preferencesStatus === "saving" ? "Saving…" : "Save settings"}
            </Button>
          </PlaceholderCard>
        </section>
      ) : null}

      <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
        <DialogContent className="max-w-xl rounded-[12px] p-0">
          <DialogHeader className="border-b border-[#e5e5df] p-5 pr-14">
            <DialogTitle className="text-xl font-bold">{isSelf ? "Friends" : `Friends of ${user.name}`}</DialogTitle>
            <DialogDescription className="text-xs">{isSelf ? "Your campus connections." : "Friends and mutual connections."}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-4">
              {(isSelf ? friends : mutuals).length > 0 ? (isSelf ? friends : mutuals).map((friend) => (
                <div key={friend.userId} className="flex items-center gap-3 border-b border-[#e8e8e2] py-3 last:border-0">
                  <Link className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#deded8] bg-[#f3f3ef] text-[10px] font-bold" href={profileHref(friend)}>
                    {friend.initials || friend.acronym || getInitials(friend.name)}
                  </Link>
                  <Link className="min-w-0 flex-1" href={profileHref(friend)}>
                    <span className="block truncate text-xs font-semibold">{friend.name}</span>
                    <span className="block truncate text-[10px] text-[#777770]">@{friend.username || friend.userId}</span>
                  </Link>
                  {isSelf ? (
                    <Button className="rounded-[7px] text-xs" size="sm" type="button" variant="outline" onClick={() => removeFriend(friend.userId)}>
                      Unfriend
                    </Button>
                  ) : null}
                </div>
              )) : (
                <p className="rounded-[9px] bg-[#f5f5f1] p-4 text-xs text-[#777770]">No connections to show.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg rounded-[12px] p-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit profile</DialogTitle>
            <DialogDescription>Update the profile fields currently supported by the API.</DialogDescription>
          </DialogHeader>
          <form className="mt-4 space-y-4" onSubmit={saveProfile}>
            <label className="block text-xs font-semibold">
              Major
              <Input className="mt-2 h-10 rounded-[8px] bg-[#f7f7f4]" value={editMajor} onChange={(event) => setEditMajor(event.target.value)} />
            </label>
            <label className="block text-xs font-semibold">
              Batch year
              <Input
                className="mt-2 h-10 rounded-[8px] bg-[#f7f7f4]"
                inputMode="numeric"
                placeholder="2027"
                type="number"
                value={editBatchYear}
                onChange={(event) => setEditBatchYear(event.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold">
              Interests
              <Input
                className="mt-2 h-10 rounded-[8px] bg-[#f7f7f4]"
                placeholder="Robotics, design, music"
                value={editInterests}
                onChange={(event) => setEditInterests(event.target.value)}
              />
              <span className="mt-1 block text-[10px] font-normal text-[#777770]">Separate interests with commas.</span>
            </label>
            <label className="block text-xs font-semibold">
              Bio
              <Textarea className="mt-2 min-h-32 rounded-[8px] bg-[#f7f7f4]" maxLength={500} value={editBio} onChange={(event) => setEditBio(event.target.value)} />
            </label>
            {editMessage ? <p className="text-xs font-semibold text-destructive">{editMessage}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="bg-[#171717] text-white hover:bg-[#353532]" disabled={editStatus === "saving"} type="submit">
                {editStatus === "saving" ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
