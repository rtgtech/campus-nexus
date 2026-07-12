"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthSessionControl } from "@/components/auth-session-control";
import { ClubMemberAdminPanel } from "@/components/club-member-admin-panel";
import { EntityListItem, clubEntityHref, profileEntityHref } from "@/components/entity-list-item";
import { API_BASE_URL, type CampusAuthSession, isAdminUser, readAuthSession } from "@/lib/auth-client";
import { type ClubDetailData, type ClubsData, type ClubMember } from "@/lib/app-data";

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
  const [memberMessage, setMemberMessage] = useState("");

  useEffect(() => {
    setSession(readAuthSession());
    setSessionLoaded(true);
  }, []);

  const isAdmin = isAdminUser(session?.user);
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
      const response = await fetch(
        `${API_BASE_URL}/api/clubs/${encodeURIComponent(selectedClub.club.slug)}/members/${member.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
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
              <h1 className="mt-2 font-headline-lg text-4xl text-on-background">Club administration</h1>
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
                        <Link
                          href={clubEntityHref(selectedClub.club)}
                          className="shrink-0 rounded-full bg-white/14 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur transition hover:bg-white/24"
                        >
                          View public
                        </Link>
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
                      existingUserIds={selectedClub.members.map((member) => member.user_id)}
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
                            <button
                              aria-label={`Remove ${member.name}`}
                              className="rounded-full p-2 text-on-surface-variant transition hover:bg-white hover:text-secondary disabled:opacity-50"
                              disabled={removingMemberId === member.id}
                              type="button"
                              onClick={() => removeMember(member)}
                            >
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
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
