"use client";

import Link from "next/link";
import { useState } from "react";
import { ProfileNavLink } from "@/components/profile-nav-link";
import { CreatePostLink } from "@/components/create-post-route";

type NavKey = "feed" | "clubs" | "marketplace" | "games" | "messages" | "profile";
type NavItemKey = NavKey | "create-post";

type CollapsibleSidebarProps = {
  active: NavKey;
};

const navItems: Array<{ key: NavItemKey; label: string; href: string; icon: string }> = [
  { key: "feed", label: "Feed", href: "/", icon: "grid_view" },
  { key: "create-post", label: "Create post", href: "/?=createpost", icon: "add" },
  { key: "clubs", label: "Clubs", href: "/clubs", icon: "groups" },
  { key: "marketplace", label: "Marketplace", href: "/marketplace", icon: "storefront" },
  { key: "messages", label: "Chat", href: "/chat", icon: "forum" },
  { key: "profile", label: "Profile", href: "/auth", icon: "person" },
];

export function CollapsibleSidebar({ active }: CollapsibleSidebarProps) {
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isHovered;

  function navClassName(item: (typeof navItems)[number]) {
    const selected = item.key === active;
    const isCreatePost = item.key === "create-post";
    const isCreatePostandFeed = item.key === "create-post" && active === "feed";

    return [
      isCreatePostandFeed ? "display:none" : "",
      "flex h-14 items-center  rounded-2xl px-3 text-sm font-semibold transition-colors duration-200",
      isHovered ? "w-full justify-start gap-3" : "w-14 justify-center",
      isCreatePost
        ? "bg-secondary text-white shadow-[0_18px_40px_rgba(236,32,36,0.18)] hover:bg-secondary-container"
        : selected
          ? "bg-primary text-on-primary shadow-[0_18px_40px_rgba(34,29,92,0.18)]"
          : "text-on-surface-variant hover:bg-surface-container hover:text-primary",
    ].join(" ");
  }

  const labelClassName = [
    "overflow-hidden whitespace-nowrap transition-all duration-200",
    isHovered ? "max-w-44 opacity-100" : "max-w-0 opacity-0",
  ].join(" ");

  return (
    <aside
      className={[
        "fixed bottom-0 left-0 top-14 z-40 hidden transition-[width] duration-200 ease-out md:block",
        isHovered ? "w-[15rem]" : "w-[4.5rem]",
      ].join(" ")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <nav
        aria-label="Primary"
        className="h-full overflow-hidden border-r border-outline-variant/60 bg-white/92 p-2 shadow-[12px_0_34px_rgba(27,27,35,0.08)] backdrop-blur-xl"
      >
        {/* <button
          aria-expanded={isHovered}
          aria-label={isPinnedOpen ? "Collapse sidebar" : "Expand sidebar"}
          className={[
            "mb-1 flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container hover:text-primary",
            isExpanded ? "w-full justify-start" : "w-14 justify-center",
          ].join(" ")}
          type="button"
          onClick={() => setIsPinnedOpen((current) => !current)}
        >
          <span className="material-symbols-outlined shrink-0 text-[22px]">
            {"menu"}
          </span>
          <span className={labelClassName}></span>
        </button> */}
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
