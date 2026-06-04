"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL, type CampusAuthSession, readAuthSession } from "@/lib/auth-client";
import { getInitials } from "@/lib/app-data";

type FriendshipUser = {
  user_id: string;
  userId: string;
  name: string;
  username?: string | null;
  acronym?: string;
  initials?: string;
};

type FriendshipStatus = {
  isFollowing: boolean;
  isSelf: boolean;
  followers: number;
  following: number;
  followersList?: FriendshipUser[];
  followingList?: FriendshipUser[];
};

type FriendshipListResponse = {
  items: FriendshipUser[];
  total: number;
};

type FollowButtonProps = {
  targetUserId: string;
  targetName: string;
};

type Status = "idle" | "loading" | "saving" | "error";
type ListStatus = "idle" | "loading" | "error";
type ActiveList = "followers" | "following" | null;

function profileHref(user: FriendshipUser) {
  return `/${encodeURIComponent(user.username || user.user_id || user.userId)}`;
}

function UserRow({
  canUnfollow,
  isSaving,
  onUnfollow,
  user,
}: {
  canUnfollow: boolean;
  isSaving: boolean;
  onUnfollow: (userId: string) => void;
  user: FriendshipUser;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
      <Link
        href={profileHref(user)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary"
      >
        {user.initials || user.acronym || getInitials(user.name)}
      </Link>
      <Link href={profileHref(user)} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{user.name}</p>
        <p className="truncate text-xs text-on-surface-variant">@{user.username || user.user_id || user.userId}</p>
      </Link>
      {canUnfollow ? (
        <button
          className="rounded-full border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-secondary hover:text-secondary disabled:opacity-60"
          disabled={isSaving}
          type="button"
          onClick={() => onUnfollow(user.user_id || user.userId)}
        >
          {isSaving ? "..." : "Unfollow"}
        </button>
      ) : null}
    </div>
  );
}

export function FollowButton({ targetUserId, targetName }: FollowButtonProps) {
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [friendship, setFriendship] = useState<FriendshipStatus | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [listStatus, setListStatus] = useState<ListStatus>("idle");
  const [message, setMessage] = useState("");
  const [activeList, setActiveList] = useState<ActiveList>(null);
  const [followersList, setFollowersList] = useState<FriendshipUser[]>([]);
  const [followingList, setFollowingList] = useState<FriendshipUser[]>([]);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  async function loadFriendship(authSession: CampusAuthSession, signal?: AbortSignal) {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetUserId)}/friends`, {
        headers: { Authorization: `Bearer ${authSession.token}` },
        signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Friendship status failed");
      }

      setFriendship(data as FriendshipStatus);
      setStatus("idle");
    } catch (error) {
      if (!signal?.aborted) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Friendship status failed");
      }
    }
  }

  async function loadFriendshipList(listName: Exclude<ActiveList, null>, authSession: CampusAuthSession, signal?: AbortSignal) {
    setListStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetUserId)}/friends/${listName}`, {
        headers: { Authorization: `Bearer ${authSession.token}` },
        signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Friendship list failed");
      }

      const items = Array.isArray((data as FriendshipListResponse).items) ? (data as FriendshipListResponse).items : [];
      if (listName === "followers") {
        setFollowersList(items);
        setFriendship((current) => (current ? { ...current, followers: (data as FriendshipListResponse).total ?? items.length } : current));
      } else {
        setFollowingList(items);
        setFriendship((current) => (current ? { ...current, following: (data as FriendshipListResponse).total ?? items.length } : current));
      }
      setListStatus("idle");
    } catch (error) {
      if (!signal?.aborted) {
        setListStatus("error");
        setMessage(error instanceof Error ? error.message : "Friendship list failed");
      }
    }
  }

  useEffect(() => {
    const storedSession = readAuthSession();
    setSession(storedSession);

    if (!storedSession) {
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    loadFriendship(storedSession, controller.signal);

    return () => controller.abort();
  }, [targetUserId]);

  useEffect(() => {
    if (!activeList) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activeList]);

  useEffect(() => {
    if (!activeList || !session) {
      return;
    }

    const controller = new AbortController();
    loadFriendshipList(activeList, session, controller.signal);

    return () => controller.abort();
  }, [activeList, session, targetUserId]);

  async function toggleFollow() {
    if (!session || friendship?.isSelf || status === "saving") {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetUserId)}/friends`, {
        method: friendship?.isFollowing ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Follow action failed");
      }

      setFriendship(data as FriendshipStatus);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Follow action failed");
    }
  }

  async function unfollowFromList(userId: string) {
    if (!session || !friendship?.isSelf || unfollowingId) {
      return;
    }

    setUnfollowingId(userId);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/friends`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Unfollow failed");
      }

      setFriendship(data as FriendshipStatus);
      await loadFriendshipList("following", session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unfollow failed");
    } finally {
      setUnfollowingId(null);
    }
  }

  if (!session) {
    const nextPath = typeof window === "undefined" ? "/" : window.location.pathname;
    return (
      <Link
        href={`/auth?next=${encodeURIComponent(nextPath)}`}
        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:scale-[1.02]"
      >
        Sign in to follow
      </Link>
    );
  }

  const isSelf = Boolean(friendship?.isSelf || session.user.user_id === targetUserId || session.user.userId === targetUserId);
  const isFollowing = Boolean(friendship?.isFollowing);
  const listRows = activeList === "followers" ? followersList : followingList;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {isSelf ? (
          <button
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:scale-[1.02]"
            type="button"
          >
            Edit Profile
          </button>
        ) : (
          <button
            className={
              isFollowing
                ? "rounded-full border border-primary px-6 py-3 text-sm font-semibold text-primary transition hover:border-secondary hover:text-secondary disabled:opacity-60"
                : "rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:scale-[1.02] disabled:opacity-60"
            }
            disabled={status === "loading" || status === "saving"}
            type="button"
            onClick={toggleFollow}
          >
            {status === "loading"
              ? "Checking..."
              : status === "saving"
                ? "Saving..."
                : isFollowing
                  ? "Following"
                  : "Follow"}
          </button>
        )}

        <button
          className="rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary"
          type="button"
          onClick={() => setActiveList("followers")}
        >
          {friendship?.followers ?? 0} followers
        </button>
        <button
          className="rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary"
          type="button"
          onClick={() => setActiveList("following")}
        >
          {friendship?.following ?? 0} following
        </button>
        {message ? <span className="text-sm font-semibold text-secondary">{message}</span> : null}
      </div>

      {activeList ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[rgba(15,18,33,0.58)] px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={activeList === "followers" ? "Followers list" : "Following list"}
          onClick={() => setActiveList(null)}
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-outline-variant/70 bg-white p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Friends</p>
                <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold text-primary">
                  {activeList === "followers" ? "Followers" : "Following"}
                </h2>
              </div>
              <button
                className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-secondary"
                type="button"
                onClick={() => setActiveList(null)}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-full bg-surface-container-low p-1">
              {(["followers", "following"] as const).map((tab) => (
                <button
                  key={tab}
                  className={
                    activeList === tab
                      ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                      : "rounded-full px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-primary"
                  }
                  type="button"
                  onClick={() => setActiveList(tab)}
                >
                  {tab === "followers" ? "Followers" : "Following"}
                </button>
              ))}
            </div>

            <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {listStatus === "loading" ? (
                <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Loading...</p>
              ) : listRows.length === 0 ? (
                <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  {activeList === "followers" ? `${targetName} has no followers yet.` : `${targetName} is not following anyone yet.`}
                </p>
              ) : (
                listRows.map((user) => (
                  <UserRow
                    key={user.user_id || user.userId}
                    canUnfollow={Boolean(friendship?.isSelf && activeList === "following")}
                    isSaving={unfollowingId === (user.user_id || user.userId)}
                    user={user}
                    onUnfollow={unfollowFromList}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
