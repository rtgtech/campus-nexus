"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, isAdminUser, readAuthSession } from "@/lib/auth-client";
import { getInitials, type CampusUser } from "@/lib/app-data";

type ClubMemberAdminPanelProps = {
  clubSlug: string;
  existingUserIds: string[];
};

type Status = "idle" | "searching" | "saving" | "success" | "error";

export function ClubMemberAdminPanel({ clubSlug, existingUserIds }: ClubMemberAdminPanelProps) {
  const router = useRouter();
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("Member");
  const [results, setResults] = useState<CampusUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<CampusUser | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCanManageMembers(isAdminUser(readAuthSession()?.user));
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!canManageMembers || normalizedQuery.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    if (selectedUser?.username === normalizedQuery) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setStatus("searching");
      setMessage("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/users?username=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("User search failed");
        }

        const users = (await response.json()) as CampusUser[];
        setResults(users.filter((user) => !existingUserIds.includes(user.user_id)));
        setStatus("idle");
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "User search failed");
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [canManageMembers, existingUserIds, query, selectedUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = readAuthSession();

    if (!session || !isAdminUser(session.user) || !selectedUser) {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(clubSlug)}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          title,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Add member failed");
      }

      setStatus("success");
      setMessage(`${selectedUser.name} added.`);
      setQuery("");
      setSelectedUser(null);
      setResults([]);
      setTitle("Member");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Add member failed");
    }
  }

  if (!canManageMembers) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-primary/20 bg-white p-5 shadow-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Admin</p>
        <h2 className="mt-2 font-headline-md text-xl text-on-background">Add member</h2>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-on-surface">Username</span>
          <input
            className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            placeholder="Search username"
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedUser(null);
              setMessage("");
            }}
          />
        </label>

        {selectedUser ? (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-fixed/70 p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
              {selectedUser.initials || selectedUser.acronym || getInitials(selectedUser.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-on-surface">{selectedUser.name}</p>
              <p className="truncate text-xs text-on-surface-variant">@{selectedUser.username}</p>
            </div>
            <button
              className="rounded-full p-2 text-on-surface-variant transition hover:bg-white hover:text-secondary"
              type="button"
              onClick={() => {
                setSelectedUser(null);
                setQuery("");
                setMessage("");
              }}
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        ) : null}

        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map((user) => (
              <button
                key={user.user_id}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition",
                  selectedUser?.user_id === user.user_id
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface hover:bg-primary-fixed",
                ].join(" ")}
                type="button"
                onClick={() => {
                  setSelectedUser(user);
                  setQuery(user.username);
                  setResults([]);
                  setMessage("");
                  setStatus("idle");
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold text-primary">
                  {user.initials || user.acronym || getInitials(user.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{user.name}</span>
                  <span className="block truncate text-xs opacity-75">@{user.username}</span>
                </span>
              </button>
            ))}
          </div>
        ) : query.trim().length >= 2 && status !== "searching" ? (
          <p className="rounded-2xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
            No available users found.
          </p>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-on-surface">Member title</span>
          <input
            className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-4">
          <p className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}>
            {status === "searching"
              ? "Searching..."
              : status === "saving"
                ? "Adding member..."
                : message || "Select a user to add them to this club."}
          </p>
          <button
            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-[0_14px_34px_rgba(34,29,92,0.2)] transition hover:scale-[1.02] disabled:opacity-60"
            disabled={!selectedUser || status === "saving"}
            type="submit"
          >
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
