"use client";

import Link from "next/link";
import { useState } from "react";
import { ProfileNavLink } from "@/components/profile-nav-link";
import { CreatePostLink } from "@/components/create-post-route";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavKey = "feed" | "clubs" | "marketplace" | "games" | "messages" | "profile";
type NavItemKey = NavKey | "create-post" | "saved";

type CollapsibleSidebarProps = {
  active: NavKey;
};

const navItems: Array<{ key: NavItemKey; label: string; href: string; icon: string }> = [
  { key: "feed", label: "Feed", href: "/", icon: "grid_view" },
  { key: "create-post", label: "Create post", href: "/?=createpost", icon: "add" },
  { key: "saved", label: "Saved", href: "/viewsavedposts?=True", icon: "bookmark" },
  { key: "clubs", label: "Clubs", href: "/clubs", icon: "groups" },
  { key: "marketplace", label: "Marketplace", href: "/marketplace", icon: "storefront" },
  { key: "messages", label: "Chat", href: "/chat", icon: "forum" },
  { key: "profile", label: "Profile", href: "/auth", icon: "person" },
];

export function CollapsibleSidebar({ active }: CollapsibleSidebarProps) {
  const [isHovered, setIsHovered] = useState(false);

  function navClassName(item: (typeof navItems)[number]) {
    const selected = item.key === active;
    const isCreatePost = item.key === "create-post";
    const isCreatePostandFeed = item.key === "create-post" && active === "feed";

    return cn(
      buttonVariants({ variant: "ghost", size: "lg" }),
      isCreatePostandFeed ? "display:none" : "",
      "h-14 rounded-2xl px-3",
      isHovered ? "w-full justify-start gap-3" : "w-14 justify-center",
      isCreatePost
        ? "bg-secondary text-white shadow-[0_18px_40px_rgba(237,32,36,0.2)] hover:bg-secondary-container"
        : selected
          ? "bg-primary text-on-primary shadow-[0_18px_40px_rgba(35,30,93,0.2)]"
          : "text-black hover:bg-primary-fixed hover:text-black",
    );
  }

  const labelClassName = [
    "overflow-hidden whitespace-nowrap transition-all duration-200",
    isHovered ? "max-w-44 opacity-100" : "max-w-0 opacity-0",
  ].join(" ");

  return (
    <aside
      className={[
        "fixed bottom-0 left-0 top-16 z-40 hidden transition-[width] duration-200 ease-out md:block",
        isHovered ? "w-60" : "w-18",
      ].join(" ")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <nav
        aria-label="Primary"
        className="h-full overflow-hidden border-r border-primary/10 bg-white/92 p-2 shadow-[12px_0_34px_rgba(35,30,93,0.08)] backdrop-blur-xl"
      >
        <div className="h-12" />
        <div className="space-y-2">
          {navItems.map((item) => {
            const icon = <span className="material-symbols-outlined shrink-0 text-[22px]">{item.icon}</span>;
            const label = <span className={labelClassName}>{item.label}</span>;

            if (item.key === "profile") {
              return (
                <ProfileNavLink
                  key={item.key}
                  className={navClassName(item)}
                  icon={item.icon}
                  iconClassName="shrink-0 text-[22px]"
                  label={item.label}
                  labelClassName={labelClassName}
                />
              );
            }

            if (item.key === "create-post") {
              return (
                <CreatePostLink key={item.key} className={navClassName(item)} title={item.label}>
                  {icon}
                  {label}
                </CreatePostLink>
              );
            }

            return (
              <Link key={item.key} href={item.href} className={navClassName(item)} title={item.label}>
                {icon}
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
