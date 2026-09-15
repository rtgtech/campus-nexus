"use client";

import { CampusIcon } from "@/components/campus-icon";


import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_BASE_URL, authFetch, readAuthSession, type CampusAuthSession } from "@/lib/auth-client";
import type { NotificationItem, NotificationsData } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { cn } from "@/lib/utils";

type LoadStatus = "idle" | "loading" | "error";

function NotificationIcon({ item }: { item: NotificationItem }) {
  if (item.source === "friend") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-primary-fixed text-xs font-black text-primary">
        {item.iconText}
      </span>
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-secondary text-black">
      <CampusIcon name={item.iconName} className=" text-lg" />
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

        const payload = parseApiResponse<NotificationsData>("/api/notifications", data);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Open notifications"
        render={<Button className="relative rounded text-on-surface-variant" size="icon" variant="ghost" />}
      >
        <CampusIcon name="notifications" className="" />
        {visibleBadge ? (
          <Badge className="absolute -right-1 -top-1 min-w-5 justify-center rounded bg-secondary px-1.5 py-0.5 text-xs font-black leading-none text-black ring-2 ring-white">
            {visibleBadge}
          </Badge>
        ) : null}
      </DialogTrigger>
      <DialogContent className="inset-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 md:inset-auto md:left-auto md:right-4 md:top-16 md:h-auto md:max-h-[calc(100vh-5rem)] md:w-[390px] md:translate-x-0 md:translate-y-0 md:rounded">
        <DialogHeader className="border-b border-outline-variant/60 px-4 py-4 pr-14 text-left md:px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-secondary-fixed-variant">Updates</p>
          <DialogTitle className="font-sans text-xl font-bold tracking-tight text-on-background">
            Notifications
          </DialogTitle>
          <DialogDescription className="sr-only">Recent friend, club, and marketplace updates</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 md:max-h-[520px]">
          <div className="p-3">
              {hasItems ? (
                <div className="space-y-2">
                  {items.map((item) => (
                  <Card
                    key={item.id}
                    className="relative flex gap-3 rounded border border-outline-variant/50 bg-surface-container-low px-3 py-3 pr-11"
                  >
                    <NotificationIcon item={item} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-1">
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-on-secondary-fixed-variant">
                          {item.source === "marketplace" ? "Marketplace" : item.source === "club" ? "Club" : "Friend"}
                        </span>
                        <span className="text-xs font-semibold text-on-surface-variant">{item.time}</span>
                      </div>
                      <div className="mt-2 flex items-start gap-2">
                        <CampusIcon name={item.iconName} className=" mt-0.5 text-base text-primary" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold leading-5 text-on-background">{item.title}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">{item.body}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full rounded bg-white text-xs font-bold text-primary hover:text-on-secondary-fixed-variant sm:w-auto")}
                          href={item.href}
                          onClick={() => setOpen(false)}
                        >
                          {item.actionLabel}
                        </Link>
                      </div>
                    </div>
                    <Button
                      aria-label="Dismiss notification"
                      className="absolute right-2 top-2 rounded text-on-surface-variant hover:bg-white hover:text-on-secondary-fixed-variant"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={() => dismissNotification(item)}
                    >
                      <CampusIcon name="close" className=" text-base" />
                    </Button>
                  </Card>
                  ))}
                </div>
              ) : (
                <p className="rounded bg-surface-container-low p-4 text-sm font-medium text-on-surface-variant">
                  {panelMessage}
                </p>
              )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
