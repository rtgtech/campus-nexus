"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthSessionControl } from "@/components/auth-session-control";
import { ClubMemberAdminPanel } from "@/components/club-member-admin-panel";
import { EntityListItem, clubEntityHref, profileEntityHref } from "@/components/entity-list-item";
import { API_BASE_URL, authFetch, type CampusAuthSession, isAdminUser, readAuthSession } from "@/lib/auth-client";
import { type CampusUser, type ClubDetailData, type ClubsData, type ClubMember } from "@/lib/app-data";

type AdminDashboardProps = {
  clubsData: ClubsData;
  selectedClub: ClubDetailData | null;
  selectedSlug: string;
};

export function AdminDashboard({ clubsData, selectedClub, selectedSlug }: AdminDashboardProps) {
  const router = useRouter();
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);
  const [deletingClub, setDeletingClub] = useState(false);
  const [memberMessage, setMemberMessage] = useState("");
  const [users, setUsers] = useState<CampusUser[]>([]);
  const [usersMessage, setUsersMessage] = useState("Loading users...");

  useEffect(() => {
    setSession(readAuthSession());
    setSessionLoaded(true);
  }, []);

  const isAdmin = isAdminUser(session?.user);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const controller = new AbortController();
    authFetch(`${API_BASE_URL}/api/users`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Loading users failed");
        }
        setUsers(Array.isArray(data) ? data : []);
        setUsersMessage("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setUsersMessage(error instanceof Error ? error.message : "Loading users failed");
        }
      });
    return () => controller.abort();
  }, [isAdmin]);

  const clubCards = clubsData.clubCards;
  const stats = useMemo(
    () => [
      { label: "Clubs", value: String(clubCards.length), icon: "groups" },
      { label: "Spotlight", value: String(clubsData.spotlightClubs.length), icon: "stars" },
      {
        label: "Club posts",
        value: String(clubCards.reduce((total, club) => total + (club.postsCount ?? 0), 0)),
        icon: "article",
      },
      {
        label: "Open clubs",
        value: String(clubCards.filter((club) => club.status.toLowerCase() === "open").length),
        icon: "lock_open",
      },
    ],
    [clubCards, clubsData.spotlightClubs.length],
  );

  async function removeMember(member: ClubMember) {
    if (!session || !selectedClub) {
      return;
    }

    setRemovingMemberId(member.id);
    setMemberMessage("");

    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/clubs/${encodeURIComponent(selectedClub.club.slug)}/members/${member.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Remove member failed");
      }

      setMemberMessage(`${member.name} removed.`);
      router.refresh();
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "Remove member failed");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function togglePosting(member: ClubMember) {
    if (!session || !selectedClub) return;

    setUpdatingMemberId(member.id);
    setMemberMessage("");
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/clubs/${encodeURIComponent(selectedClub.club.slug)}/members/${member.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canPost: !member.canPost }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Updating posting privilege failed");

      setMemberMessage(`${member.name} ${member.canPost ? "can no longer post" : "can now post"}.`);
      router.refresh();
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "Updating posting privilege failed");
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function deleteClub() {
    const club = selectedClub?.club;
    if (!session || !club?.id || !window.confirm(`Delete ${club.title}? This will remove it from Campus Nexus.`)) {
      return;
    }

    setDeletingClub(true);
    setMemberMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/clubs/items/${club.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Delete club failed");
      }
      router.push("/admin");
      router.refresh();
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "Delete club failed");
      setDeletingClub(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background">
      <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5">
          <Link href="/admin" className="font-headline-lg text-2xl font-black tracking-tighter text-primary">
            Campus Nexus Admin
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/clubs"
              className="hidden rounded-full border border-outline-variant/70 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary sm:inline-flex"
            >
              Public clubs
            </Link>
            <AuthSessionControl compact />
          </div>
        </div>
      </header>

      {!sessionLoaded ? (
        <main className="mx-auto max-w-7xl px-5 py-10">
          <section className="rounded-[28px] border border-surface-container-highest bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-on-surface-variant">Checking admin access...</p>
          </section>
        </main>
      ) : !isAdmin ? (
        <main className="mx-auto max-w-3xl px-5 py-10">
          <section className="rounded-[28px] border border-surface-container-highest bg-white p-8 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Admin only</p>
            <h1 className="mt-2 font-headline-lg text-3xl text-on-background">Sign in with the admin account.</h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Club creation and member management now live only on this page.
            </p>
            <Link
              href="/auth"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
            >
              <span className="material-symbols-outlined text-base">login</span>
              Sign in
            </Link>
          </section>
        </main>
      ) : (
        <main className="mx-auto max-w-7xl space-y-6 px-5 py-8">
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Dashboard</p>
              <h1 className="mt-2 font-headline-lg text-4xl text-on-background">Administration</h1>
            </div>
            <Link
              href="/admin?mode=createclub"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
            >
              <span className="material-symbols-outlined text-base">group_add</span>
              Create club
            </Link>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[24px] border border-surface-container-highest bg-white p-5 shadow-sm">
                <span className="material-symbols-outlined rounded-full bg-primary-fixed p-3 text-primary">
                  {stat.icon}
                </span>
                <p className="mt-4 font-headline-md text-3xl text-primary">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  {stat.label}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-[28px] border border-surface-container-highest bg-white p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Users</p>
              <h2 className="mt-1 font-headline-md text-2xl text-on-background">All users ({users.length})</h2>
            </div>

            {usersMessage ? (
              <p className="mt-5 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">{usersMessage}</p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-2xl border border-outline-variant/60">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-surface-container-low text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">User ID</th>
                      <th className="px-4 py-3 font-semibold">Year</th>
                      <th className="px-4 py-3 font-semibold">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {users.map((user) => (
                      <tr key={user.userId} className="text-on-surface">
                        <td className="px-4 py-3 font-semibold">
                          <Link href={profileEntityHref(user)} className="hover:text-primary hover:underline">
                            {user.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{user.userId}</td>
                        <td className="px-4 py-3">{user.yearOfStudy}</td>
                        <td className="px-4 py-3">{user.department}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-[28px] border border-surface-container-highest bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Clubs</p>
                  <h2 className="mt-1 font-headline-md text-2xl text-on-background">Manage records</h2>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {clubCards.length === 0 ? (
                  <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                    No clubs yet.
                  </p>
                ) : (
                  clubCards.map((club) => {
                    const selected = club.slug === selectedSlug;
                    return (
                      <EntityListItem
                        key={club.slug}
                        href={clubEntityHref(club)}
                        title={club.title}
                        subtitle={club.status || "No status"}
                        kind="club"
                        icon={club.icon}
                        selected={selected}
                        className={[
                          "flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 transition",
                          selected ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-primary-fixed",
                        ].join(" ")}
                        avatarClassName={`rounded-xl text-white ${selected ? "bg-white/18" : club.iconBg}`}
                        titleClassName={selected ? "block truncate text-sm font-semibold text-white" : undefined}
                        subtitleClassName={selected ? "block truncate text-xs text-white/75" : undefined}
                        trailing={
                          <Link
                            href={`/admin?club=${encodeURIComponent(club.slug)}`}
                            className={
                              selected
                                ? "rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white"
                                : "rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
                            }
                          >
                            {selected ? "Selected" : "Manage"}
                          </Link>
                        }
                      />
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-surface-container-highest bg-white p-5 shadow-sm">
              {!selectedClub ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-dashed border-outline-variant/70 bg-surface-container-low p-6 text-center">
                  <span className="material-symbols-outlined rounded-full bg-primary-fixed p-4 text-3xl text-primary">
                    groups
                  </span>
                  <h2 className="mt-4 font-headline-md text-2xl text-on-background">Select a club</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
                    Create a club or pick one from the list to manage members.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-[24px] border border-surface-container-highest">
                    <div className={`relative h-44 ${selectedClub.club.bannerBg}`}>
                      {selectedClub.club.bannerImage ? (
                        <img
                          alt={selectedClub.club.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          src={selectedClub.club.bannerImage}
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-primary/65" />
                      <div className="relative flex h-full items-end justify-between gap-4 p-5 text-white">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
                            Selected club
                          </p>
                          <h2 className="mt-2 truncate font-headline-lg text-3xl text-white">
                            {selectedClub.club.title}
                          </h2>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link
                            href={clubEntityHref(selectedClub.club)}
                            className="rounded-full bg-white/14 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur transition hover:bg-white/24"
                          >
                            View public
                          </Link>
                          <button
                            type="button"
                            onClick={deleteClub}
                            disabled={deletingClub}
                            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            {deletingClub ? "Deleting" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Members</p>
                      <h3 className="mt-1 font-headline-md text-2xl text-on-background">
                        {selectedClub.members.length} members
                      </h3>
                    </div>
                    <ClubMemberAdminPanel
                      clubSlug={selectedClub.club.slug}
                      existingUserIds={selectedClub.members.map((member) => member.userId)}
                      existingTitles={selectedClub.members.map((member) => member.title || "Member")}
                    />
                  </div>

                  <div className="space-y-2">
                    {selectedClub.members.length === 0 ? (
                      <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        No members yet.
                      </p>
                    ) : (
                      selectedClub.members.map((member) => (
                        <EntityListItem
                          key={member.id}
                          href={profileEntityHref(member)}
                          title={member.name}
                          subtitle={`${member.title || "Member"}${member.username ? ` - @${member.username}` : ""}`}
                          kind="user"
                          initials={member.initials}
                          trailing={
                            <div className="flex items-center gap-1">
                              {member.title.toLowerCase() === "member" ? (
                                <button
                                  aria-label={`${member.canPost ? "Revoke" : "Grant"} posting privilege for ${member.name}`}
                                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${member.canPost ? "bg-primary text-white" : "bg-white text-primary hover:bg-primary-fixed"}`}
                                  disabled={updatingMemberId === member.id}
                                  type="button"
                                  onClick={() => togglePosting(member)}
                                >
                                  {member.canPost ? "Can post" : "Allow posting"}
                                </button>
                              ) : null}
                              <button
                                aria-label={`Remove ${member.name}`}
                                className="rounded-full p-2 text-on-surface-variant transition hover:bg-white hover:text-secondary disabled:opacity-50"
                                disabled={removingMemberId === member.id}
                                type="button"
                                onClick={() => removeMember(member)}
                              >
                                <span className="material-symbols-outlined text-lg">close</span>
                              </button>
                            </div>
                          }
                        />
                      ))
                    )}
                  </div>

                  {memberMessage ? (
                    <p className="rounded-2xl bg-surface-container-low p-3 text-sm font-semibold text-on-surface-variant">
                      {memberMessage}
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
