"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, isAdminUser, readAuthSession } from "@/lib/auth-client";
import { getInitials, type CampusUser, type ClubMember } from "@/lib/app-data";

type ClubMemberAdminPanelProps = {
  clubSlug: string;
  existingUserIds: string[];
  existingTitles: string[];
  members: ClubMember[];
};

type Status = "idle" | "searching" | "saving" | "success" | "error";

const DESIGNATIONS = ["President", "Vice President", "Chairman", "Vice Chairman", "Treasurer", "Member"];
const SINGLE_DESIGNATIONS = new Set(DESIGNATIONS.filter((designation) => designation !== "Member"));

function currentUserId() {
  const user = readAuthSession()?.user;
  return user?.user_id || user?.userId || user?.id || "";
}

function isCurrentUserPresident(members: ClubMember[]) {
  const userId = currentUserId();
  return members.some((member) => member.user_id === userId && member.title === "President");
}

export function ClubMembersButton({ clubSlug, members }: { clubSlug: string; members: ClubMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPresident, setIsPresident] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const session = readAuthSession();
    setIsAdmin(isAdminUser(session?.user));
    setIsPresident(isCurrentUserPresident(members));
  }, [members]);

  async function removeMember(member: ClubMember) {
    const session = readAuthSession();
    if (!session || (!isAdminUser(session.user) && !(isPresident && member.title === "Member"))) {
      return;
    }

    setRemovingMemberId(member.id);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(clubSlug)}/members/${member.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Remove member failed");
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Remove member failed");
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <>
      <button
        className="rounded-full bg-white/14 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur transition hover:bg-white/24"
        type="button"
        onClick={() => setOpen(true)}
      >
        View members
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[82vh] w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-container-highest p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Members</p>
                <h2 className="mt-1 font-headline-md text-2xl text-on-background">{members.length} members</h2>
              </div>
              <button
                className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container-low hover:text-secondary"
                type="button"
                onClick={() => setOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {members.length === 0 ? (
                <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  No members yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex min-w-0 items-center gap-3 rounded-2xl bg-surface-container-low px-3 py-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                        {member.initials || getInitials(member.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{member.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {member.title || "Member"}
                          {member.username ? ` - @${member.username}` : ""}
                        </p>
                      </div>
                      {isAdmin || (isPresident && member.title === "Member") ? (
                        <button
                          className="rounded-full p-1 text-on-surface-variant transition hover:bg-white hover:text-secondary disabled:opacity-50"
                          aria-label={`Remove ${member.name}`}
                          disabled={removingMemberId === member.id}
                          type="button"
                          onClick={() => removeMember(member)}
                        >
                          <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {message ? <p className="mt-3 text-sm font-semibold text-secondary">{message}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ClubMemberAdminPanel({ clubSlug, existingUserIds, existingTitles, members }: ClubMemberAdminPanelProps) {
  const router = useRouter();
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [canManageDesignations, setCanManageDesignations] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("Member");
  const [results, setResults] = useState<CampusUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<CampusUser | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const usedSingleDesignations = new Set(existingTitles.filter((designation) => SINGLE_DESIGNATIONS.has(designation)));
  const availableDesignations = canManageDesignations
    ? DESIGNATIONS.filter((designation) => designation === "Member" || !usedSingleDesignations.has(designation))
    : ["Member"];

  useEffect(() => {
    const session = readAuthSession();
    const admin = isAdminUser(session?.user);
    setCanManageMembers(admin || isCurrentUserPresident(members));
    setCanManageDesignations(admin);
  }, [members]);

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

    if (!session || !canManageMembers || !selectedUser) {
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
      setOpen(false);
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
    <>
      <button
        className="fixed bottom-6 right-6 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_18px_40px_rgba(34,29,92,0.28)] transition hover:scale-105"
        aria-label="Add club member"
        type="button"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl rounded-[28px] bg-white p-5 shadow-2xl md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Admin</p>
                <h3 className="mt-1 font-headline-md text-lg text-on-background">Add member</h3>
              </div>
              <button
                className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container-low hover:text-secondary"
                type="button"
                onClick={() => setOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-on-surface" htmlFor="club-member-username">
                    Username
                  </label>
                  <input
                    id="club-member-username"
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
                </div>

                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-on-surface">Designation</span>
                  <select
                    className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  >
                    {availableDesignations.map((designation) => (
                      <option
                        key={designation}
                        value={designation}
                      >
                        {designation}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-[0_14px_34px_rgba(34,29,92,0.2)] transition hover:scale-[1.02] disabled:opacity-60 lg:w-auto"
                    disabled={!selectedUser || status === "saving"}
                    type="submit"
                  >
                    Add
                  </button>
                </div>
              </div>

              {selectedUser ? (
                <div className="flex items-center gap-3 rounded-2xl bg-primary-fixed/70 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
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
                <div className="grid gap-2 sm:grid-cols-2">
                  {results.map((user) => (
                    <button
                      key={user.user_id}
                      className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-low px-3 py-2 text-left text-on-surface transition hover:bg-primary-fixed"
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setQuery(user.username);
                        setResults([]);
                        setMessage("");
                        setStatus("idle");
                      }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-bold text-primary">
                        {user.initials || user.acronym || getInitials(user.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{user.name}</span>
                        <span className="block truncate text-xs opacity-75">@{user.username}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : !selectedUser && query.trim().length >= 2 && status !== "searching" ? (
                <p className="rounded-2xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
                  No available users found.
                </p>
              ) : null}

              <p className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}>
                {status === "searching"
                  ? "Searching..."
                  : status === "saving"
                    ? "Adding member..."
                    : message || "Search by username, then assign their club designation."}
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
