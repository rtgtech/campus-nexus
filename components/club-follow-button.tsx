"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { API_BASE_URL, authFetch, readAuthSession, type CampusAuthSession } from "@/lib/auth-client";
import type { ClubFollowStatus } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { cn } from "@/lib/utils";

type ClubFollowButtonProps = {
  clubSlug: string;
  clubTitle: string;
  initialFollowers?: number;
  layout?: "card" | "button" | "inline";
  onFollowersChange?: (followers: number) => void;
};

function formatCount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en").format(Math.max(0, value));
}

export function ClubFollowButton({
  clubSlug,
  clubTitle,
  initialFollowers,
  layout = "card",
  onFollowersChange,
}: ClubFollowButtonProps) {
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState<number | null>(initialFollowers ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  function commitFollowers(value: number) {
    const nextFollowers = Math.max(0, value);
    setFollowers(nextFollowers);
    onFollowersChange?.(nextFollowers);
  }

  useEffect(() => {
    const storedSession = readAuthSession();
    setSession(storedSession);

    if (!storedSession) {
      setStatus("idle");
      return;
    }

    const controller = new AbortController();

    async function loadStatus() {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(clubSlug)}/follow`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Club follow status failed");
        }

        const payload = parseApiResponse<ClubFollowStatus>(`/api/clubs/${clubSlug}/follow`, data);
        setIsFollowing(Boolean(payload.isFollowing));
        commitFollowers(Number(payload.followers ?? initialFollowers ?? 0));
        setStatus("idle");
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Club follow status failed");
        }
      }
    }

    loadStatus();

    return () => controller.abort();
    // onFollowersChange is intentionally excluded: callers may pass a render-local callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubSlug, initialFollowers]);

  async function toggleFollow() {
    if (!session || status === "saving") {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await authFetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(clubSlug)}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Club follow failed");
      }

      const payload = parseApiResponse<ClubFollowStatus>(`/api/clubs/${clubSlug}/follow`, data);
      setIsFollowing(Boolean(payload.isFollowing));
      commitFollowers(Number(payload.followers ?? followers ?? 0));
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Club follow failed");
    }
  }

  const compact = layout !== "card";
  const action = session ? (
    <Button
      className={cn(
        compact ? "h-9 rounded-[8px] border-[#d6d6d0] px-4 text-xs font-bold" : "h-11 w-full rounded-full px-4",
        compact && !isFollowing && "border-[#171717] bg-[#171717] text-white hover:bg-[#353532]",
        compact && isFollowing && "bg-white text-[#5f5f59] hover:bg-[#f1f1ed] hover:text-[#171717]",
        !compact && !isFollowing && "bg-secondary text-white hover:bg-secondary/90",
      )}
      disabled={status === "loading" || status === "saving"}
      type="button"
      variant={isFollowing ? "outline" : "default"}
      onClick={toggleFollow}
    >
      {status === "loading" ? "Checking…" : status === "saving" ? "Saving…" : isFollowing ? "Following" : "Follow"}
    </Button>
  ) : (
    <Link
      href={`/auth?next=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
      className={cn(
        buttonVariants(),
        compact
          ? "h-9 rounded-[8px] bg-[#171717] px-4 text-xs font-bold text-white hover:bg-[#353532]"
          : "h-11 w-full rounded-full bg-secondary px-4 text-white hover:bg-secondary/90",
      )}
    >
      Sign in to follow
    </Link>
  );

  if (layout === "button") {
    return (
      <div>
        {action}
        {message ? <span className="sr-only" role="status">{message}</span> : null}
      </div>
    );
  }

  if (layout === "inline") {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-[11px] text-[#686862]">{formatCount(followers)} followers</span>
        {action}
        {message ? <span className="sr-only" role="status">{message}</span> : null}
      </div>
    );
  }

  return (
    <Card className="rounded-[10px] border border-surface-container-highest bg-white py-0 shadow-xs">
      <CardHeader className="flex-row items-start justify-between gap-4 p-5 pb-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Followers</p>
          <p className="mt-2 font-headline-md text-2xl text-on-background">{formatCount(followers)}</p>
        </div>
        <span className="material-symbols-outlined rounded-full bg-primary-fixed p-3 text-primary">favorite</span>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        {action}
        {message ? <p className="mt-3 text-sm font-semibold text-secondary">{message}</p> : null}
        <p className="mt-3 text-xs text-on-surface-variant">Follow {clubTitle} to keep it on your radar.</p>
      </CardContent>
    </Card>
  );
}
