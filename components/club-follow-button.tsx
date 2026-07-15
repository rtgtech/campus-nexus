"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL, authFetch, readAuthSession, type CampusAuthSession } from "@/lib/auth-client";

type ClubFollowButtonProps = {
  clubSlug: string;
  clubTitle: string;
  initialFollowers: number;
};

type ClubFollowStatus = {
  isFollowing: boolean;
  followers: number;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en").format(Math.max(0, value));
}

export function ClubFollowButton({ clubSlug, clubTitle, initialFollowers }: ClubFollowButtonProps) {
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(initialFollowers);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedSession = readAuthSession();
    setSession(storedSession);

    if (!storedSession) {
      setStatus("idle");
      return;
    }

    const activeSession = storedSession;
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

        setIsFollowing(Boolean((data as ClubFollowStatus).isFollowing));
        setFollowers(Number((data as ClubFollowStatus).followers ?? initialFollowers));
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

      setIsFollowing(Boolean((data as ClubFollowStatus).isFollowing));
      setFollowers(Number((data as ClubFollowStatus).followers ?? followers));
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Club follow failed");
    }
  }

  return (
    <div className="rounded-[28px] border border-surface-container-highest bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Followers</p>
          <p className="mt-2 font-headline-md text-2xl text-on-background">{formatCount(followers)}</p>
        </div>
        <span className="material-symbols-outlined rounded-full bg-primary-fixed p-3 text-primary">favorite</span>
      </div>

      <div className="mt-5">
        {session ? (
          <button
            className={
              isFollowing
                ? "w-full rounded-full border border-primary px-4 py-3 text-sm font-semibold text-primary transition hover:border-secondary hover:text-secondary disabled:opacity-60"
                : "w-full rounded-full bg-secondary px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] transition hover:scale-[1.01] disabled:opacity-60"
            }
            disabled={status === "loading" || status === "saving"}
            type="button"
            onClick={toggleFollow}
          >
            {status === "loading" ? "Checking..." : status === "saving" ? "Saving..." : isFollowing ? "Following" : "Follow club"}
          </button>
        ) : (
          <Link
            href={`/auth?next=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
            className="block w-full rounded-full bg-secondary px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] transition hover:scale-[1.01]"
          >
            Sign in to follow
          </Link>
        )}
        {message ? <p className="mt-3 text-sm font-semibold text-secondary">{message}</p> : null}
        <p className="mt-3 text-xs text-on-surface-variant">Follow {clubTitle} to keep it on your radar.</p>
      </div>
    </div>
  );
}
