"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EntityListItem, profileEntityHref } from "@/components/entity-list-item";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { API_BASE_URL, authFetch, isAdminUser, readAuthSession } from "@/lib/auth-client";
import { type CampusUser } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";

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

        const users = parseApiResponse<CampusUser[]>("/api/users", await response.json());
        setResults(users.filter((user) => !existingUserIds.includes(user.userId)));
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
      const response = await authFetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(clubSlug)}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.userId,
          title,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Add member failed");
      }
      parseApiResponse(`/api/clubs/${clubSlug}/members`, data);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-[3px] px-4" />}>
        Add member
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-[3px] border-outline-variant bg-white p-5 md:p-6">
            <DialogHeader className="pr-10">
                <p className="text-xs font-medium text-on-surface-variant">Club administration</p>
                <DialogTitle className="mt-1 text-xl font-semibold text-on-background">Add member</DialogTitle>
                <DialogDescription className="sr-only">Search for a user and assign a club designation</DialogDescription>
            </DialogHeader>

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                <Field>
                  <FieldLabel htmlFor="club-member-username">Username</FieldLabel>
                  <Input
                    id="club-member-username"
                    className="h-10 rounded-[3px] border-outline-variant bg-white px-3"
                    placeholder="Search username"
                    type="text"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSelectedUser(null);
                      setMessage("");
                    }}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="member-designation">Designation</FieldLabel>
                  <NativeSelect
                    className="w-full [&_select]:h-10 [&_select]:rounded-[3px] [&_select]:border-outline-variant [&_select]:bg-white"
                    id="member-designation"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  >
                    {availableDesignations.map((designation) => (
                      <NativeSelectOption
                        key={designation}
                        value={designation}
                      >
                        {designation}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                <div className="flex items-end">
                  <Button
                    className="h-10 w-full rounded-[3px] px-4 lg:w-auto"
                    disabled={!selectedUser || status === "saving"}
                    type="submit"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {selectedUser ? (
                <EntityListItem
                  href={profileEntityHref(selectedUser)}
                  title={selectedUser.name}
                  subtitle={`@${selectedUser.username}`}
                  kind="user"
                  initials={selectedUser.initials}
                  className="flex min-w-0 items-center gap-3 border border-outline-variant bg-[#f7f7f4] p-3"
                  avatarClassName="rounded-[3px] bg-primary text-on-primary"
                  trailing={
                    <Button
                      className="rounded-[3px] text-on-surface-variant hover:bg-white hover:text-secondary"
                      size="icon-sm"
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setQuery("");
                        setMessage("");
                      }}
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </Button>
                  }
                />
              ) : null}

              {results.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {results.map((user) => (
                    <EntityListItem
                      key={user.userId}
                      href={profileEntityHref(user)}
                      title={user.name}
                      subtitle={`@${user.username}`}
                      kind="user"
                      initials={user.initials}
                      trailing={
                        <Button
                          className="rounded-[3px] bg-white px-3 py-1.5 text-xs font-semibold text-primary transition hover:text-secondary"
                          size="sm"
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
                        </Button>
                      }
                    />
                  ))}
                </div>
              ) : !selectedUser && query.trim().length >= 2 && status !== "searching" ? (
                <p className="border border-outline-variant bg-[#f7f7f4] p-3 text-sm text-on-surface-variant">
                  No available users found.
                </p>
              ) : null}

              <p className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}>
                {status === "searching"
                  ? <span className="inline-flex items-center gap-2"><Spinner /> Searching...</span>
                  : status === "saving"
                    ? "Adding member..."
                    : message || "Search by username, then assign their club designation."}
              </p>
            </form>
      </DialogContent>
    </Dialog>
  );
}
