import Link from "next/link";
import type { ReactNode } from "react";
import { AuthSessionControl } from "@/components/auth-session-control";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { CreatePostLink } from "@/components/create-post-route";
import { HeaderSearch, type HeaderSearchProps } from "@/components/header-search";
import { NotificationsButton } from "@/components/notifications-button";
import { ProfileNavLink } from "@/components/profile-nav-link";

type NavKey = "feed" | "clubs" | "marketplace" | "games" | "messages" | "profile";
type NavItemKey = NavKey | "create-post";

type CampusShellProps = {
  active: NavKey;
  children: ReactNode;
  headerSearchProps?: Pick<HeaderSearchProps, "placeholder" | "types">;
};

const navItems: Array<{ key: NavItemKey; label: string; href: string; icon: string }> = [
  { key: "feed", label: "Feed", href: "/", icon: "grid_view" },
  { key: "create-post", label: "Create post", href: "/?=createpost", icon: "add" },
  { key: "clubs", label: "Clubs", href: "/clubs", icon: "groups" },
  { key: "marketplace", label: "Marketplace", href: "/marketplace", icon: "storefront" },
  { key: "games", label: "Games", href: "/games", icon: "sports_esports" },
  { key: "messages", label: "Chat", href: "/chat", icon: "forum" },
  { key: "profile", label: "Profile", href: "/auth", icon: "person" },
];

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">
            {eyebrow}
          </p>
        ) : null}
        <div>
          <h2 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-on-background md:text-3xl">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-on-surface-variant md:text-base">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CampusShell({ active, children, headerSearchProps }: CampusShellProps) {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-50 border-b border-outline-variant/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto grid h-14 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:px-6">
          <div className="flex items-center">
            <Link
              href="/"
              className=" text-[1.25rem] font-black tracking-[-0.06em] text-primary"
            >
              Campus Nexus
            </Link>
          </div>
          <div className="hidden justify-center md:flex">
            <HeaderSearch className="w-full max-w-sm" {...headerSearchProps} />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container">
              <Link href="/games">
                <span className="material-symbols-outlined shrink-0 text-[22px]">{"sports_esports"}</span>
              </Link>
            </button>
            <NotificationsButton />
            <AuthSessionControl compact />
          </div>
        </div>
      </header>

      <CollapsibleSidebar active={active} />

      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 md:px-6 md:pb-10">
        <main>{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/60 bg-white/90 px-2 pb-3 pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {navItems.map((item) => {
            const selected = item.key === active;
            const isCreatePost = item.key === "create-post";
            const className = [
              "flex min-w-14 flex-col items-center rounded-2xl px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] transition",
              isCreatePost
                ? "bg-secondary px-4 text-white"
                : selected
                  ? "bg-primary-fixed text-primary"
                  : "text-on-surface-variant",
            ].join(" ");
            const label = isCreatePost ? "Create" : item.label;

            if (item.key === "profile") {
              return (
                <ProfileNavLink
                  key={item.key}
                  className={className}
                  icon={item.icon}
                  iconClassName="mb-0.5"
                  label={label}
                />
              );
            }

            if (isCreatePost) {
              return (
                <CreatePostLink key={item.key} className={className}>
                  <span className="material-symbols-outlined mb-0.5">{item.icon}</span>
                  <span>{label}</span>
                </CreatePostLink>
              );
            }

            return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={className}
                >
                  <span className="material-symbols-outlined mb-0.5">{item.icon}</span>
                  <span>{label}</span>
                </Link>
              );
          })}
        </div>
      </nav>
    </div>
  );
}
