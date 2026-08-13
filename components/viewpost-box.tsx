"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, authFetch } from "@/lib/auth-client";
import { getInitials, type FeedCard } from "@/lib/app-data";

type CommentItem = {
  commentId: string;
  userId: string;
  author: string;
  username: string;
  content: string;
  createdAt: string;
};

type ViewPostBoxProps = {
  postId: string;
  initialCommentsOpen?: boolean;
  returnHref?: string;
};

export function ViewPostRoute({ returnHref }: { returnHref?: string }) {
  const searchParams = useSearchParams();
  const postId = searchParams.get("") || "";
  if (!postId) return null;
  return <ViewPostBox postId={postId} initialCommentsOpen={searchParams.get("comments") === "1"} returnHref={returnHref} />;
}

function isMp4(url: string) {
  const normalizedUrl = url.toLowerCase().split("?", 1)[0];
  return normalizedUrl.endsWith(".mp4") || normalizedUrl.startsWith("data:video/mp4");
}

function count(value: string | number | undefined) {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function ViewPostBox({ postId, initialCommentsOpen = false, returnHref }: ViewPostBoxProps) {
  const router = useRouter();
  const [post, setPost] = useState<FeedCard | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const [comment, setComment] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Post not found");
        return (await response.json()) as FeedCard;
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

  useEffect(() => {
    if (!commentsOpen) return;
    authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Comments unavailable");
        return (await response.json()) as { items?: CommentItem[] };
      })
      .then((data) => setComments(Array.isArray(data.items) ? data.items : []))
      .catch(() => setMessage("Comments could not be loaded."));
  }, [commentsOpen, postId]);

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
      if (response.ok) return;
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

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = comment.trim();
    if (!content) return;
    try {
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Comment could not be posted.");
        return;
      }
      if (data.comment) setComments((current) => [...current, data.comment as CommentItem]);
      setPost((current) => (current ? { ...current, comments: data.comments ?? count(current.comments) + 1 } : current));
      setComment("");
      setMessage("");
    } catch {
      setMessage("Comment could not be posted.");
    }
  }

  const mediaUrl = post?.mediaUrl || post?.image || "";
  const mediaUrls = post?.mediaUrls?.length ? post.mediaUrls : mediaUrl ? [mediaUrl] : [];
  const title = post?.title || post?.caption || "Post";
  const caption = post?.caption || post?.body || title;

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

            {commentsOpen ? (
              <section className="absolute bottom-24 left-4 right-4 z-20 mx-auto flex max-h-[68%] max-w-xl flex-col rounded-[10px] border border-white/70 bg-white/78 p-4 shadow-[0_22px_70px_rgba(15,18,33,0.28)] backdrop-blur-xl md:p-5">
                <span aria-hidden className="absolute -bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 border-b border-r border-white/70 bg-white/78" />
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-['Space_Grotesk'] text-lg font-bold text-primary">Comments</h2>
                  <Button aria-label="Close comments" className="rounded-full bg-white/50" size="icon-sm" type="button" variant="ghost" onClick={() => setCommentsOpen(false)}>
                    <span className="material-symbols-outlined text-lg">close</span>
                  </Button>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {comments.length ? comments.map((item) => (
                    <div key={item.commentId} className="flex gap-3 rounded-2xl bg-white/70 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                        {getInitials(item.author)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface">{item.author}</p>
                        <p className="mt-1 break-words text-sm leading-5 text-on-surface-variant">{item.content}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="py-6 text-center text-sm font-semibold text-on-surface-variant">No comments yet.</p>
                  )}
                </div>
                <form className="mt-3 flex items-end gap-2 border-t border-outline-variant/50 pt-3" onSubmit={submitComment}>
                  <Textarea
                    aria-label="Write a comment"
                    className="min-h-10 resize-none rounded-2xl bg-white/70"
                    maxLength={1000}
                    placeholder="Write a comment..."
                    rows={1}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <Button aria-label="Post comment" className="shrink-0 rounded-full bg-secondary text-white" disabled={!comment.trim()} size="icon" type="submit">
                    <span className="material-symbols-outlined">send</span>
                  </Button>
                </form>
              </section>
            ) : null}

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
              <Button aria-label="View comments" className="rounded-full" size="icon" type="button" variant="ghost" onClick={() => setCommentsOpen(true)}>
                <span className="material-symbols-outlined">chat_bubble_outline</span>
              </Button>
              <Button aria-label="Repost" className="rounded-full" size="icon" type="button" variant="ghost" onClick={sharePost}>
                <span className="material-symbols-outlined">repeat</span>
              </Button>
              <Button aria-label="Share post" className="rounded-full" size="icon" type="button" variant="ghost" onClick={sharePost}>
                <span className="material-symbols-outlined">send</span>
              </Button>
            </div>
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
