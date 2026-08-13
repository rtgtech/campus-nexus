"use client";

import { useState } from "react";
import { EntityListItem, profileEntityHref } from "@/components/entity-list-item";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type ClubMember } from "@/lib/app-data";

export function ClubMembersButton({ members }: { members: ClubMember[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="rounded-full bg-white/14 px-4 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm hover:bg-white/24" />
        }
      >
        View members
      </DialogTrigger>
      <DialogContent className="max-h-[82vh] max-w-xl overflow-hidden rounded-[10px] p-0">
        <DialogHeader className="border-b border-surface-container-highest p-5 pr-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Members</p>
          <DialogTitle className="font-headline-md text-2xl text-on-background">{members.length} members</DialogTitle>
          <DialogDescription className="sr-only">Club member list</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-5">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
