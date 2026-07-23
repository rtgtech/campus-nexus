"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EntityListItem, profileEntityHref } from "@/components/entity-list-item";
import { API_BASE_URL, authFetch, type CampusAuthSession, readAuthSession } from "@/lib/auth-client";

type FriendshipUser = {
  userId: string;
  name: string;
  username?: string | null;
  acronym?: string;
  initials?: string;
};

type FriendshipStatus = {
  isFriend: boolean;
  isSelf: boolean;
  friends: number;
  friendsList?: FriendshipUser[];
  mutualsList?: FriendshipUser[];
};

type FriendButtonProps = {
  targetUserId: string;
  targetName: string;
};

type Status = "idle" | "loading" | "saving" | "error";
type ListStatus = "idle" | "loading" | "error";
type FriendsTab = "friends" | "mutuals";

function UserRow({
  canUnfriend,
  isSaving,
  onUnfriend,
  user,
}: {
  canUnfriend: boolean;
  isSaving: boolean;
  onUnfriend: (userId: string) => void;
  user: FriendshipUser;
}) {
  const userId = user.userId;

  return (
    <EntityListItem
      href={profileEntityHref(user)}
      title={user.name}
      subtitle={`@${user.username || userId}`}
      kind="user"
      initials={user.initials || user.acronym}
      className="flex min-w-0 items-center gap-3 rounded-2xl bg-surface-container-low p-3"
      avatarClassName="rounded-full bg-primary-fixed text-primary"
      trailing={
        canUnfriend ? (
          <button
            className="rounded-full border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-secondary hover:text-secondary disabled:opacity-60"
            disabled={isSaving}
            type="button"
            onClick={() => onUnfriend(userId)}
          >
            {isSaving ? "..." : "Unfriend"}
          </button>
        ) : null
      }
    />
  );
}

export function FriendButton({ targetUserId, targetName }: FriendButtonProps) {
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [friendship, setFriendship] = useState<FriendshipStatus | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [listStatus, setListStatus] = useState<ListStatus>("idle");
  const [message, setMessage] = useState("");
  const [showFriends, setShowFriends] = useState(false);
  const [activeTab, setActiveTab] = useState<FriendsTab>("friends");
  const [friendsList, setFriendsList] = useState<FriendshipUser[]>([]);
  const [mutualsList, setMutualsList] = useState<FriendshipUser[]>([]);
  const [unfriendingId, setUnfriendingId] = useState<string | null>(null);

  async function loadFriendship(signal?: AbortSignal) {
    setStatus("loading");
    setMessage("");

    try {
      const response = await authFetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetUserId)}/friends`, { signal });
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

  async function loadFriendLists(signal?: AbortSignal) {
    setListStatus("loading");
    setMessage("");

    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/users/${encodeURIComponent(targetUserId)}/friends?includeLists=true`,
        { signal },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Friends list failed");
      }
      const payload = data as FriendshipStatus;
      setFriendship(payload);
      setFriendsList(Array.isArray(payload.friendsList) ? payload.friendsList : []);
      setMutualsList(Array.isArray(payload.mutualsList) ? payload.mutualsList : []);
      setListStatus("idle");
    } catch (error) {
      if (!signal?.aborted) {
        setListStatus("error");
        setMessage(error instanceof Error ? error.message : "Friends list failed");
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
    loadFriendship(controller.signal);
    return () => controller.abort();
  }, [targetUserId]);

  useEffect(() => {
    if (!showFriends || !session) {
      return;
    }

    const controller = new AbortController();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    loadFriendLists(controller.signal);
    return () => {
      controller.abort();
      document.body.style.overflow = originalOverflow;
    };
  }, [showFriends, session, targetUserId]);

  async function toggleFriendship() {
    if (!session || friendship?.isSelf || status === "saving") {
      return;
    }

    setStatus("saving");
    setMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetUserId)}/friends`, {
        method: friendship?.isFriend ? "DELETE" : "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Friendship action failed");
      }
      setFriendship(data as FriendshipStatus);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Friendship action failed");
    }
  }

  async function unfriendFromList(userId: string) {
    if (!session || !friendship?.isSelf || unfriendingId) {
      return;
    }

    setUnfriendingId(userId);
    setMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/friends`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Unfriend failed");
      }
      await Promise.all([loadFriendship(), loadFriendLists()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unfriend failed");
    } finally {
      setUnfriendingId(null);
    }
  }

  if (!session) {
    const nextPath = typeof window === "undefined" ? "/" : window.location.pathname;
    return (
      <Link
        href={`/auth?next=${encodeURIComponent(nextPath)}`}
        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:scale-[1.02]"
      >
        Sign in to add friends
      </Link>
    );
  }

  const isSelf = Boolean(friendship?.isSelf || session.user.userId === targetUserId);
  const isFriend = Boolean(friendship?.isFriend);
  const activeRows = activeTab === "friends" ? friendsList : mutualsList;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {isSelf ? (
          <button className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:scale-[1.02]" type="button">
            Edit Profile
          </button>
        ) : (
          <button
            className={
              isFriend
                ? "rounded-full border border-primary px-6 py-3 text-sm font-semibold text-primary transition hover:border-secondary hover:text-secondary disabled:opacity-60"
                : "rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:scale-[1.02] disabled:opacity-60"
            }
            disabled={status === "loading" || status === "saving"}
            type="button"
            onClick={toggleFriendship}
          >
            {status === "loading" ? "Checking..." : status === "saving" ? "Saving..." : isFriend ? "Friends" : "Add friend"}
          </button>
        )}

        <button
          className="rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary"
          type="button"
          onClick={() => setShowFriends(true)}
        >
          {friendship?.friends ?? 0} friends
        </button>
        {message ? <span className="text-sm font-semibold text-secondary">{message}</span> : null}
      </div>

      {showFriends ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[rgba(15,18,33,0.58)] px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Friends list"
          onClick={() => setShowFriends(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] border border-outline-variant/70 bg-white p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Profile</p>
                <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold text-primary">Friends</h2>
              </div>
              <button
                className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-secondary"
                type="button"
                aria-label="Close friends list"
                onClick={() => setShowFriends(false)}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {listStatus === "loading" ? (
              <p className="mt-5 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Loading...</p>
            ) : (
              <div className="mt-5">
                <div className="grid grid-cols-2 gap-2 rounded-full bg-surface-container-low p-1" role="tablist" aria-label="Friend lists">
                  {(["friends", "mutuals"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={
                        activeTab === tab
                          ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                          : "rounded-full px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-primary"
                      }
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "friends" ? "Friends" : "Mutuals"}
                    </button>
                  ))}
                </div>

                <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1" role="tabpanel">
                  {activeRows.length ? (
                    activeRows.map((user) => (
                      <UserRow
                        key={user.userId}
                        canUnfriend={Boolean(friendship?.isSelf && activeTab === "friends")}
                        isSaving={unfriendingId === user.userId}
                        user={user}
                        onUnfriend={unfriendFromList}
                      />
                    ))
                  ) : (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                      {activeTab === "friends" ? `${targetName} has no friends yet.` : `You and ${targetName} have no mutual friends yet.`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
