"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, authFetch, isAdminUser, readAuthSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type PostDeleteButtonProps = {
  postId?: string;
  authorId?: string;
  className?: string;
  onDeleted: () => void;
};

export function PostDeleteButton({ postId, authorId, className, onDeleted }: PostDeleteButtonProps) {
  const [canDelete, setCanDelete] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const user = readAuthSession()?.user;
    setCanDelete(Boolean(user && (user.userId === authorId || isAdminUser(user))));
  }, [authorId]);

  async function deletePost() {
    if (!postId || pending || !window.confirm("Delete this post? This cannot be undone.")) {
      return;
    }
    setPending(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        return;
      }
      onDeleted();
    } catch {
      // Leave the post in place when the request cannot be completed.
    } finally {
      setPending(false);
    }
  }

  if (!canDelete || !postId) {
    return null;
  }

  return (
    <Button
      aria-label="Delete post"
      className={cn(
        "size-7 rounded-[3px] border border-red-300 bg-transparent p-0 text-red-600 hover:border-red-400 hover:bg-red-50 hover:text-red-700",
        className,
      )}
      disabled={pending}
      size="icon-sm"
      title="Delete post"
      type="button"
      variant="ghost"
      onClick={deletePost}
    >
      <span className="material-symbols-outlined text-[16px]">delete</span>
    </Button>
  );
}
