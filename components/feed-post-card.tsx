"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bookmark, Heart, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import { PostComments } from "@/components/post-comments";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PostDeleteButton } from "@/components/post-delete-button";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import { getInitials, type FeedCard, type PostLikeData, type PostSaveData } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { PostTime } from "@/components/post-time";
import { cn } from "@/lib/utils";

const POST_SAVE_EVENT = "campus-nexus:post-save-change";
const explanations: Record<string, string> = {
  network: "From a friend or a club you follow.",
  recent: "A recent update from your campus.",
  interests: "Related to authors, clubs, or topics you have spent time with.",
  "campus-engagement": "A post your campus is responding to.",
  "campus-discovery": "Something to discover beyond your usual network.",
};

function count(value: string | number | undefined) {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function FeedPostCard({ post, onSavedChange, showDeleteButton = true, onExclude, onOpen, detail = false, fitViewport = false }: {
  post: FeedCard;
  onSavedChange?: (postId: string, saved: boolean) => void;
  showDeleteButton?: boolean;
  onExclude?: (target: string) => void;
  onOpen?: () => void;
  detail?: boolean;
  fitViewport?: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByCurrentUser ?? post.viewerHasLiked ?? false);
  const [likes, setLikes] = useState(count(post.likes));
  const [saved, setSaved] = useState(post.savedByCurrentUser ?? post.bookmarkedByCurrentUser ?? post.viewerHasSaved ?? false);
  const [pending, setPending] = useState<"like" | "save" | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [status, setStatus] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(count(post.comments));
  const title = post.caption || post.title || "Campus update";
  const body = post.body && post.body !== title ? post.body : "";
  const authorHref = "/" + encodeURIComponent(post.authorId || post.author.trim().toLowerCase().replace(/\s+/g, "-"));
  const postHref = "/viewpost?=" + encodeURIComponent(post.postId || "");
  const media = post.mediaUrls?.length ? post.mediaUrls : (post.mediaUrl || post.image) ? [post.mediaUrl || post.image] : [];
  const announcement = post.type === 3;

  useEffect(() => {
    setLiked(post.likedByCurrentUser ?? post.viewerHasLiked ?? false);
    setLikes(count(post.likes));
    setSaved(post.savedByCurrentUser ?? post.bookmarkedByCurrentUser ?? post.viewerHasSaved ?? false);
  }, [post.likedByCurrentUser, post.viewerHasLiked, post.likes, post.savedByCurrentUser, post.bookmarkedByCurrentUser, post.viewerHasSaved]);
  useEffect(() => {
    setCommentsOpen(false);
  }, [post.postId]);
  useEffect(() => {
    function changed(event: Event) {
      const detail = (event as CustomEvent<{ postId: string; saved: boolean }>).detail;
      if (detail?.postId === post.postId) { setSaved(detail.saved); onSavedChange?.(detail.postId, detail.saved); }
    }
    window.addEventListener(POST_SAVE_EVENT, changed);
    return () => window.removeEventListener(POST_SAVE_EVENT, changed);
  }, [post.postId, onSavedChange]);

  async function react(kind: "like" | "save") {
    if (!post.postId || pending) return;
    if (!readAuthSession()) { setStatus("Sign in to " + kind + " this post."); return; }
    const previous = kind === "like" ? liked : saved;
    const previousCount = likes;
    setPending(kind);
    setStatus("");
    if (kind === "like") { setLiked(!previous); setLikes(Math.max(0, likes + (previous ? -1 : 1))); }
    else setSaved(!previous);
    try {
      const path = "/api/posts/" + encodeURIComponent(post.postId) + "/" + kind;
      const response = await authFetch(API_BASE_URL + path, { method: previous ? "DELETE" : "POST" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (kind === "like") {
        const payload = parseApiResponse<PostLikeData>(path, data);
        setLiked(payload.liked); setLikes(count(payload.likes));
      } else {
        const payload = parseApiResponse<PostSaveData>(path, data);
        setSaved(payload.saved);
        window.dispatchEvent(new CustomEvent(POST_SAVE_EVENT, { detail: { postId: post.postId, saved: payload.saved } }));
        setStatus(payload.saved ? "Post saved." : "Post removed from saved.");
      }
    } catch {
      if (kind === "like") { setLiked(previous); setLikes(previousCount); } else setSaved(previous);
      setStatus("We couldn't " + kind + " this post. Please try again.");
    } finally { setPending(null); }
  }
  async function share() {
    try {
      const url = window.location.origin + postHref;
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); setStatus("Post link copied."); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setStatus("Sharing failed. Open the post and copy its address.");
    }
  }
  function exclude(target: string) { setMenuOpen(false); onExclude?.(target); }
  if (deleted) return null;
  return <article id={post.postId} className={cn("relative scroll-mt-24 overflow-hidden rounded border border-border bg-white", fitViewport && "flex h-full min-h-0 flex-col")}>
    <div className={cn(fitViewport && "flex min-h-0 flex-1 flex-col")} aria-hidden={commentsOpen || undefined} inert={commentsOpen || undefined}>
    <header className={cn("flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6", fitViewport && "shrink-0")}>
      <div className="flex min-w-0 items-center gap-3">
        <Link href={authorHref} aria-label={"View " + post.author + "'s profile"} className="flex size-11 shrink-0 items-center justify-center rounded bg-accent text-sm font-semibold text-primary">{getInitials(post.author)}</Link>
        <div className="min-w-0"><Link href={authorHref} className="block truncate text-sm font-semibold hover:underline">{post.author}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {post.clubSlug && <Link href={"/clubs/" + encodeURIComponent(post.clubSlug)} className="text-primary hover:underline">{post.clubName || post.clubSlug}</Link>}
            {announcement && <span className="font-medium text-primary">Announcement</span>}
            <PostTime value={post.createdAt || post.meta} />
          </div>
        </div>
      </div>
      <div className="flex items-center">
        {showDeleteButton && <PostDeleteButton authorId={post.authorId} postId={post.postId} onDeleted={() => { setDeleted(true); router.refresh(); }} />}
        {post.explanationCode && <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Post options"><MoreHorizontal size={20} /></Button>} />
          <PopoverContent className="w-72 p-4" align="end"><h3 className="text-sm font-semibold">Why this post?</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{explanations[post.explanationCode] || explanations.recent}</p>
            {onExclude && <div className="mt-3 grid gap-1 border-t pt-2">
              <Button variant="ghost" className="justify-start" onClick={() => exclude("post:" + post.postId)}>Not interested</Button>
              {post.authorId && <Button variant="ghost" className="justify-start" onClick={() => exclude("author:" + post.authorId)}>Mute this author</Button>}
              {post.clubId != null && <Button variant="ghost" className="justify-start" onClick={() => exclude("club:" + post.clubId)}>Mute this club</Button>}
            </div>}
          </PopoverContent>
        </Popover>}
      </div>
    </header>
    <div className={cn("px-5 pb-4 sm:px-6", fitViewport && (media.length ? "max-h-[30%] shrink-0 overflow-hidden" : "min-h-0 flex-1 overflow-hidden"))}>
      {detail ? <p className="whitespace-pre-wrap break-words text-base leading-7">{title}</p> : <Link href={postHref} onClick={onOpen} className="block whitespace-pre-wrap break-words text-base leading-7 hover:underline" aria-label={"Open post: " + title}>{title}</Link>}
      {body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{body}</p>}
      {post.price && <p className="mt-2 text-lg font-semibold text-primary">{post.price}</p>}
    </div>
    {media.length > 0 && <div className={cn(media.length > 1 ? "grid grid-cols-2 gap-px bg-muted" : "bg-muted", fitViewport && "min-h-0 flex-1 overflow-hidden")}>
      {media.map((url, index) => /\.mp4(?:\?|$)|^data:video\/mp4/i.test(url) ?
        <video key={url + index} controls preload="metadata" className={cn("max-h-[540px] w-full object-contain", fitViewport && "h-full max-h-full")} src={url} /> :
        detail ? <img key={url + index} src={url} alt={title} className={cn("max-h-[540px] w-full object-contain", fitViewport && "h-full max-h-full")} /> : <Link key={url + index} href={postHref} onClick={onOpen} aria-label="View post media"><img src={url} alt={title + (media.length > 1 ? " — image " + (index + 1) : "")} loading="lazy" className="max-h-[540px] w-full object-contain" /></Link>)}
    </div>}
    <footer className={cn("px-4 pb-4 pt-2 sm:px-5", fitViewport && "shrink-0")}>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <Button variant="ghost" disabled={pending !== null} aria-label={liked ? "Unlike post" : "Like post"} aria-pressed={liked} onClick={() => void react("like")}><Heart size={19} className={liked ? "fill-secondary text-secondary" : ""} /><span>{new Intl.NumberFormat("en", { notation: "compact" }).format(likes)}</span></Button>
          {post.postId && <Button variant="ghost" aria-label="Comments" aria-expanded={commentsOpen} onClick={() => setCommentsOpen((open) => !open)}><MessageCircle size={19} /><span>{commentsCount}</span></Button>}
          {!detail && <Link href={postHref} onClick={onOpen} aria-label="Open post" className="flex size-11 items-center justify-center rounded text-sm hover:bg-muted"><ArrowUpRight size={19} aria-hidden="true" /></Link>}
          <Button variant="ghost" size="icon" aria-label="Share post" onClick={() => void share()}><Share2 size={19} /></Button>
        </div>
        {announcement ? post.registrationLink && <a href={post.registrationLink} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-primary">Apply <ArrowUpRight size={17} /></a> :
          <Button variant="ghost" size="icon" disabled={pending !== null} aria-label={saved ? "Unsave post" : "Save post"} aria-pressed={saved} onClick={() => void react("save")}><Bookmark size={19} className={saved ? "fill-primary text-primary" : ""} /></Button>}
      </div>
      {status && <p role="status" className="mt-2 px-1 text-sm text-muted-foreground">{status}</p>}
    </footer>
    </div>
    {commentsOpen && post.postId && <PostComments postId={post.postId} onCountChange={setCommentsCount} onClose={() => setCommentsOpen(false)} />}
  </article>;
}
