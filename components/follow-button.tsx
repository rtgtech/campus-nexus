"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EntityListItem, profileEntityHref } from "@/components/entity-list-item";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL, authFetch, type CampusAuthSession, readAuthSession } from "@/lib/auth-client";
import type { FriendshipStatus, FriendshipUser } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { cn } from "@/lib/utils";

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
          <Button
            className="rounded-full border-outline-variant px-3 text-xs text-on-surface-variant hover:border-secondary hover:text-secondary"
            disabled={isSaving}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => onUnfriend(userId)}
          >
            {isSaving ? "..." : "Unfriend"}
          </Button>
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
      setFriendship(parseApiResponse<FriendshipStatus>(`/api/users/${targetUserId}/friends`, data));
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
      const payload = parseApiResponse<FriendshipStatus>(`/api/users/${targetUserId}/friends?includeLists=true`, data);
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
    loadFriendLists(controller.signal);
    return () => controller.abort();
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
      setFriendship(parseApiResponse<FriendshipStatus>(`/api/users/${targetUserId}/friends`, data));
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
      parseApiResponse<FriendshipStatus>(`/api/users/${userId}/friends`, data);
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
        className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
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
          <Button className="rounded-full px-6" size="lg" type="button">
            Edit Profile
          </Button>
        ) : (
          <Button
            className="rounded-full px-6"
            disabled={status === "loading" || status === "saving"}
            size="lg"
            type="button"
            variant={isFriend ? "outline" : "default"}
            onClick={toggleFriendship}
          >
            {status === "loading" ? "Checking..." : status === "saving" ? "Saving..." : isFriend ? "Friends" : "Add friend"}
          </Button>
        )}

        <Button
          className="rounded-full px-4"
          size="lg"
          type="button"
          variant="outline"
          onClick={() => setShowFriends(true)}
        >
          {friendship?.friends ?? 0} friends
        </Button>
        {message ? <span className="text-sm font-semibold text-secondary">{message}</span> : null}
      </div>

      <Dialog open={showFriends} onOpenChange={setShowFriends}>
        <DialogContent className="max-w-2xl rounded-[10px] p-5">
          <DialogHeader>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Profile</p>
            <DialogTitle className="font-sans text-2xl font-bold text-on-background">Friends</DialogTitle>
            <DialogDescription className="sr-only">Friends and mutual friends for {targetName}</DialogDescription>
          </DialogHeader>
            {listStatus === "loading" ? (
              <p className="mt-5 flex items-center gap-2 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <Spinner /> Loading...
              </p>
            ) : (
              <Tabs className="mt-5" value={activeTab} onValueChange={(value) => setActiveTab(value as FriendsTab)}>
                <TabsList className="grid w-full grid-cols-2 rounded-full">
                  <TabsTrigger className="rounded-full" value="friends">Friends</TabsTrigger>
                  <TabsTrigger className="rounded-full" value="mutuals">Mutuals</TabsTrigger>
                </TabsList>
                <TabsContent value={activeTab}>
                  <ScrollArea className="mt-3 max-h-[55vh]">
                    <div className="space-y-3 pr-3">
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
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
