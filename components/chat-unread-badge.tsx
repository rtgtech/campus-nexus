"use client";

import { useEffect, useState } from "react";
import { chatRequest } from "@/lib/chat-api";

export const CHAT_READ_EVENT = "campus-chat-read";

export function ChatUnreadBadge() {
  const [count, setCount] = useState(0);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(CHAT_READ_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(CHAT_READ_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const data = await chatRequest<{ unreadFriends: number }>("/api/messages/unread", { signal: controller.signal });
        if (!controller.signal.aborted) setCount(data.unreadFriends);
      } catch {
        // Keep the last known count during a temporary connection failure.
      } finally {
        if (!controller.signal.aborted) timeout = setTimeout(refresh, 4000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [revision]);

  if (count === 0) return null;
  return (
    <span aria-label={`${count} friends with unread messages`} className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 font-sans text-xs font-bold leading-none text-black ring-2 ring-white">
      {count}
    </span>
  );
}
