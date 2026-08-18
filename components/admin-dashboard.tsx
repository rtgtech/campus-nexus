"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { CampusHeader } from "@/components/campus-header";
import { ClubMemberAdminPanel } from "@/components/club-member-admin-panel";
import { clubEntityHref, profileEntityHref } from "@/components/entity-list-item";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { API_BASE_URL, authFetch, type CampusAuthSession, isAdminUser, readAuthSession } from "@/lib/auth-client";
import {
  type CampusUser,
  type ClubDetailData,
  type ClubMember,
  type ClubsData,
  getInitials,
  type SignalBarItem,
} from "@/lib/app-data";
import { cn } from "@/lib/utils";

type AdminTab = "profiles" | "clubs" | "signals";

type AdminDashboardProps = {
  clubsData: ClubsData;
  initialTab: AdminTab;
  initialSignalItems: SignalBarItem[];
  selectedClub: ClubDetailData | null;
  selectedSlug: string;
};

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: "profiles", label: "Profiles" },
  { id: "clubs", label: "Clubs" },
  { id: "signals", label: "Signal Bar" },
];

const clubRoles = [
  "President",
  "Vice President",
  "Chairman",
  "Vice Chairman",
  "Secretary",
  "Treasurer",
  "Member",
];

function isSafeSignalLink(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function AdminDashboard({ clubsData, initialTab, initialSignalItems, selectedClub, selectedSlug }: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);
  const [deletingClub, setDeletingClub] = useState(false);
  const [memberMessage, setMemberMessage] = useState("");
  const [users, setUsers] = useState<CampusUser[]>([]);
  const [usersMessage, setUsersMessage] = useState("Loading profiles...");
  const [signalItems, setSignalItems] = useState<SignalBarItem[]>(() => initialSignalItems.map((item) => ({ ...item })));
  const [signalFormOpen, setSignalFormOpen] = useState(false);
  const [signalSaving, setSignalSaving] = useState(false);
  const [editingSignalId, setEditingSignalId] = useState<string | null>(null);
  const [signalTitle, setSignalTitle] = useState("");
  const [signalLink, setSignalLink] = useState("");
  const [signalMessage, setSignalMessage] = useState("");

  useEffect(() => {
    setSession(readAuthSession());
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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
          throw new Error(typeof data.error === "string" ? data.error : "Loading profiles failed");
        }
        setUsers(Array.isArray(data) ? data : []);
        setUsersMessage("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setUsersMessage(error instanceof Error ? error.message : "Loading profiles failed");
        }
      });

    return () => controller.abort();
  }, [isAdmin]);

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    setMemberMessage("");
    router.replace(`/admin?tab=${tab}`, { scroll: false });
  }

  async function removeMember(member: ClubMember) {
    if (!session || !selectedClub) {
      return;
    }

    setRemovingMemberId(member.id);
    setMemberMessage("");

    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/clubs/${encodeURIComponent(selectedClub.club.slug)}/members/${member.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Remove member failed");
      }

      setMemberMessage(`${member.name} was removed from the club.`);
      router.refresh();
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "Remove member failed");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function updateMemberRole(member: ClubMember, title: string) {
    if (!session || !selectedClub || title === member.title) {
      return;
    }

    setUpdatingMemberId(member.id);
    setMemberMessage("");

    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/clubs/${encodeURIComponent(selectedClub.club.slug)}/members/${member.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Role update failed");
      }

      setMemberMessage(`${member.name} is now ${title}.`);
      router.refresh();
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "Role update failed");
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function deleteClub() {
    const club = selectedClub?.club;
    if (!session || !club?.id) {
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
      router.push("/admin?tab=clubs");
      router.refresh();
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "Delete club failed");
      setDeletingClub(false);
    }
  }

  function beginAddSignal() {
    setEditingSignalId(null);
    setSignalTitle("");
    setSignalLink("");
    setSignalMessage("");
    setSignalFormOpen(true);
  }

  function beginEditSignal(signal: SignalBarItem) {
    setEditingSignalId(signal.id);
    setSignalTitle(signal.title);
    setSignalLink(signal.link);
    setSignalMessage("");
    setSignalFormOpen(true);
  }

  function cancelSignalForm() {
    setEditingSignalId(null);
    setSignalTitle("");
    setSignalLink("");
    setSignalMessage("");
    setSignalFormOpen(false);
  }

  async function saveSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = signalTitle.trim();
    const link = signalLink.trim();

    if (!title || !link) {
      setSignalMessage("Title and link are required.");
      return;
    }
    if (!isSafeSignalLink(link)) {
      setSignalMessage("Use an internal path beginning with / or a full http(s) link.");
      return;
    }

    setSignalSaving(true);
    setSignalMessage("");
    try {
      const response = await authFetch(
        editingSignalId
          ? `${API_BASE_URL}/api/signal-bar/${encodeURIComponent(editingSignalId)}`
          : `${API_BASE_URL}/api/signal-bar`,
        {
          method: editingSignalId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, link }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Signal Bar update failed");
      }
      const saved = data as SignalBarItem;
      if (editingSignalId) {
        setSignalItems((items) => items.map((item) => (item.id === editingSignalId ? saved : item)));
        setSignalMessage("Title updated.");
      } else {
        setSignalItems((items) => [...items, saved].sort((left, right) => (left.position ?? 0) - (right.position ?? 0)));
        setSignalMessage("Title added.");
      }
      setEditingSignalId(null);
      setSignalTitle("");
      setSignalLink("");
      setSignalFormOpen(false);
      router.refresh();
    } catch (error) {
      setSignalMessage(error instanceof Error ? error.message : "Signal Bar update failed");
    } finally {
      setSignalSaving(false);
    }
  }

  const panelClassName = "border border-outline-variant/70 bg-white";

  return (
    <div className="min-h-screen bg-[#f7f7f4] font-sans text-on-background">
      <CampusHeader
        contextAction={
          <Link
            href="/clubs"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "hidden rounded-[3px] border-outline-variant bg-white px-3 text-on-surface-variant hover:text-on-surface xl:inline-flex",
            )}
          >
            Public clubs
          </Link>
        }
      />

      {!sessionLoaded ? (
        <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <section className={cn(panelClassName, "p-6")}>
            <p className="text-sm text-on-surface-variant">Checking admin access...</p>
          </section>
        </main>
      ) : !isAdmin ? (
        <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
          <section className={cn(panelClassName, "p-7")}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Admin only</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Administrator sign-in required</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-on-surface-variant">
              Profiles, clubs, roles, and signal-bar settings are available to the administrator account.
            </p>
            <Link href="/auth" className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-[3px] px-4")}>
              Sign in
            </Link>
          </section>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Campus Nexus</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">Administration</h1>
            </div>
            <p className="text-sm text-on-surface-variant">Signed in as {session?.user.name}</p>
          </header>

          <nav aria-label="Admin sections" className="mt-8 flex gap-7 border-b border-outline-variant/70">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "-mb-px border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors",
                    selected
                      ? "border-on-surface text-on-surface"
                      : "border-transparent text-on-surface-variant hover:text-on-surface",
                  )}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {activeTab === "profiles" ? (
            <section aria-labelledby="profiles-heading" className="mt-7">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 id="profiles-heading" className="text-xl font-semibold">Registered profiles</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Every student account registered in the app.</p>
                </div>
                {!usersMessage ? <p className="text-sm text-on-surface-variant">{users.length} total</p> : null}
              </div>

              <div className={cn(panelClassName, "mt-5 overflow-hidden")}>
                {usersMessage ? (
                  <p className="p-5 text-sm text-on-surface-variant">{usersMessage}</p>
                ) : users.length === 0 ? (
                  <p className="p-5 text-sm text-on-surface-variant">No registered profiles.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/60">
                    {users.map((user) => (
                      <Link
                        key={user.userId}
                        href={profileEntityHref(user)}
                        className="grid gap-3 px-4 py-4 transition-colors hover:bg-[#f3f3ef] focus-visible:bg-[#f3f3ef] focus-visible:outline-none sm:grid-cols-[minmax(0,1.5fr)_minmax(110px,0.7fr)_minmax(100px,0.6fr)] sm:items-center"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center border border-outline-variant bg-[#fafaf7] text-xs font-semibold">
                            {user.initials || getInitials(user.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{user.name}</span>
                            <span className="block truncate text-xs text-on-surface-variant">@{user.username}</span>
                          </span>
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {user.department || "Department unavailable"} · Year {user.yearOfStudy}
                        </span>
                        <span className="flex items-center justify-between gap-2 text-xs text-on-surface-variant sm:justify-end">
                          ID {user.userId}
                          <span aria-hidden="true">→</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "clubs" ? (
            <section aria-labelledby="clubs-heading" className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="clubs-heading" className="text-xl font-semibold">Clubs</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Create clubs and manage member roles.</p>
                </div>
                <Link
                  href="/admin?tab=clubs&mode=createclub"
                  className={cn(buttonVariants({ size: "lg" }), "rounded-[3px] px-4")}
                >
                  Create club
                </Link>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className={cn(panelClassName, "self-start p-3")}>
                  <p className="px-2 pb-3 text-xs font-medium text-on-surface-variant">{clubsData.clubCards.length} clubs</p>
                  {clubsData.clubCards.length === 0 ? (
                    <p className="border-t border-outline-variant/60 px-2 py-4 text-sm text-on-surface-variant">No clubs yet.</p>
                  ) : (
                    <div className="divide-y divide-outline-variant/60 border-t border-outline-variant/60">
                      {clubsData.clubCards.map((club) => {
                        const selected = club.slug === selectedSlug;
                        return (
                          <Link
                            key={club.slug}
                            href={`/admin?tab=clubs&club=${encodeURIComponent(club.slug)}`}
                            className={cn(
                              "block border-l-2 px-3 py-3 transition-colors",
                              selected
                                ? "border-on-surface bg-[#f1f1ec]"
                                : "border-transparent hover:bg-[#f7f7f3]",
                            )}
                          >
                            <span className="block truncate text-sm font-semibold">{club.title}</span>
                            <span className="mt-0.5 block text-xs text-on-surface-variant">{club.status || "Status unavailable"}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </aside>

                <div className={cn(panelClassName, "min-w-0 p-5 md:p-6")}>
                  {!selectedClub ? (
                    <div className="flex min-h-64 items-center justify-center text-center">
                      <div>
                        <h3 className="text-lg font-semibold">Select a club</h3>
                        <p className="mt-2 text-sm text-on-surface-variant">Choose a club from the list to manage it.</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/70 pb-5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-2xl font-semibold tracking-tight">{selectedClub.club.title}</h3>
                            <span className="border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant">
                              {selectedClub.club.status}
                            </span>
                          </div>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                            {selectedClub.club.description || "No club description."}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link
                            href={clubEntityHref(selectedClub.club)}
                            className={cn(buttonVariants({ variant: "outline" }), "rounded-[3px] border-outline-variant")}
                          >
                            View
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  className="rounded-[3px]"
                                  disabled={deletingClub}
                                  variant="destructive"
                                />
                              }
                            >
                              {deletingClub ? "Deleting" : "Delete"}
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {selectedClub.club.title}?</AlertDialogTitle>
                                <AlertDialogDescription>This will remove the club from Campus Nexus.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={deleteClub}>Delete club</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold">Members</h4>
                          <p className="mt-1 text-xs text-on-surface-variant">Assign a designation or return a user to Member.</p>
                        </div>
                        <ClubMemberAdminPanel
                          clubSlug={selectedClub.club.slug}
                          existingUserIds={selectedClub.members.map((member) => member.userId)}
                          existingTitles={selectedClub.members.map((member) => member.title || "Member")}
                        />
                      </div>

                      <div className="mt-4 overflow-x-auto border border-outline-variant/70">
                        {selectedClub.members.length === 0 ? (
                          <p className="p-4 text-sm text-on-surface-variant">No members yet.</p>
                        ) : (
                          <table className="w-full min-w-[620px] border-collapse text-left">
                            <thead className="border-b border-outline-variant/70 bg-[#f7f7f4] text-xs font-medium text-on-surface-variant">
                              <tr>
                                <th className="px-3 py-2.5 font-medium">Member</th>
                                <th className="px-3 py-2.5 font-medium">Role</th>
                                <th className="px-3 py-2.5 text-right font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/60">
                              {selectedClub.members.map((member) => {
                                const rolesUsedByOthers = new Set(
                                  selectedClub.members
                                    .filter((candidate) => candidate.id !== member.id)
                                    .map((candidate) => candidate.title),
                                );
                                return (
                                  <tr key={member.id}>
                                    <td className="px-3 py-3">
                                      <Link href={profileEntityHref(member)} className="group flex min-w-0 items-center gap-3">
                                        <span className="flex size-8 shrink-0 items-center justify-center border border-outline-variant bg-[#fafaf7] text-[11px] font-semibold">
                                          {member.initials || getInitials(member.name)}
                                        </span>
                                        <span className="min-w-0">
                                          <span className="block truncate text-sm font-semibold group-hover:underline">{member.name}</span>
                                          <span className="block truncate text-xs text-on-surface-variant">@{member.username}</span>
                                        </span>
                                      </Link>
                                    </td>
                                    <td className="px-3 py-3">
                                      <NativeSelect
                                        aria-label={`Role for ${member.name}`}
                                        className="w-48 [&_select]:rounded-[3px] [&_select]:border-outline-variant [&_select]:bg-white"
                                        disabled={updatingMemberId === member.id}
                                        value={member.title || "Member"}
                                        onChange={(event) => updateMemberRole(member, event.target.value)}
                                      >
                                        {clubRoles.map((role) => (
                                          <NativeSelectOption
                                            key={role}
                                            disabled={role !== "Member" && rolesUsedByOthers.has(role)}
                                            value={role}
                                          >
                                            {role}
                                          </NativeSelectOption>
                                        ))}
                                      </NativeSelect>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                      <Button
                                        aria-label={`Remove ${member.name} from ${selectedClub.club.title}`}
                                        className="rounded-[3px] text-on-surface-variant"
                                        disabled={removingMemberId === member.id}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                        onClick={() => removeMember(member)}
                                      >
                                        {removingMemberId === member.id ? "Removing" : "Remove"}
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {memberMessage ? (
                        <p aria-live="polite" className="mt-3 border-l-2 border-on-surface bg-[#f3f3ef] px-3 py-2 text-sm text-on-surface-variant">
                          {memberMessage}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "signals" ? (
            <section aria-labelledby="signals-heading" className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="signals-heading" className="text-xl font-semibold">Signal Bar</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Review the titles and destinations shown above the home feed.</p>
                </div>
                <Button className="rounded-[3px] px-4" type="button" onClick={beginAddSignal}>Add title</Button>
              </div>

              {signalFormOpen ? (
                <form className={cn(panelClassName, "mt-5 p-4")} onSubmit={saveSignal}>
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                    <div>
                      <Label htmlFor="signal-title">Title</Label>
                      <Input
                        id="signal-title"
                        className="mt-1.5 h-10 rounded-[3px] border-outline-variant bg-white"
                        maxLength={160}
                        placeholder="Campus update title"
                        value={signalTitle}
                        onChange={(event) => setSignalTitle(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="signal-link">Link</Label>
                      <Input
                        id="signal-link"
                        className="mt-1.5 h-10 rounded-[3px] border-outline-variant bg-white"
                        maxLength={2048}
                        placeholder="/clubs or https://example.com"
                        value={signalLink}
                        onChange={(event) => setSignalLink(event.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button className="h-10 rounded-[3px] px-4" disabled={signalSaving} type="submit">
                        {signalSaving ? "Saving" : editingSignalId ? "Update" : "Add"}
                      </Button>
                      <Button className="h-10 rounded-[3px]" disabled={signalSaving} type="button" variant="outline" onClick={cancelSignalForm}>Cancel</Button>
                    </div>
                  </div>
                  {signalMessage ? <p className="mt-3 text-sm text-destructive">{signalMessage}</p> : null}
                </form>
              ) : signalMessage ? (
                <p aria-live="polite" className="mt-4 border-l-2 border-on-surface bg-[#f3f3ef] px-3 py-2 text-sm text-on-surface-variant">
                  {signalMessage}
                </p>
              ) : null}

              <div className={cn(panelClassName, "mt-4 overflow-hidden")}>
                <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-4 border-b border-outline-variant/70 bg-[#f7f7f4] px-4 py-2.5 text-xs font-medium text-on-surface-variant md:grid">
                  <span>Title</span>
                  <span>Link</span>
                  <span>Action</span>
                </div>
                <div className="divide-y divide-outline-variant/60">
                  {signalItems.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-on-surface-variant">No Signal Bar titles yet.</p>
                  ) : signalItems.map((signal) => (
                    <div key={signal.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] md:items-center">
                      <a className="min-w-0 truncate text-sm font-semibold underline-offset-4 hover:underline" href={signal.link}>
                        {signal.title}
                      </a>
                      <span className="min-w-0 truncate font-mono text-xs text-on-surface-variant">{signal.link}</span>
                      <Button className="w-fit rounded-[3px]" size="sm" type="button" variant="outline" onClick={() => beginEditSignal(signal)}>
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={cn(panelClassName, "mt-5 overflow-hidden")}>
                <div className="border-b border-outline-variant/70 px-4 py-3">
                  <h3 className="text-sm font-semibold">Preview</h3>
                </div>
                <div className="flex min-h-12 items-center overflow-x-auto whitespace-nowrap px-4">
                  {signalItems.map((signal, index) => (
                    <span key={signal.id} className="flex items-center">
                      {index > 0 ? <span className="mx-4 text-outline">/</span> : null}
                      <a className="text-sm underline-offset-4 hover:underline" href={signal.link}>{signal.title}</a>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </main>
      )}
    </div>
  );
}
