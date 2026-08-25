"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PostDeleteButton } from "@/components/post-delete-button";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import { getInitials, type FeedCard, type PostLikeData, type PostSaveData } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { formatPostTime } from "@/lib/post-time";

type FeedPostCardProps = {
  post: FeedCard;
  onSavedChange?: (postId: string, saved: boolean) => void;
  showDeleteButton?: boolean;
};

type PostSaveEventDetail = {
  postId: string;
  saved: boolean;
};

const POST_SAVE_EVENT = "campus-nexus:post-save-change";

function isMp4(url: string) {
  const normalizedUrl = url.toLowerCase().split("?", 1)[0];
  return normalizedUrl.endsWith(".mp4") || normalizedUrl.startsWith("data:video/mp4");
}

function readMetricCount(value: string | number | undefined) {
  if (value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const numericValue = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatMetricCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`.replace(".0M", "M");
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`.replace(".0K", "K");
  }

  return new Intl.NumberFormat("en").format(Math.max(0, value));
}

function profileHref(post: FeedCard) {
  const authorKey = post.authorId || post.author.trim().toLowerCase().replace(/\s+/g, "-");
  return `/${encodeURIComponent(authorKey)}`;
}

export function FeedPostCard({ post, onSavedChange, showDeleteButton = true }: FeedPostCardProps) {
  const router = useRouter();
  const initialLiked =
    post.likedByCurrentUser ?? post.viewerHasLiked ?? false;
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(readMetricCount(post.likes));
  const [isLikePending, setIsLikePending] = useState(false);
  const [saved, setSaved] = useState(
    post.savedByCurrentUser ?? post.bookmarkedByCurrentUser ?? post.viewerHasSaved ?? false,
  );
  const [isSavePending, setIsSavePending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [now, setNow] = useState(0);
  const mediaUrl = post.mediaUrl || post.image;
  const mediaUrls = post.mediaUrls?.length ? post.mediaUrls : mediaUrl ? [mediaUrl] : [];
  const title = post.title || post.caption || "Untitled post";
  const captionText = post.caption || title;
  const detailText = post.body && post.body !== captionText ? post.body : "";
  const primaryTag = post.hashtags?.[0] || post.tag;
  const hasMedia = mediaUrls.length > 0;
  const authorHref = profileHref(post);
  const postTimestamp = post.createdAt || post.meta;
  const postedAt = now ? formatPostTime(postTimestamp, now) : "";
  const sharesCount = readMetricCount(post.shares);
  const isMarketplacePost = post.type === 2;
  const isAnnouncement = post.type === 3;
  const clubHref = post.clubSlug ? `/clubs/${encodeURIComponent(post.clubSlug)}` : null;

  function openPost() {
    if (!post.postId) return;
    router.push(`/viewpost?=${encodeURIComponent(post.postId)}`);
  }

  useEffect(() => {
    setNow(Date.now());
    // ponytail: one timer per card; hoist a shared clock if feed size makes this measurable.
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleSaveChange(event: Event) {
      const detail = (event as CustomEvent<PostSaveEventDetail>).detail;
      if (!detail || detail.postId !== post.postId) {
        return;
      }
      setSaved(detail.saved);
      onSavedChange?.(detail.postId, detail.saved);
    }

    window.addEventListener(POST_SAVE_EVENT, handleSaveChange);
    return () => window.removeEventListener(POST_SAVE_EVENT, handleSaveChange);
  }, [onSavedChange, post.postId]);

  async function handleLike() {
    if (!post.postId || isLikePending) {
      return;
    }

    const session = readAuthSession();
    if (!session) {
      return;
    }

    const nextLiked = !liked;
    const previousLiked = liked;
    const previousLikeCount = likeCount;

    setIsLikePending(true);
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));

    try {
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(post.postId)}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error("Like request failed");
      }
      const payload = parseApiResponse<PostLikeData>(`/api/posts/${post.postId}/like`, data);
      setLiked(payload.liked);
      setLikeCount(readMetricCount(payload.likes));
    } catch {
      setLiked(previousLiked);
      setLikeCount(previousLikeCount);
    } finally {
      setIsLikePending(false);
    }
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}${window.location.pathname}${post.postId ? `#${post.postId}` : ""}`;
    const shareData = { title, text: detailText || captionText || title, url: shareUrl };

    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }

    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
  }

  async function handleSave() {
    if (!post.postId || isSavePending) {
      return;
    }

    const nextSaved = !saved;
    const previousSaved = saved;
    setIsSavePending(true);
    setSaved(nextSaved);

    try {
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(post.postId)}/save`, {
        method: nextSaved ? "POST" : "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error("Save request failed");
      }
      const payload = parseApiResponse<PostSaveData>(`/api/posts/${post.postId}/save`, data);
      const confirmedSaved = payload.saved;
      setSaved(confirmedSaved);
      window.dispatchEvent(
        new CustomEvent<PostSaveEventDetail>(POST_SAVE_EVENT, {
          detail: { postId: post.postId, saved: confirmedSaved },
        }),
      );
    } catch {
      setSaved(previousSaved);
    } finally {
      setIsSavePending(false);
    }
  }

  function handleDeleted() {
    setDeleted(true);
    router.refresh();
  }

  if (deleted) {
    return null;
  }

  return (
    <Card
      id={post.postId}
      aria-label={post.postId ? `View ${title}` : undefined}
      className={`scroll-mt-24 gap-0 border border-outline-variant/60 bg-white py-0 shadow-[0_16px_40px_rgba(27,27,35,0.08)] ${post.postId ? "cursor-pointer" : ""}`}
      role={post.postId ? "button" : undefined}
      tabIndex={post.postId ? 0 : undefined}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("a, button, video")) openPost();
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          openPost();
        }
      }}
    >
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={authorHref}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary outline-hidden transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`View ${post.author}'s profile`}
          >
            {getInitials(post.author)}
          </Link>
          <div className="min-w-0">
            <Link
              href={authorHref}
              className="truncate font-semibold text-on-surface outline-hidden transition hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {post.author}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-on-surface-variant">
              {clubHref ? (
                <Link href={clubHref} className="truncate text-secondary transition hover:text-primary">
                  @{post.clubSlug}
                </Link>
              ) : null}
              {isAnnouncement ? <Badge className="rounded bg-secondary/10 px-1.5 py-0.5 text-secondary" variant="secondary">Announcement</Badge> : null}
              {postedAt ? <time dateTime={postTimestamp}>{postedAt}</time> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showDeleteButton ? (
            <PostDeleteButton authorId={post.authorId} postId={post.postId} onDeleted={handleDeleted} />
          ) : null}
          <Button
            aria-label="View post"
            className="rounded-full text-on-surface-variant"
            size="icon"
            type="button"
            variant="ghost"
            onClick={openPost}
          >
            <span className="material-symbols-outlined">more_horiz</span>
          </Button>
        </div>
      </div>

      {hasMedia ? (
        <div className={`relative grid overflow-hidden bg-surface-container-low ${mediaUrls.length > 1 ? "grid-cols-2 gap-0.5" : ""}`}>
          {mediaUrls.map((url, index) =>
            isMp4(url) ? (
              <video key={`${url}-${index}`} className={mediaUrls.length > 1 ? "aspect-square h-full w-full object-cover" : "aspect-4/5 h-full w-full object-cover md:aspect-5/4"} controls src={url} />
            ) : (
              <img key={`${url}-${index}`} alt={`${title} ${index + 1}`} className={mediaUrls.length > 1 ? "aspect-square h-full w-full object-cover" : "aspect-4/5 h-full w-full object-cover md:aspect-5/4"} src={url} />
            )
          )}
          {isMarketplacePost || primaryTag ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
              {isMarketplacePost ? (
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-sm">
                  Marketplace
                </span>
              ) : <span />}
              {isMarketplacePost && post.price ? (
                <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-primary shadow-xs">
                  {post.price}
                </span>
              ) : primaryTag ? (
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                  {primaryTag}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-5 pb-2 pt-1 md:px-6">
          <div className="rounded-[10px] bg-surface-container-low px-5 py-6">
            <p className="text-lg font-semibold leading-8 text-on-surface">{captionText}</p>
            {detailText ? <p className="mt-3 text-sm leading-6 text-on-surface-variant">{detailText}</p> : null}
            {primaryTag ? (
              <span className="mt-5 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {primaryTag}
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-4 md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-on-surface">
            <Button
              aria-pressed={liked}
              aria-label={liked ? "Unlike post" : "Like post"}
              className="rounded-full"
              disabled={isLikePending}
              size="icon"
              type="button"
              variant="ghost"
              onClick={handleLike}
            >
              <span className={liked ? "material-symbols-outlined text-secondary" : "material-symbols-outlined"}>
                {liked ? "favorite" : "favorite_border"}
              </span>
            </Button>
            {!isAnnouncement ? (
              <Button aria-label="Repost" className="rounded-full" size="icon" type="button" variant="ghost" onClick={handleShare}>
                <span className="material-symbols-outlined">repeat</span>
              </Button>
            ) : null}
            <Button aria-label="Share post" className="rounded-full" size="icon" type="button" variant="ghost" onClick={handleShare}>
              <span className="material-symbols-outlined">send</span>
            </Button>
            {isAnnouncement ? (
              post.registrationLink ? (
                <a
                  aria-label="Apply for announcement"
                  className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-outline-variant bg-white px-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-low"
                  href={post.registrationLink}
                >
                  <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                  Apply
                </a>
              ) : (
                <Button aria-label="Application link unavailable" className="ml-1 rounded-[3px]" disabled type="button" variant="outline">
                  <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                  Apply
                </Button>
              )
            ) : null}
          </div>
          {!isAnnouncement ? (
            <Button
              aria-label={saved ? "Unsave post" : "Save post"}
              aria-pressed={saved}
              className={saved ? "rounded-full text-secondary" : "rounded-full text-on-surface"}
              disabled={isSavePending}
              size="icon"
              type="button"
              variant="ghost"
              onClick={handleSave}
            >
              <span className="material-symbols-outlined">{saved ? "bookmark" : "bookmark_add"}</span>
            </Button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-on-surface">
          <span>{formatMetricCount(likeCount)} likes</span>
          <span className="text-on-surface-variant">{formatMetricCount(sharesCount)} shares</span>
        </div>

        <div className="mt-3 space-y-2 text-sm leading-6 text-on-surface">
          <p>
            <Link href={authorHref} className="mr-2 font-semibold transition hover:text-primary">
              {post.author}
            </Link>
            <span className="text-on-surface">{captionText}</span>
          </p>
          {detailText ? <p className="text-on-surface-variant">{detailText}</p> : null}
          {post.hashtags && post.hashtags.length > 0 ? (
            <p className="flex flex-wrap gap-x-2 gap-y-1 text-secondary">
              {post.hashtags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
