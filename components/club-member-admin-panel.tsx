"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EntityListItem, profileEntityHref } from "@/components/entity-list-item";
import { API_BASE_URL, isAdminUser, readAuthSession } from "@/lib/auth-client";
import { type CampusUser } from "@/lib/app-data";

type ClubMemberAdminPanelProps = {
  clubSlug: string;
  existingUserIds: string[];
  existingTitles: string[];
};

type Status = "idle" | "searching" | "saving" | "success" | "error";

const DESIGNATIONS = ["President", "Vice President", "Chairman", "Vice Chairman", "Secretary", "Treasurer", "Member"];
const SINGLE_DESIGNATIONS = new Set(DESIGNATIONS.filter((designation) => designation !== "Member"));

export function ClubMemberAdminPanel({ clubSlug, existingUserIds, existingTitles }: ClubMemberAdminPanelProps) {
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
    setCanManageMembers(admin);
    setCanManageDesignations(admin);
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
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-[0_14px_34px_rgba(34,29,92,0.2)] transition hover:scale-[1.02]"
        type="button"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined text-base">person_add</span>
        Add member
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
                <EntityListItem
                  href={profileEntityHref(selectedUser)}
                  title={selectedUser.name}
                  subtitle={`@${selectedUser.username}`}
                  kind="user"
                  initials={selectedUser.initials || selectedUser.acronym}
                  className="flex min-w-0 items-center gap-3 rounded-2xl bg-primary-fixed/70 p-3"
                  avatarClassName="rounded-full bg-primary text-on-primary"
                  trailing={
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
                  }
                />
              ) : null}

              {results.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {results.map((user) => (
                    <EntityListItem
                      key={user.user_id}
                      href={profileEntityHref(user)}
                      title={user.name}
                      subtitle={`@${user.username}`}
                      kind="user"
                      initials={user.initials || user.acronym}
                      trailing={
                        <button
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary transition hover:text-secondary"
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setQuery(user.username);
                            setResults([]);
                            setMessage("");
                            setStatus("idle");
                          }}
                        >
                          Select
                        </button>
                      }
                    />
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
