"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readAuthSession } from "@/lib/auth-client";
import { chatRequest } from "@/lib/chat-api";
import type { Conversation } from "@/lib/app-data";

export type MarketplaceInterest = {
  itemId: string;
  notificationId: string;
  title: string;
  userId: string;
  name: string;
  username: string;
  createdAt: string;
  canMessage: boolean;
};

export function ExpressInterestButton({ itemId, sellerId, status }: { itemId: string; sellerId?: string; status?: string }) {
  const available = status === "available";
  const [viewer, setViewer] = useState<string>();
  const [ready, setReady] = useState(false);
  const [interested, setInterested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/marketplace/items/${encodeURIComponent(itemId)}/interest`;
  useEffect(() => {
    const controller = new AbortController();
    const self = readAuthSession()?.user.userId;
    setViewer(self);
    setInterested(false);
    setReady(false);
    if (!available || !self || self === sellerId) { setReady(true); return; }
    chatRequest<{ interested: boolean }>(path, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setInterested(data.interested); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [path, sellerId, available]);

  async function expressInterest() {
    if (!available || busy || interested) return;
    setBusy(true);
    setError("");
    try {
      await chatRequest(path, { method: "POST" });
      setInterested(true);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  if (!ready || viewer === sellerId) return null;
  if (!available) return <div className="mt-3"><Button disabled>{status === "sold" ? "Sold" : "Unavailable"}</Button></div>;
  return <div className="mt-3">
    {!viewer ? <Link className="text-sm underline" href="/auth">Sign in to express interest</Link> :
      <Button disabled={busy || interested} onClick={() => void expressInterest()}>
        {busy ? "Sending…" : interested ? "Interest expressed" : "Express Interest"}
      </Button>}
    {interested && <p role="status" className="mt-2 text-xs text-muted-foreground">The owner has been notified.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}

export function MarketplaceInterestInbox() {
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceInterest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await chatRequest<{ items: MarketplaceInterest[] }>("/api/marketplace/interests", { signal: controller.signal });
        if (!controller.signal.aborted) { setItems(result.items); setError(""); }
      } catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message); }
      finally {
        if (!controller.signal.aborted) { setLoading(false); timeout = setTimeout(refresh, 15000); }
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);
  async function messageUser(userId: string) {
    setOpening(userId);
    try {
      const conversation = await chatRequest<Conversation>("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserId: userId }),
      });
      router.push(`/chat?thread=${conversation.threadId ?? conversation.id}`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setOpening(null); }
  }
  async function dismissInterest(item: MarketplaceInterest) {
    const key = `${item.itemId}:${item.userId}`;
    if (dismissing) return;
    setDismissing(key);
    setError("");
    try {
      await chatRequest(`/api/notifications/${encodeURIComponent(item.notificationId)}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => `${entry.itemId}:${entry.userId}` !== key));
    } catch (cause) { setError((cause as Error).message); }
    finally { setDismissing(null); }
  }
  return <section className="rounded border bg-white p-4 lg:col-span-2">
    <h3 className="font-semibold">Interest in your listings</h3>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {loading ? <p role="status" className="mt-3 text-sm">Loading interest…</p> : !items.length && !error ? <p className="mt-3 text-sm text-muted-foreground">No interest expressed yet.</p> : null}
    {items.map((item) => <div key={`${item.itemId}:${item.userId}`} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
      <div className="min-w-0 flex-1 text-sm">
        <Link className="font-semibold underline" href={`/${encodeURIComponent(item.username || item.userId)}`}>{item.name}</Link>
        {" expressed interest in "}<Link className="underline" href={`/marketplace#${item.itemId}`}>{item.title}</Link>
        <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
      </div>
      <Button size="sm" disabled={opening !== null || !item.canMessage} onClick={() => void messageUser(item.userId)}>
        {opening === item.userId ? "Opening…" : "Message"}
      </Button>
      <Button
        aria-label={`Dismiss interest from ${item.name} in ${item.title}`}
        disabled={dismissing !== null}
        size="icon-sm"
        title="Dismiss"
        variant="ghost"
        onClick={() => void dismissInterest(item)}
      >
        <X aria-hidden="true" />
      </Button>
    </div>)}
  </section>;
}
