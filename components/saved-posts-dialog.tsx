"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { FeedPostCard } from "@/components/feed-post-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE_URL, authFetch } from "@/lib/auth-client";
import type { FeedCard } from "@/lib/app-data";

type SavedPostsResponse = {
  items?: FeedCard[];
  total?: number;
  error?: string;
};

type SavedPostsDialogProps = {
  returnHref?: string;
};

export function SavedPostsDialog({ returnHref }: SavedPostsDialogProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadSavedPosts = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/saved-posts`);
      const data = (await response.json().catch(() => ({}))) as SavedPostsResponse;
      if (!response.ok) {
        throw new Error(data.error || "Saved posts could not be loaded");
      }
      setPosts(Array.isArray(data.items) ? data.items : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadSavedPosts();
  }, [loadSavedPosts]);

  const handleSavedChange = useCallback((postId: string, saved: boolean) => {
    if (!saved) {
      setPosts((current) => current.filter((post) => post.postId !== postId));
    }
  }, []);

  function close() {
    if (returnHref) {
      router.replace(returnHref);
      return;
    }
    router.back();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="flex h-[calc(100dvh-2rem)] max-h-[900px] max-w-6xl flex-col gap-0 overflow-hidden rounded-[14px] border-white/60 bg-background/95 p-0 shadow-[0_28px_100px_rgba(15,18,33,0.3)] backdrop-blur-xl"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b border-outline-variant/60 bg-white/90 px-6 py-5 pr-20 md:px-8">
          <DialogTitle className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-on-background">
            Saved posts
          </DialogTitle>
          <DialogDescription>
            Posts you save are private to you. Select the bookmark again to remove one.
          </DialogDescription>
        </DialogHeader>

        <Button
          aria-label="Close saved posts"
          className="absolute right-5 top-5 z-10 rounded-full text-on-surface-variant"
          size="icon"
          type="button"
          variant="ghost"
          onClick={close}
        >
          <span className="material-symbols-outlined">close</span>
        </Button>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {status === "loading" ? (
            <div className="grid min-h-72 place-items-center text-sm font-semibold text-on-surface-variant" aria-live="polite">
              Loading saved posts...
            </div>
          ) : status === "error" ? (
            <div className="grid min-h-72 place-items-center text-center" role="alert">
              <div>
                <span className="material-symbols-outlined text-4xl text-secondary">error</span>
                <p className="mt-3 font-semibold text-on-surface">Saved posts could not be loaded.</p>
                <Button className="mt-4 rounded-full" type="button" variant="outline" onClick={() => void loadSavedPosts()}>
                  Try again
                </Button>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              title="No saved posts yet"
              description="Use the bookmark on a post in your feed to keep it here."
            />
          ) : (
            <div className="grid items-start gap-6 sm:grid-cols-2">
              {posts.map((post) => (
                <FeedPostCard key={post.postId ?? post.title} post={post} onSavedChange={handleSavedChange} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
