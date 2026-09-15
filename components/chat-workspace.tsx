"use client";

import { CampusIcon } from "@/components/campus-icon";


import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Conversation, Message, FriendshipStatus, FriendshipUser } from "@/lib/app-data";
import { readAuthSession } from "@/lib/auth-client";
import { chatRequest } from "@/lib/chat-api";
import { CHAT_READ_EVENT } from "@/components/chat-unread-badge";

function threadId(conversation: Conversation) {
  return String(conversation.threadId ?? conversation.id);
}

function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function Avatar({ name }: { name: string }) {
  return <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded bg-primary-fixed font-bold text-primary">
    {name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
  </span>;
}

export function ChatWorkspace({ initialThread }: { initialThread?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(initialThread ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [listError, setListError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState("");
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<FriendshipUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const activeId = useRef(selected);
  const sendLock = useRef(false);
  const sendVersion = useRef(0);
  const scrollArea = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const acknowledged = useRef<Record<string, number>>({});
  const active = conversations.find((item) => threadId(item) === selected);
  const draft = selected ? drafts[selected] ?? "" : "";

  useEffect(() => {
    activeId.current = initialThread ?? null;
    setSelected(initialThread ?? null);
  }, [initialThread]);

  // Recursive timeouts avoid overlapping requests on slower connections.
  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const items = await chatRequest<Conversation[]>("/api/messages/conversations", { signal: controller.signal });
        if (controller.signal.aborted) return;
        setConversations(items.sort((a, b) => b.time.localeCompare(a.time)));
        setListError("");
      } catch (error) {
        if (!controller.signal.aborted) setListError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timeout = setTimeout(refresh, 4000);
        }
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [revision]);

  useEffect(() => {
    setMessages([]);
    setMessageError("");
    nearBottom.current = true;
    if (!selected) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    setLoadingMessages(true);
    async function refresh() {
      const version = sendVersion.current;
      try {
        const items = await chatRequest<Message[]>(`/api/messages/items?threadId=${encodeURIComponent(selected!)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        // A poll begun before a successful send must not erase the new message.
        if (version === sendVersion.current) setMessages(items);
        setMessageError("");
      } catch (error) {
        if (!controller.signal.aborted) setMessageError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingMessages(false);
          timeout = setTimeout(refresh, 3000);
        }
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [selected]);

  useEffect(() => {
    if (nearBottom.current && scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!selected || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.threadId !== Number(selected)) return;
    let pending = false;
    const controller = new AbortController();
    async function markRead() {
      if (pending || document.visibilityState !== "visible" || !document.hasFocus() || !nearBottom.current
        || (acknowledged.current[selected!] ?? 0) >= lastMessage.id) return;
      pending = true;
      try {
        await chatRequest(`/api/messages/conversations/${selected}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: lastMessage.id }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        acknowledged.current[selected!] = lastMessage.id;
        setRevision((value) => value + 1);
        window.dispatchEvent(new Event(CHAT_READ_EVENT));
      } catch {
        // Retry on the next message refresh; never clear counts on failure.
      } finally { pending = false; }
    }
    void markRead();
    const area = scrollArea.current;
    area?.addEventListener("scroll", markRead);
    window.addEventListener("focus", markRead);
    document.addEventListener("visibilitychange", markRead);
    return () => {
      controller.abort();
      area?.removeEventListener("scroll", markRead);
      window.removeEventListener("focus", markRead);
      document.removeEventListener("visibilitychange", markRead);
    };
  }, [messages, selected]);

  useEffect(() => {
    setPeople([]);
    setSearchError("");
    if (!composing) { setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const self = readAuthSession()?.user.userId;
        if (!self) throw new Error("Sign in to find your friends.");
        const results = await chatRequest<FriendshipStatus>(`/api/users/${encodeURIComponent(self)}/friends?includeLists=true`, { signal: controller.signal });
        if (!controller.signal.aborted) setPeople(results.friendsList ?? []);
      } catch (error) {
        if (!controller.signal.aborted) setSearchError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [composing, revision]);

  function selectConversation(id: string | null) {
    if (id === activeId.current) return;
    activeId.current = id;
    setSelected(id);
    setMessages([]);
    setActionError("");
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("thread", id);
    else url.searchParams.delete("thread");
    window.history.replaceState(null, "", url);
  }

  async function startChat(person: FriendshipUser) {
    if (creating) return;
    setCreating(true);
    setActionError("");
    try {
      const conversation = await chatRequest<Conversation>("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserId: person.userId ?? person.id }),
      });
      setConversations((items) => [conversation, ...items.filter((item) => threadId(item) !== threadId(conversation))]);
      selectConversation(threadId(conversation));
      setComposing(false);
      setQuery("");
      setRevision((value) => value + 1);
    } catch (error) { setActionError((error as Error).message); }
    finally { setCreating(false); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !active?.canMessage || !draft.trim() || sendLock.current) return;
    const destination = selected;
    const originalDraft = draft;
    sendLock.current = true;
    setSending(true);
    setActionError("");
    try {
      const message = await chatRequest<Message>("/api/messages/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: Number(destination), text: originalDraft.trim() }),
      });
      sendVersion.current += 1;
      setDrafts((previous) => previous[destination] === originalDraft ? { ...previous, [destination]: "" } : previous);
      if (activeId.current === destination) {
        nearBottom.current = true;
        setMessages((items) => items.some((item) => item.id === message.id) ? items : [...items, message]);
      }
      setRevision((value) => value + 1);
    } catch (error) {
      if (activeId.current === destination) setActionError(`${(error as Error).message} Your draft has been kept.`);
    } finally { sendLock.current = false; setSending(false); }
  }

  return (
    <div className="overflow-hidden rounded border border-outline-variant/60 bg-white ">
      {(listError || actionError) && <div role="alert" className="flex flex-wrap items-center gap-3 border-b bg-red-50 p-4 text-sm text-red-800">
        <span>{actionError || listError}</span>
        <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>Refresh chats</Button>
        {(actionError || listError).includes("session") && <Link className="underline" href="/auth">Sign in</Link>}
      </div>}
      <div className="grid h-[75dvh] min-h-[480px] md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`${selected ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r border-outline-variant/50 bg-surface-container-low`}>
          <div className="space-y-4 border-b border-outline-variant/50 p-5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-editorial font-medium text-2xl">Chat</h1>
              <Button size="sm" variant={composing ? "outline" : "default"} onClick={() => setComposing(!composing)}>{composing ? "Cancel" : "New chat"}</Button>
            </div>
            <Input aria-label={composing ? "Find a friend" : "Search conversations"} placeholder={composing ? "Search your friends" : "Search conversations"} type="search" value={composing ? query : filter} onChange={(event) => composing ? setQuery(event.target.value) : setFilter(event.target.value)} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {composing ? <>
              <p role="status" className="p-3 text-sm text-on-surface-variant">{searchError || (searching ? "Searching…" : people.length ? "Choose a friend to start chatting." : "You can only message friends. Add a friend from their profile first.")}</p>
              {people.filter((person) => `${person.name} ${person.username}`.toLowerCase().includes(query.trim().toLowerCase())).map((person) => <button key={person.id} disabled={creating} onClick={() => void startChat(person)} className="flex w-full items-center gap-3 rounded p-3 text-left hover:bg-white disabled:opacity-50">
                <Avatar name={person.name} /><span className="min-w-0"><span className="block truncate font-semibold">{person.name}</span><span className="block truncate text-sm text-on-surface-variant">{person.username}</span></span>
              </button>)}
            </> : <>
              {loading ? <p role="status" className="p-4 text-sm">Loading conversations…</p> : conversations.length === 0 && !listError ? <div className="space-y-3 p-4 text-sm text-on-surface-variant"><p>No conversations yet. Choose a friend to say hello.</p><Button onClick={() => setComposing(true)}>Start a conversation</Button></div> : null}
              {conversations.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase())).map((conversation) => <button key={threadId(conversation)} aria-current={selected === threadId(conversation) ? "true" : undefined} onClick={() => selectConversation(threadId(conversation))} className={`flex w-full items-center gap-3 rounded p-3 text-left ${selected === threadId(conversation) ? "bg-primary-fixed/60" : "hover:bg-white"}`}>
                <Avatar name={conversation.name} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{conversation.name}</span><span className="mt-1 block truncate text-sm text-on-surface-variant">{conversation.preview || "Say hello"}</span><span className="mt-1 block text-xs text-on-surface-variant">{timestamp(conversation.time)}</span></span>
                {(conversation.unread ?? 0) > 0 && <span aria-label={`${conversation.unread} unread messages`} className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-secondary px-1.5 text-xs font-bold text-black">{conversation.unread}</span>}
              </button>)}
              {filter && conversations.length > 0 && !conversations.some((item) => item.name.toLowerCase().includes(filter.toLowerCase())) && <p className="p-4 text-sm">No matching conversations.</p>}
            </>}
          </div>
        </aside>
        <section aria-label="Conversation" className={`${selected ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col`}>
          {selected ? <>
            <header className="flex items-center gap-3 border-b border-outline-variant/50 p-4">
              <Button aria-label="Back to conversations" className="md:hidden" size="icon" variant="ghost" onClick={() => selectConversation(null)}><CampusIcon name="arrow_back" className="" /></Button>
              <Avatar name={active?.name ?? "Chat"} />
              <div><h2 className="font-bold">{active?.name ?? (loading ? "Loading…" : "Conversation unavailable")}</h2><p className="text-xs text-on-surface-variant">Private conversation</p></div>
            </header>
            {messageError && <p role="alert" className="bg-red-50 p-3 text-sm text-red-800">{messageError} Retrying automatically.</p>}
            <div ref={scrollArea} role="log" aria-label="Messages" aria-live="polite" onScroll={() => { const area = scrollArea.current; if (area) nearBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight < 100; }} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-container-low p-5">
              {loadingMessages ? <p role="status" className="text-center text-sm">Loading messages…</p> : messages.length === 0 && !messageError && active ? <p className="py-10 text-center text-sm text-on-surface-variant">This is the start of your conversation. Say hello!</p> : null}
              {!loading && !active && <p className="text-sm">This conversation is unavailable. Choose a chat or start a new one.</p>}
              {messages.map((message) => <div key={message.id} className={`flex ${message.side === "right" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] md:max-w-[75%]"><p className={`whitespace-pre-wrap break-words rounded px-4 py-3 text-sm [overflow-wrap:anywhere] ${message.side === "right" ? "rounded-br-sm bg-primary text-on-primary" : "rounded-bl-sm border border-outline-variant/40 bg-white"}`}>{message.text}</p><p className="mt-1 text-xs text-on-surface-variant">{message.side === "right" ? "You · " : ""}{timestamp(message.time)}</p></div>
              </div>)}
            </div>
            {active && !active.canMessage && <p role="status" className="border-t px-4 py-3 text-sm text-muted-foreground">Messaging is available only while you are friends. Add this person as a friend to send messages.</p>}
            <form onSubmit={sendMessage} className="flex items-end gap-3 border-t border-outline-variant/50 p-4">
              <Textarea aria-label="Message" placeholder="Write a message…" maxLength={5000} rows={2} disabled={!active?.canMessage} value={draft} onChange={(event) => setDrafts((previous) => ({ ...previous, [selected]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} className="max-h-32 min-h-12 flex-1 resize-none" />
              <Button type="submit" disabled={sending || !active?.canMessage || !draft.trim()}>{sending ? "Sending…" : "Send"}</Button>
            </form>
          </> : <div className="m-auto max-w-sm space-y-3 p-8 text-center"><CampusIcon name="forum" className=" text-4xl text-primary" /><h2 className="text-xl font-bold">Your campus conversations</h2><p className="text-sm text-on-surface-variant">Choose a conversation or start a new chat with a friend. Messages are saved so you can pick up where you left off.</p><Button onClick={() => setComposing(true)}>New chat</Button></div>}
        </section>
      </div>
    </div>
  );
}
