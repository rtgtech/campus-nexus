"use client";

import { useState } from "react";
import Link from "next/link";
import { getInitials, type FeedCard } from "@/lib/app-data";

type FeedPostCardProps = {
  post: FeedCard;
};

function isMp4(url: string) {
  const normalizedUrl = url.toLowerCase().split("?", 1)[0];
  return normalizedUrl.endsWith(".mp4") || normalizedUrl.startsWith("data:video/mp4");
}

function readLikeCount(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  const numericValue = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatLikeLabel(value: number) {
  const formattedValue = new Intl.NumberFormat("en").format(Math.max(0, value));
  return `${formattedValue} ${value === 1 ? "like" : "likes"}`;
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
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(readLikeCount(post.likes));
  const mediaUrl = post.mediaUrl || post.image;
  const title = post.title || post.caption || "Untitled post";
  const body = post.body || post.caption || "";
  const tag = post.hashtags?.[0] || post.tag;
  const hasMedia = Boolean(mediaUrl);
  const authorHref = profileHref(post);
  const postedAt = formatPostTime(post.createdAt || post.meta);

  function handleLike() {
    setLiked((current) => {
      setLikeCount((count) => count + (current ? -1 : 1));
      return !current;
    });
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}${window.location.pathname}${post.post_id ? `#${post.post_id}` : ""}`;
    const shareData = { title, text: body || title, url: shareUrl };

    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }

    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
  }

  return (
    <article
      id={post.post_id}
      className="scroll-mt-24 overflow-hidden rounded-[28px] border border-outline-variant/60 bg-white/85 shadow-[0_12px_30px_rgba(27,27,35,0.06)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <Link
          href={authorHref}
          className="flex min-w-0 items-center gap-3 rounded-2xl outline-none transition hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`View ${post.author}'s profile`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
            {getInitials(post.author)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-on-surface">{post.author}</h3>
            {postedAt ? <p className="truncate text-xs font-semibold text-on-surface-variant">{postedAt}</p> : null}
          </div>
        </Link>
        <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container" type="button">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </div>

      {hasMedia ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-primary md:aspect-[16/10]">
          {isMp4(mediaUrl) ? (
            <video className="h-full w-full object-cover" controls src={mediaUrl} />
          ) : (
            <img alt={title} className="h-full w-full object-cover" src={mediaUrl} />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-[rgba(34,29,92,0.72)] px-6 pb-6 pt-20 text-white">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h4 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight">{title}</h4>
                {body ? <p className="mt-2 max-w-xl text-sm text-white/82">{body}</p> : null}
              </div>
              {tag ? (
                <span className="shrink-0 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                  {tag}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-2 pt-1 md:px-6">
          <div className="rounded-[24px] bg-surface-container-low px-5 py-6">
            <h4 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-primary">{title}</h4>
            {body ? <p className="mt-3 text-sm leading-6 text-on-surface-variant">{body}</p> : null}
            {tag ? (
              <span className="mt-5 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {tag}
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <div className="flex gap-5 text-sm font-semibold text-on-surface-variant">
          <button
            aria-pressed={liked}
            className={liked ? "flex items-center gap-2 text-secondary" : "flex items-center gap-2 hover:text-primary"}
            type="button"
            onClick={handleLike}
          >
            <span className="material-symbols-outlined text-secondary">{liked ? "favorite" : "favorite_border"}</span>
            {formatLikeLabel(likeCount)}
          </button>
          <button className="flex items-center gap-2 hover:text-primary" type="button" onClick={handleShare}>
            <span className="material-symbols-outlined">share</span>
            Share
          </button>
        </div>
      </div>
    </article>
  );
}
