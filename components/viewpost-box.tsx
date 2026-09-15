"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FeedPostCard } from "@/components/feed-post-card";
import { API_BASE_URL, authFetch } from "@/lib/auth-client";
import type { FeedCard } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";

export function ViewPostRoute({ returnHref }: { returnHref?: string }) {
  const searchParams = useSearchParams();
  const postId = searchParams.get("") || "";
  return postId ? <ViewPostBox postId={postId} returnHref={returnHref} /> : null;
}

export function ViewPostBox({ postId, returnHref }: { postId: string; returnHref?: string }) {
  const router = useRouter();
  const [post, setPost] = useState<FeedCard | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    authFetch(API_BASE_URL + "/api/posts/" + encodeURIComponent(postId))
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = parseApiResponse<FeedCard>("/api/posts/" + postId, await response.json());
        if (active) setPost(data);
      }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [postId, revision]);
  useEffect(() => {
    if (!post) return;
    let context: { postId?: string; snapshotId?: string } = {};
    try { context = JSON.parse(sessionStorage.getItem("campus-nexus:post-context") || "{}"); } catch { return; }
    if (context.postId !== postId || !context.snapshotId) return;
    let seconds = 0;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      seconds++;
      if (seconds >= 10) {
        clearInterval(timer);
        void authFetch(API_BASE_URL + "/api/feed/events", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId: context.snapshotId, events: [{ postId, kind: "dwell", duration: 10 }] }) }).catch(() => undefined);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [post, postId]);
  function close() {
    if (returnHref) router.replace(returnHref);
    else if (window.history.length > 1) router.back();
    else router.replace("/");
  }
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="h-[calc(100dvh-2rem)] max-h-[760px] w-[calc(100%-2rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-4 sm:p-6">
      <DialogHeader className="shrink-0 pr-10"><DialogTitle>Campus post</DialogTitle><DialogDescription>Catch up with your campus.</DialogDescription></DialogHeader>
      {error ? <div role="alert" className="self-center space-y-4 text-center"><p>This post couldn't be loaded.</p><Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></div> :
        post ? <FeedPostCard post={post} detail fitViewport /> : <p role="status" className="self-center text-center text-sm text-muted-foreground">Loading post…</p>}
    </DialogContent>
  </Dialog>;
}
