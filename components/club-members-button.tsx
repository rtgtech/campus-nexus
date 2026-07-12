"use client";

import { useState } from "react";
import { EntityListItem, profileEntityHref } from "@/components/entity-list-item";
import { type ClubMember } from "@/lib/app-data";

export function ClubMembersButton({ members }: { members: ClubMember[] }) {
  const [open, setOpen] = useState(false);

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
                    <EntityListItem
                      key={member.id}
                      href={profileEntityHref(member)}
                      title={member.name}
                      subtitle={`${member.title || "Member"}${member.username ? ` - @${member.username}` : ""}`}
                      kind="user"
                      initials={member.initials}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
