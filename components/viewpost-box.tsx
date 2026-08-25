"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PostDeleteButton } from "@/components/post-delete-button";
import { API_BASE_URL, authFetch } from "@/lib/auth-client";
import { getInitials, type FeedCard, type PostLikeData } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";

type ViewPostBoxProps = {
  postId: string;
  returnHref?: string;
};

export function ViewPostRoute({ returnHref }: { returnHref?: string }) {
  const searchParams = useSearchParams();
  const postId = searchParams.get("") || "";
  if (!postId) return null;
  return <ViewPostBox postId={postId} returnHref={returnHref} />;
}

function isMp4(url: string) {
  const normalizedUrl = url.toLowerCase().split("?", 1)[0];
  return normalizedUrl.endsWith(".mp4") || normalizedUrl.startsWith("data:video/mp4");
}

function count(value: string | number | undefined) {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function ViewPostBox({ postId, returnHref }: ViewPostBoxProps) {
  const router = useRouter();
  const [post, setPost] = useState<FeedCard | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Post not found");
        return parseApiResponse<FeedCard>(`/api/posts/${postId}`, await response.json());
      })
      .then((data) => {
        if (!active) return;
        setPost(data);
        setLiked(Boolean(data.likedByCurrentUser ?? data.viewerHasLiked));
        setLikeCount(count(data.likes));
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [postId]);

  function close() {
    if (returnHref) {
      router.replace(returnHref);
      return;
    }
    router.back();
  }

  async function toggleLike() {
    if (!post) return;
    const nextLiked = !liked;
    const previousCount = likeCount;
    setLiked(nextLiked);
    setLikeCount((current) => Math.max(0, current + (nextLiked ? 1 : -1)));
    try {
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Like request failed");
      const payload = parseApiResponse<PostLikeData>(`/api/posts/${postId}/like`, data);
      setPost(payload.post);
      setLiked(payload.liked);
      setLikeCount(payload.likes);
      return;
    } catch {
      // Restore the optimistic state below.
    }
    setLiked(!nextLiked);
    setLikeCount(previousCount);
    setMessage("Sign in to like posts.");
  }

  async function sharePost() {
    if (!post) return;
    const url = `${window.location.origin}/viewpost?=${encodeURIComponent(postId)}`;
    const data = { title: post.title || post.caption || "Campus Nexus post", text: post.caption || post.body, url };
    if (navigator.share) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setMessage("Post link copied.");
  }

  function handleDeleted() {
    close();
    router.refresh();
  }

  const mediaUrl = post?.mediaUrl || post?.image || "";
  const mediaUrls = post?.mediaUrls?.length ? post.mediaUrls : mediaUrl ? [mediaUrl] : [];
  const title = post?.title || post?.caption || "Post";
  const caption = post?.caption || post?.body || title;
  const isAnnouncement = post?.type === 3;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="h-[calc(100dvh-2rem)] max-h-[840px] max-w-[50.4rem] overflow-hidden rounded-[10px] border-white/60 bg-white/92 p-0 shadow-[0_28px_100px_rgba(15,18,33,0.3)] backdrop-blur-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">Detailed post view</DialogDescription>

        <Button
          aria-label="Close post"
          className="absolute right-4 top-4 z-30 rounded-full border border-white/70 bg-white/60 text-on-surface shadow-sm backdrop-blur-md hover:bg-white/85"
          size="icon"
          type="button"
          variant="ghost"
          onClick={close}
        >
          <span className="material-symbols-outlined">close</span>
        </Button>

        {status === "loading" ? (
          <div className="grid h-full place-items-center text-sm font-semibold text-on-surface-variant">Loading post...</div>
        ) : status === "error" || !post ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <span className="material-symbols-outlined text-4xl text-secondary">error</span>
              <p className="mt-3 font-semibold text-on-surface">This post could not be loaded.</p>
            </div>
          </div>
        ) : (
          <article className="relative flex h-full min-h-0 flex-col">
            <PostDeleteButton
              authorId={post.authorId}
              className="absolute right-16 top-4 z-30 bg-white/70 backdrop-blur-md"
              postId={post.postId}
              onDeleted={handleDeleted}
            />
            <header className="flex items-center gap-3 px-5 pb-3 pt-5 pr-20 md:px-7 md:pt-6">
              <Link
                href={`/${encodeURIComponent(post.authorId || post.author)}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary"
              >
                {getInitials(post.author)}
              </Link>
              <div className="min-w-0">
                <p className="truncate font-semibold text-on-surface">{post.author}</p>
                <p className="truncate text-xs font-semibold text-on-surface-variant">
                  {post.clubSlug ? `@${post.clubSlug}` : "Campus Nexus"}
                </p>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-24 md:px-7">
              {mediaUrls.length ? (
                <div className={`grid h-full min-h-0 min-w-0 place-items-center overflow-hidden rounded-[10px] bg-black ${mediaUrls.length > 1 ? "grid-cols-2 gap-px" : ""}`}>
                  {mediaUrls.map((url, index) =>
                    isMp4(url) ? (
                      <video key={`${url}-${index}`} className="h-full min-h-0 w-full min-w-0 object-contain" controls src={url} />
                    ) : (
                      <img key={`${url}-${index}`} alt={`${title} ${index + 1}`} className="h-full min-h-0 w-full min-w-0 object-contain" src={url} />
                    ),
                  )}
                </div>
              ) : (
                <div className="grid h-full place-items-center rounded-[10px] bg-surface-container-low p-8 text-center">
                  <p className="max-w-2xl font-['Space_Grotesk'] text-2xl font-bold leading-relaxed text-primary md:text-4xl">
                    {caption}
                  </p>
                </div>
              )}
            </div>

            {message ? (
              <p className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-on-surface/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
                {message}
              </p>
            ) : null}

            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/70 bg-white/62 px-2 py-1.5 shadow-[0_14px_40px_rgba(15,18,33,0.22)] backdrop-blur-xl">
              <Button aria-label={liked ? "Unlike post" : "Like post"} aria-pressed={liked} className="rounded-full" size="icon" type="button" variant="ghost" onClick={toggleLike}>
                <span className={liked ? "material-symbols-outlined text-secondary" : "material-symbols-outlined"}>
                  {liked ? "favorite" : "favorite_border"}
                </span>
              </Button>
              <span className="mr-1 text-xs font-bold text-on-surface">{likeCount}</span>
              {!isAnnouncement ? (
                <Button aria-label="Repost" className="rounded-full" size="icon" type="button" variant="ghost" onClick={sharePost}>
                  <span className="material-symbols-outlined">repeat</span>
                </Button>
              ) : null}
              <Button aria-label="Share post" className="rounded-full" size="icon" type="button" variant="ghost" onClick={sharePost}>
                <span className="material-symbols-outlined">send</span>
              </Button>
              {isAnnouncement ? (
                post.registrationLink ? (
                  <a className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-outline-variant bg-white px-2.5 text-sm font-medium" href={post.registrationLink}>
                    <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                    Apply
                  </a>
                ) : (
                  <Button className="rounded-[3px]" disabled type="button" variant="outline">
                    <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                    Apply
                  </Button>
                )
              ) : null}
            </div>
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
