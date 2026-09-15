"use client";

import { CampusIcon } from "@/components/campus-icon";


import { useEffect, useState } from "react";
import { FeedPostCard } from "@/components/feed-post-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_BASE_URL, authFetch, readAuthSession, type CampusAuthSession } from "@/lib/auth-client";
import { getInitials, type FeedCard } from "@/lib/app-data";

type ProfilePostsGridProps = {
  ownerUserId: string;
  posts: FeedCard[];
};

function isMp4(url: string) {
  const normalizedUrl = url.toLowerCase().split("?", 1)[0];
  return normalizedUrl.endsWith(".mp4") || normalizedUrl.startsWith("data:video/mp4");
}

function postTitle(post: FeedCard) {
  return post.title || post.caption || post.body || "Post";
}

function postMedia(post: FeedCard) {
  return post.mediaUrl || post.image || "";
}

function postId(post: FeedCard) {
  return post.postId || "";
}

function postAuthorId(post: FeedCard) {
  return post.authorId || "";
}

function sessionUserId(session: CampusAuthSession | null) {
  return session?.user.userId || "";
}

export function ProfilePostsGrid({ ownerUserId, posts }: ProfilePostsGridProps) {
  const [visiblePosts, setVisiblePosts] = useState(posts);
  const [selectedPost, setSelectedPost] = useState<FeedCard | null>(null);
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [deleteMessage, setDeleteMessage] = useState("");

  useEffect(() => {
    setVisiblePosts(posts);
  }, [posts]);

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  function openPost(post: FeedCard) {
    setDeleteStatus("idle");
    setDeleteMessage("");
    setSelectedPost(post);
  }

  const canDeleteSelectedPost =
    Boolean(selectedPost) &&
    Boolean(postId(selectedPost as FeedCard)) &&
    sessionUserId(session) === ownerUserId &&
    postAuthorId(selectedPost as FeedCard) === ownerUserId;

  async function deleteSelectedPost() {
    if (!selectedPost || !session || !canDeleteSelectedPost || deleteStatus === "deleting") {
      return;
    }

    const activePostId = postId(selectedPost);
    if (!activePostId) {
      return;
    }

    setDeleteStatus("deleting");
    setDeleteMessage("");

    try {
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(activePostId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      }

      setVisiblePosts((currentPosts) => currentPosts.filter((post) => postId(post) !== activePostId));
      setSelectedPost(null);
      setDeleteStatus("idle");
    } catch (error) {
      setDeleteStatus("error");
      setDeleteMessage(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <>
      {visiblePosts.length === 0 ? (
        <p className="rounded bg-surface-container-low p-5 text-sm font-semibold text-on-surface-variant">
          No posts to show.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
          {visiblePosts.map((post) => {
            const mediaUrl = postMedia(post);
            const title = postTitle(post);

            return (
              <Button
                key={post.postId ?? `${post.authorId}-${title}`}
                className="group relative h-auto aspect-[4/3] w-full justify-start overflow-hidden rounded border border-primary/12 bg-white p-0 text-left  hover:-translate-y-0.5 hover:border-primary/35 "
                type="button"
                variant="ghost"
                onClick={() => openPost(post)}
              >
                {mediaUrl ? (
                  isMp4(mediaUrl) ? (
                    <video className="h-full w-full object-cover transition duration-200 group-hover:scale-105" muted src={mediaUrl} />
                  ) : (
                    <img alt={title} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" src={mediaUrl} />
                  )
                ) : (
                  <div className="flex h-full min-w-0 w-full flex-col justify-between whitespace-normal bg-primary-fixed/55 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded border border-primary/15 bg-white text-xs font-bold text-black">
                      {getInitials(post.author)}
                    </span>
                    <p className="line-clamp-4 break-words text-sm font-semibold leading-6 text-[#242422] md:text-base">{title}</p>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-black/72 p-3 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-white/76">View post</p>
                </div>
              </Button>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selectedPost)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedPost(null);
        }}
      >
        {selectedPost ? (
          <DialogContent className="block max-h-[calc(100dvh-2rem)] max-w-3xl overflow-hidden bg-transparent p-0 ring-0" showCloseButton={false}>
            <DialogTitle className="sr-only">View post</DialogTitle>
            <DialogDescription className="sr-only">Post details and actions</DialogDescription>
            <div className="mb-3 flex justify-end">
              {deleteMessage ? (
                <p className="mr-auto rounded bg-white px-4 py-2 text-sm font-semibold text-on-secondary-fixed-variant ">
                  {deleteMessage}
                </p>
              ) : null}
              {canDeleteSelectedPost ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        aria-label="Delete post"
                        className="mr-2 size-7 rounded border border-red-300 bg-white p-0 text-red-600  hover:border-red-400 hover:bg-red-50 hover:text-red-700"
                        disabled={deleteStatus === "deleting"}
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <CampusIcon name="delete" className=" text-[16px]" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={deleteSelectedPost}>
                        Delete post
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              <Button
                className="rounded bg-white text-on-surface  hover:text-on-secondary-fixed-variant"
                type="button"
                variant="outline"
                onClick={() => setSelectedPost(null)}
              >
                <CampusIcon name="close" className=" text-lg" />
                Close
              </Button>
            </div>
            <ScrollArea className="max-h-[calc(100dvh-6rem)]">
              <FeedPostCard post={selectedPost} showDeleteButton={false} detail />
            </ScrollArea>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
