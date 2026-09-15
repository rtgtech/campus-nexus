"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Plus } from "lucide-react";
import { FeedPostCard } from "@/components/feed-post-card";
import { FeedPreferences } from "@/components/feed-preferences";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { authFetch, API_BASE_URL } from "@/lib/auth-client";
import { parseApiResponse } from "@/lib/api-response-contract";
import type { FeedData } from "@/lib/app-data";

type ViewingEvent = { postId: string; kind: "impression" | "open" | "dwell"; duration?: number };

export function FeedWorkspace({ initial, initialError, mode, signedIn }: {
  initial: FeedData; initialError: string | null; mode: "for-you" | "latest"; signedIn: boolean;
}) {
  const [feed, setFeed] = useState(initial);
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const queue = useRef<ViewingEvent[]>([]);
  const flushRef = useRef<() => void>(() => {});
  const canTrack = signedIn && feed.personalizationEnabled === true;

  async function load(reset = false) {
    if (pending) return;
    setPending(true);
    try {
      const query = new URLSearchParams({ mode, limit: "20" });
      if (!reset && feed.nextCursor) query.set("cursor", feed.nextCursor);
      const response = await authFetch(`${API_BASE_URL}/api/feed?${query}`);
      if (!response.ok) throw new Error(response.status === 410 ? "This feed has expired. Refresh to see new posts." : "We couldn't load your feed. Please try again.");
      const next = parseApiResponse<FeedData>("/api/feed", await response.json());
      setFeed((current) => ({ ...next, feedCards: reset ? next.feedCards : [...current.feedCards, ...next.feedCards.filter((post) => !current.feedCards.some((old) => old.postId === post.postId))] }));
      setError(null);
      if (reset) { setHidden([]); queue.current = []; }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Feed unavailable."); }
    finally { setPending(false); }
  }

  useEffect(() => {
    if (!canTrack || !feed.snapshotId || !root.current) return;
    const visible = new Map<string, number>();
    const impressed = new Set<string>();
    const dwelled = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.feedPost;
        if (!id) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visible.set(id, performance.now());
        else visible.delete(id);
      }
    }, { threshold: [0, 0.5] });
    root.current.querySelectorAll("[data-feed-post]").forEach((element) => observer.observe(element));
    function flush() {
      if (!queue.current.length) return;
      const events = queue.current.splice(0, 50);
      void authFetch(`${API_BASE_URL}/api/feed/events`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: feed.snapshotId, events }), keepalive: true }).catch(() => undefined);
    }
    flushRef.current = flush;
    const tick = window.setInterval(() => {
      if (document.hidden || document.querySelector('[role="dialog"]')) {
        for (const id of visible.keys()) visible.set(id, performance.now());
        return;
      }
      for (const [postId, since] of visible) {
        const seconds = Math.min(30, (performance.now() - since) / 1000);
        if (seconds >= 1 && !impressed.has(postId)) { impressed.add(postId); queue.current.push({ postId, kind: "impression" }); }
        if (seconds >= 10 && !dwelled.has(postId)) { dwelled.add(postId); queue.current.push({ postId, kind: "dwell", duration: Math.floor(seconds) }); }
      }
    }, 1000);
    const batch = window.setInterval(flush, 5000);
    function visibility() {
      // Reset continuous visibility time on either transition, so background
      // time can never become a qualified view after returning to the tab.
      for (const id of visible.keys()) visible.set(id, performance.now());
      if (document.hidden) flush();
    }
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); clearInterval(tick); clearInterval(batch); document.removeEventListener("visibilitychange", visibility); flush(); flushRef.current = () => {}; };
  }, [canTrack, feed.snapshotId, feed.feedCards.length]);

  async function exclude(target: string, restore = false) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/feed/exclusions`, { method: restore ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }) });
      if (!response.ok) throw new Error();
      setHidden((current) => restore ? current.filter((item) => item !== target) : [...current, target]);
      setUndo(restore ? null : target);
    } catch { setError("We couldn't update your feed. Please try again."); }
  }

  return <div ref={root} className="min-w-0">
    <div className="mb-6 flex items-center justify-between gap-3 border-b border-border">
      <nav aria-label="Feed order" className="flex gap-6">{(["for-you", "latest"] as const).map((value) => <Link key={value} href={`/?mode=${value}`} aria-current={mode === value ? "page" : undefined} className={`border-b-2 py-3 text-sm font-semibold ${mode === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{value === "for-you" ? "For you" : "Latest"}</Link>)}</nav>
      {signedIn && <Button aria-label="Feed preferences" variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={18} /></Button>}
    </div>
    {signedIn && <p className="mb-5 text-sm leading-6 text-muted-foreground">{feed.personalizationEnabled ? "Shaped by your network and the posts you spend time with." : "Recent posts and updates from your campus network."} <button className="font-medium text-primary underline underline-offset-4" onClick={() => setSettingsOpen(true)}>You're in control</button></p>}
    {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4 text-sm"><span>{error}</span><Button variant="outline" disabled={pending} onClick={() => void load(true)}>Refresh feed</Button></div>}
    {undo && <div role="status" className="mb-4 flex items-center justify-between border bg-white p-3 text-sm">Hidden from your feed.<Button variant="ghost" onClick={() => void exclude(undo, true)}>Undo</Button></div>}
    <div className="space-y-5">{feed.feedCards.filter((post) => !hidden.includes(`post:${post.postId}`) && !hidden.includes(`author:${post.authorId}`) && !hidden.includes(`club:${post.clubId}`)).map((post) => <div key={post.postId} data-feed-post={post.postId}>
      <FeedPostCard post={post} showDeleteButton={false} onExclude={signedIn ? (target) => void exclude(target) : undefined}
        onOpen={() => { if (canTrack && post.postId) {
          queue.current.push({ postId: post.postId, kind: "open" }); flushRef.current();
          try { sessionStorage.setItem("campus-nexus:post-context", JSON.stringify({ postId: post.postId, snapshotId: feed.snapshotId })); } catch { /* Storage is optional. */ }
        } }} />
    </div>)}</div>
    {!error && !feed.feedCards.length && <EmptyState title="A little quiet here" description="Posts from your campus will appear here. Start a conversation or find a club to follow." action={<Link href="/?=createpost" className={buttonVariants()}><Plus size={18} />Create post</Link>} />}
    {feed.nextCursor && <div className="mt-7 text-center"><Button variant="outline" disabled={pending} onClick={() => void load()}>{pending ? "Loading posts…" : "Load more"}</Button></div>}
    {!feed.nextCursor && feed.feedCards.length > 0 && <p className="py-8 text-center text-sm text-muted-foreground">You're all caught up. <button className="text-primary underline" disabled={pending} onClick={() => void load(true)}>Refresh feed</button></p>}
    <Dialog open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (!open) void load(true); }}><DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Feed preferences</DialogTitle></DialogHeader><FeedPreferences /></DialogContent></Dialog>
  </div>;
}
