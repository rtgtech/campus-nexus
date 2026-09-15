"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Gamepad2, Home, Menu, MessageCircle, Plus, ShoppingBag, User, Users } from "lucide-react";
import { readAuthSession } from "@/lib/auth-client";
import { CreatePostLink } from "@/components/create-post-route";
import { ChatUnreadBadge } from "@/components/chat-unread-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CampusNavKey } from "@/components/campus-header";
import { cn } from "@/lib/utils";

const items = [
  { key: "feed", label: "Home", href: "/", icon: Home },
  { key: "clubs", label: "Clubs", href: "/clubs", icon: Users },
  { key: "messages", label: "Chat", href: "/chat", icon: MessageCircle },
  { key: "marketplace", label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { key: "games", label: "Games", href: "/games", icon: Gamepad2 },
  { key: "saved", label: "Saved", href: "/viewsavedposts?=True", icon: Bookmark },
  { key: "profile", label: "Profile", href: "/auth", icon: User },
];

export function CollapsibleSidebar({ active }: { active: CampusNavKey }) {
  const [more, setMore] = useState(false);
  const [profile, setProfile] = useState("/auth");
  useEffect(() => {
    const user = readAuthSession()?.user;
    if (user) setProfile("/" + encodeURIComponent(user.username || user.userId));
  }, []);
  const renderLink = (item: typeof items[number], mobile = false) => <Link
    key={item.key} href={item.key === "profile" ? profile : item.href} onClick={() => setMore(false)}
    title={item.label} aria-current={active === item.key ? "page" : undefined}
    className={cn("relative flex min-h-11 items-center gap-3 rounded px-3 text-sm font-medium transition-colors hover:bg-muted",
      active === item.key && "bg-accent text-primary",
      mobile ? "flex-col justify-center gap-1 px-1 py-2 text-xs" : "md:justify-center xl:justify-start")}
  ><span className="relative"><item.icon size={20} aria-hidden="true" />{item.key === "messages" && <ChatUnreadBadge />}</span>
    <span className={mobile ? "" : "md:hidden xl:inline"}>{item.label}</span>
  </Link>;
  return <>
    <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-20 border-r border-border bg-white p-3 md:block xl:w-56 xl:p-5">
      <nav aria-label="Primary" className="space-y-1">{items.map((item) => renderLink(item))}
        <CreatePostLink className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded bg-primary px-3 text-sm font-semibold text-white hover:bg-primary/90">
          <Plus size={20} aria-hidden="true" /><span className="hidden xl:inline">Create post</span><span className="sr-only xl:hidden">Create post</span>
        </CreatePostLink>
      </nav>
      <p className="absolute bottom-6 hidden text-xs text-muted-foreground xl:block">Your campus. Your people.</p>
    </aside>
    <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden">
      <div className="grid grid-cols-5">
        {renderLink(items[0], true)}{renderLink(items[1], true)}
        <CreatePostLink className="flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-primary"><Plus size={22} aria-hidden="true" />Create</CreatePostLink>
        {renderLink(items[2], true)}
        <button type="button" aria-label="More navigation" aria-haspopup="dialog" aria-expanded={more} onClick={() => setMore(true)} className="flex min-h-11 flex-col items-center justify-center gap-1 text-xs font-medium"><Menu size={20} aria-hidden="true" />More</button>
      </div>
    </nav>
    <Dialog open={more} onOpenChange={setMore}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>More from your campus</DialogTitle></DialogHeader>
      <nav aria-label="More destinations" className="grid gap-2">{items.slice(3).map((item) => renderLink(item, true))}</nav>
    </DialogContent></Dialog>
  </>;
}
