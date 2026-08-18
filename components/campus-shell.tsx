import Link from "next/link";
import type { ReactNode } from "react";
import { CampusHeader, type CampusNavKey } from "@/components/campus-header";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { CreatePostLink } from "@/components/create-post-route";
import type { HeaderSearchProps } from "@/components/header-search";
import { ProfileNavLink } from "@/components/profile-nav-link";

type NavItemKey = CampusNavKey | "create-post" | "saved";

type CampusShellProps = {
  active: CampusNavKey;
  children: ReactNode;
  feedView?: "home" | "discover";
  headerSearchProps?: Pick<HeaderSearchProps, "placeholder" | "types">;
};

const navItems: Array<{ key: NavItemKey; label: string; href: string; icon: string }> = [
  { key: "feed", label: "Feed", href: "/", icon: "grid_view" },
  { key: "create-post", label: "Create post", href: "/?=createpost", icon: "add" },
  { key: "saved", label: "Saved", href: "/viewsavedposts?=True", icon: "bookmark" },
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

export function CampusShell({ active, children, feedView = "home", headerSearchProps }: CampusShellProps) {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <CampusHeader active={active} feedView={feedView} searchProps={headerSearchProps} />

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
