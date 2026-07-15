"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { API_BASE_URL, authFetch, readAuthSession, type CampusAuthSession } from "@/lib/auth-client";

type NotificationItem = {
  id: string;
  source: "friend" | "club";
  type: string;
  title: string;
  body: string;
  time: string;
  href: string;
  actionLabel: string;
  iconText: string;
  iconName: string;
  unread?: boolean;
};

type NotificationsResponse = {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
};

type LoadStatus = "idle" | "loading" | "error";

function NotificationIcon({ item }: { item: NotificationItem }) {
  if (item.source === "friend") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-black text-primary">
        {item.iconText}
      </span>
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-white">
      <span className="material-symbols-outlined text-lg">{item.iconName}</span>
    </span>
  );
}

function badgeLabel(count: number) {
  if (count <= 0) {
    return "";
  }
  return count > 99 ? "99+" : String(count);
}

function emptyMessage(session: CampusAuthSession | null, status: LoadStatus) {
  if (!session) {
    return "Sign in to see campus updates.";
  }
  if (status === "loading") {
    return "Loading notifications...";
  }
  if (status === "error") {
    return "Notifications could not be loaded.";
  }
  return "No notifications yet.";
}

export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const panelId = useId();
  const visibleBadge = badgeLabel(unreadCount);

  const hasItems = items.length > 0;
  const panelMessage = useMemo(() => emptyMessage(session, status), [session, status]);

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  useEffect(() => {
    if (!session) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    const controller = new AbortController();
    setStatus("loading");

    async function loadNotifications() {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/notifications`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Notification request failed");
        }

        const payload = data as NotificationsResponse;
        setItems(Array.isArray(payload.items) ? payload.items : []);
        setUnreadCount(Number(payload.unreadCount ?? payload.total ?? 0));
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("error");
        }
      }
    }

    loadNotifications();

    return () => controller.abort();
  }, [open, session]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSession(readAuthSession());
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function dismissNotification(item: NotificationItem) {
    if (!session) {
      return;
    }

    const previousItems = items;
    const previousUnreadCount = unreadCount;

    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setUnreadCount((count) => Math.max(0, count - (item.unread === false ? 0 : 1)));

    try {
      const response = await authFetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Dismiss failed");
      }
    } catch {
      setItems(previousItems);
      setUnreadCount(previousUnreadCount);
      setStatus("error");
    }
  }

  return (
    <>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label="Open notifications"
        className="relative rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="material-symbols-outlined">notifications</span>
        {visibleBadge ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {visibleBadge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] bg-[rgba(15,18,33,0.42)] backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
          onClick={() => setOpen(false)}
        >
          <section
            id={panelId}
            aria-label="Notifications"
            className="fixed inset-0 flex h-dvh w-full flex-col bg-white text-on-surface shadow-[0_24px_80px_rgba(15,18,33,0.22)] md:inset-auto md:right-4 md:top-16 md:h-auto md:max-h-[calc(100vh-5rem)] md:w-[390px] md:overflow-hidden md:rounded-[24px] md:border md:border-outline-variant/70"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-outline-variant/60 px-4 py-4 md:px-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary">Updates</p>
                <h2 className="mt-1 font-['Space_Grotesk'] text-xl font-bold tracking-tight text-on-background">
                  Notifications
                </h2>
              </div>
              <button
                aria-label="Close notifications"
                className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-primary"
                type="button"
                onClick={() => setOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:max-h-[520px]">
              {hasItems ? (
                <div className="space-y-2">
                  {items.map((item) => (
                  <article
                    key={item.id}
                    className="relative flex gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-3 pr-11"
                  >
                    <NotificationIcon item={item} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                          {item.source === "club" ? "Club" : "Friend"}
                        </span>
                        <span className="text-xs font-semibold text-on-surface-variant">{item.time}</span>
                      </div>
                      <div className="mt-2 flex items-start gap-2">
                        <span className="material-symbols-outlined mt-0.5 text-base text-primary">{item.iconName}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold leading-5 text-on-background">{item.title}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">{item.body}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link
                          className="inline-flex w-full items-center justify-center rounded-full bg-white px-3 py-2 text-xs font-bold text-primary transition hover:text-secondary sm:w-auto"
                          href={item.href}
                          onClick={() => setOpen(false)}
                        >
                          {item.actionLabel}
                        </Link>
                      </div>
                    </div>
                    <button
                      aria-label="Dismiss notification"
                      className="absolute right-2 top-2 rounded-full p-1.5 text-on-surface-variant transition hover:bg-white hover:text-secondary"
                      type="button"
                      onClick={() => dismissNotification(item)}
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-surface-container-low p-4 text-sm font-medium text-on-surface-variant">
                  {panelMessage}
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
