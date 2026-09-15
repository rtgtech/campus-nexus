"use client";

import { useEffect, useState } from "react";
import { authFetch, API_BASE_URL } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function FeedPreferences() {
  const [preferences, setPreferences] = useState<{ enabled: boolean; exclusions: string[]; exclusionLabels?: Record<string, string> } | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/feed/preferences`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (typeof data.enabled !== "boolean" || !Array.isArray(data.exclusions) || data.exclusions.some((item: unknown) => typeof item !== "string")) throw new Error();
      setPreferences(data);
      setStatus("");
      return true;
    } catch { setStatus("Feed settings are unavailable. Please try again."); return false; }
  }
  useEffect(() => { void load(); }, []);
  async function update(path: string, method: string, body?: object) {
    const previous = preferences;
    if (path === "preferences" && preferences && body && "enabled" in body) {
      setPreferences({ ...preferences, enabled: Boolean(body.enabled) });
    }
    setPending(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/feed/${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (!response.ok) throw new Error();
      const refreshed = await load();
      setStatus(refreshed
        ? path === "history" ? "Your learning history has been cleared. Saved posts and likes are unchanged." : "Feed settings updated."
        : "Your change was saved, but settings couldn't refresh. Reopen feed preferences to try again.");
      window.dispatchEvent(new Event("campus-nexus:feed-preferences"));
    } catch { setPreferences(previous); setStatus("We couldn't save that change. Please try again."); }
    finally { setPending(false); }
  }
  return <section className="space-y-5 rounded border border-border bg-white p-5 sm:p-6" aria-labelledby="feed-preferences-heading">
    <div><h2 id="feed-preferences-heading" className="text-xl font-semibold">Your feed, your choice</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">For you learns from posts you view, like, comment on, and save. It combines those interests with your friends, clubs, and recent campus posts.</p>
    </div>
    {preferences ? <>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm font-medium">
        Learn from my activity
        <input type="checkbox" className="size-5 accent-primary" checked={preferences.enabled} disabled={pending} onChange={(event) => void update("preferences", "PATCH", { enabled: event.target.checked })} />
      </label>
      <p className="text-sm text-muted-foreground">Turning this off stops learning and uses your network and freshness instead. Viewing events are kept for 30 days; interest summaries expire after 90 days.</p>
      <Button disabled={pending} variant="outline" onClick={() => void update("history", "DELETE")}>Reset learning history</Button>
      {preferences.exclusions.length > 0 && <div className="border-t pt-4"><h3 className="mb-2 text-sm font-semibold">Hidden posts and muted sources</h3>
        <ul className="divide-y">{preferences.exclusions.map((target) => <li key={target} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 break-words">{preferences.exclusionLabels?.[target] || (target.startsWith("post:") ? "Hidden post" : target.startsWith("club:") ? "Muted club" : "Muted author")}</span>
          <Button disabled={pending} variant="ghost" onClick={() => void update("exclusions", "DELETE", { target })}>Restore</Button>
        </li>)}</ul>
      </div>}
    </> : <Button variant="outline" disabled={pending} onClick={() => void load()}>Load feed settings</Button>}
    {status && <p role="status" className="text-sm">{status}</p>}
  </section>;
}
