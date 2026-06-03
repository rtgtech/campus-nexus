"use client";

import { useEffect, useState } from "react";
import { FeedPostCard } from "@/components/feed-post-card";
import { getInitials, type FeedCard } from "@/lib/app-data";

type ProfilePostsGridProps = {
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

export function ProfilePostsGrid({ posts }: ProfilePostsGridProps) {
  const [selectedPost, setSelectedPost] = useState<FeedCard | null>(null);

  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedPost]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((post) => {
          const mediaUrl = postMedia(post);
          const title = postTitle(post);

          return (
            <button
              key={post.post_id ?? `${post.authorId}-${title}`}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-low text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              type="button"
              onClick={() => setSelectedPost(post)}
            >
              {mediaUrl ? (
                isMp4(mediaUrl) ? (
                  <video className="h-full w-full object-cover transition duration-200 group-hover:scale-105" muted src={mediaUrl} />
                ) : (
                  <img alt={title} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" src={mediaUrl} />
                )
              ) : (
                <div className="flex h-full flex-col justify-between p-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
                    {getInitials(post.author)}
                  </span>
                  <p className="line-clamp-4 font-['Space_Grotesk'] text-lg font-bold leading-tight text-primary">{title}</p>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-[rgba(34,29,92,0.78)] p-3 text-white opacity-0 transition group-hover:opacity-100">
                <p className="truncate text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-white/76">View post</p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPost ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[rgba(15,18,33,0.58)] px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="View post"
          onClick={() => setSelectedPost(null)}
        >
          <div className="w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition hover:text-secondary"
                type="button"
                onClick={() => setSelectedPost(null)}
              >
                <span className="material-symbols-outlined text-lg">close</span>
                Close
              </button>
            </div>
            <FeedPostCard post={selectedPost} />
          </div>
        </div>
      ) : null}
    </>
  );
}
