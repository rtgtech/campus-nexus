"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import { parseApiResponse } from "@/lib/api-response-contract";
import type { PostComment } from "@/lib/app-data";

export function PostComments({ postId, onCountChange }: { postId: string; onCountChange: (count: number) => void }) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const sendLock = useRef(false);
  const path = `/api/posts/${encodeURIComponent(postId)}/comments`;

  useEffect(() => {
    setSignedIn(Boolean(readAuthSession()));
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void authFetch(API_BASE_URL + path, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Comments couldn't be loaded.");
        const data = parseApiResponse<{ items: PostComment[]; total: number }>(path, await response.json());
        if (!controller.signal.aborted) { setComments(data.items); onCountChange(data.total); }
      }).catch(() => { if (!controller.signal.aborted) setError("Comments couldn't be loaded. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision, onCountChange]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sendLock.current || loading) return;
    sendLock.current = true;
    setSending(true);
    setStatus("");
    try {
      const response = await authFetch(API_BASE_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to comment." : "Your comment couldn't be posted. Your draft has been kept.");
      const data = parseApiResponse<{ comment: PostComment; comments: number }>(path, await response.json());
      setComments((current) => [...current.filter((item) => item.id !== data.comment.id), data.comment]);
      onCountChange(data.comments);
      setDraft("");
      setStatus("Comment posted.");
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Your comment couldn't be posted."); }
    finally { sendLock.current = false; setSending(false); }
  }

  return <section aria-label="Post comments" className="space-y-4 border-t px-5 py-5 sm:px-6">
    <h3 className="text-sm font-semibold">Comments</h3>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading comments…</p>}
    {error && <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Retry comments</Button></div>}
    {!loading && !error && !comments.length && <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>}
    <ul className="max-h-80 space-y-4 overflow-y-auto">{comments.map((comment) => <li key={comment.id} className="text-sm">
      <div className="flex flex-wrap items-baseline gap-2"><Link className="font-semibold hover:underline" href={`/${encodeURIComponent(comment.username || comment.userId)}`}>{comment.author}</Link>
        <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div>
      <p className="mt-1 whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">{comment.content}</p>
    </li>)}</ul>
    {signedIn ? <form onSubmit={submit} className="space-y-3">
      <Textarea aria-label="Write a comment" placeholder="Add to the conversation…" maxLength={2000} rows={3} value={draft} disabled={sending} onChange={(event) => setDraft(event.target.value)} />
      <Button type="submit" disabled={loading || sending || !draft.trim()}>{sending ? "Posting…" : "Post comment"}</Button>
    </form> : <p className="text-sm"><Link href="/auth" className="font-medium text-primary underline">Sign in</Link> to comment.</p>}
    {status && <p role="status" className="text-sm">{status}</p>}
  </section>;
}
