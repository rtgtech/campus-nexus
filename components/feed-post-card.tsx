"use client";

import { useState } from "react";
import Link from "next/link";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import { getInitials, type FeedCard } from "@/lib/app-data";

type FeedPostCardProps = {
  post: FeedCard;
};

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

function pluralize(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

function formatPostTime(value?: string) {
  if (!value) {
    return "";
  }

  const parsedTime = new Date(value).getTime();
  if (!Number.isFinite(parsedTime)) {
    return value;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - parsedTime) / 1000));
  if (elapsedSeconds < 60) {
    return "Just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return pluralize(elapsedMinutes, "minute");
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return pluralize(elapsedHours, "hour");
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) {
    return pluralize(elapsedDays, "day");
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) {
    return pluralize(elapsedMonths, "month");
  }

  const elapsedYears = Math.floor(elapsedDays / 365);
  return pluralize(elapsedYears, "year");
}

function profileHref(post: FeedCard) {
  const authorKey = post.author_id || post.authorId || post.author.trim().toLowerCase().replace(/\s+/g, "-");
  return `/${encodeURIComponent(authorKey)}`;
}

export function FeedPostCard({ post }: FeedPostCardProps) {
  const initialLiked =
    post.likedByCurrentUser ?? post.liked_by_current_user ?? post.viewerHasLiked ?? false;
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(readMetricCount(post.likes));
  const [isLikePending, setIsLikePending] = useState(false);
  const mediaUrl = post.mediaUrl || post.image;
  const mediaUrls = post.mediaUrls?.length ? post.mediaUrls : mediaUrl ? [mediaUrl] : [];
  const title = post.title || post.caption || "Untitled post";
  const captionText = post.caption || title;
  const detailText = post.body && post.body !== captionText ? post.body : "";
  const primaryTag = post.hashtags?.[0] || post.tag;
  const hasMedia = mediaUrls.length > 0;
  const authorHref = profileHref(post);
  const postedAt = formatPostTime(post.createdAt || post.meta);
  const commentsCount = readMetricCount(post.comments);
  const sharesCount = readMetricCount(post.shares);
  const isMarketplacePost = post.type === 2;
  const isAnnouncement = post.type === 3;
  const clubHref = post.clubSlug ? `/clubs/${encodeURIComponent(post.clubSlug)}` : null;

  async function handleLike() {
    if (!post.post_id || isLikePending) {
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
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(post.post_id)}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error("Like request failed");
      }

      setLiked(Boolean(data?.liked ?? data?.likedByCurrentUser ?? nextLiked));
      setLikeCount(readMetricCount(data?.likes));
    } catch {
      setLiked(previousLiked);
      setLikeCount(previousLikeCount);
    } finally {
      setIsLikePending(false);
    }
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}${window.location.pathname}${post.post_id ? `#${post.post_id}` : ""}`;
    const shareData = { title, text: detailText || captionText || title, url: shareUrl };

    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }

    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
  }

  return (
    <article
      id={post.post_id}
      className="scroll-mt-24 overflow-hidden rounded-[28px] border border-outline-variant/60 bg-white shadow-[0_16px_40px_rgba(27,27,35,0.08)]"
    >
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={authorHref}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`View ${post.author}'s profile`}
          >
            {getInitials(post.author)}
          </Link>
          <div className="min-w-0">
            <Link
              href={authorHref}
              className="truncate font-semibold text-on-surface outline-none transition hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {post.author}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-on-surface-variant">
              {clubHref ? (
                <Link href={clubHref} className="truncate text-secondary transition hover:text-primary">
                  @{post.clubSlug}
                </Link>
              ) : null}
              {isAnnouncement ? <span className="rounded bg-secondary/10 px-1.5 py-0.5 text-secondary">Announcement</span> : null}
              {postedAt ? <span>{postedAt}</span> : null}
            </div>
          </div>
        </div>
        <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container" type="button">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </div>

      {hasMedia ? (
        <div className={`relative grid overflow-hidden bg-surface-container-low ${mediaUrls.length > 1 ? "grid-cols-2 gap-0.5" : ""}`}>
          {mediaUrls.map((url, index) =>
            isMp4(url) ? (
              <video key={`${url}-${index}`} className={mediaUrls.length > 1 ? "aspect-square h-full w-full object-cover" : "aspect-[4/5] h-full w-full object-cover md:aspect-[5/4]"} controls src={url} />
            ) : (
              <img key={`${url}-${index}`} alt={`${title} ${index + 1}`} className={mediaUrls.length > 1 ? "aspect-square h-full w-full object-cover" : "aspect-[4/5] h-full w-full object-cover md:aspect-[5/4]"} src={url} />
            )
          )}
          {isMarketplacePost || primaryTag ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
              {isMarketplacePost ? (
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur">
                  Marketplace
                </span>
              ) : <span />}
              {isMarketplacePost && post.price ? (
                <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-primary shadow-sm">
                  {post.price}
                </span>
              ) : primaryTag ? (
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                  {primaryTag}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-5 pb-2 pt-1 md:px-6">
          <div className="rounded-[24px] bg-surface-container-low px-5 py-6">
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
            <button
              aria-pressed={liked}
              className="rounded-full p-2 transition hover:bg-surface-container disabled:opacity-60"
              disabled={isLikePending}
              type="button"
              onClick={handleLike}
            >
              <span className={liked ? "material-symbols-outlined text-secondary" : "material-symbols-outlined"}>
                {liked ? "favorite" : "favorite_border"}
              </span>
            </button>
            <button className="rounded-full p-2 transition hover:bg-surface-container" type="button">
              <span className="material-symbols-outlined">chat_bubble_outline</span>
            </button>
            <button className="rounded-full p-2 transition hover:bg-surface-container" type="button" onClick={handleShare}>
              <span className="material-symbols-outlined">repeat</span>
            </button>
            <button className="rounded-full p-2 transition hover:bg-surface-container" type="button" onClick={handleShare}>
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
          <button className="rounded-full p-2 text-on-surface transition hover:bg-surface-container" type="button">
            <span className="material-symbols-outlined">bookmark_add</span>
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-on-surface">
          <span>{formatMetricCount(likeCount)} likes</span>
          <span className="text-on-surface-variant">{formatMetricCount(commentsCount)} comments</span>
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

        <div className="mt-3 flex items-center justify-between border-t border-outline-variant/50 pt-3 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          <button
            className="transition hover:text-primary"
            type="button"
          >
            View discussion
          </button>
          {postedAt ? <span>{postedAt}</span> : <span>Campus Nexus</span>}
        </div>
      </div>
    </article>
  );
}
