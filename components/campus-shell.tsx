import Link from "next/link";
import type { ReactNode } from "react";
import { profileAvatar } from "@/lib/demo-data";

type NavKey = "feed" | "club" | "marketplace" | "games" | "messages" | "profile";
type NavItemKey = NavKey | "create-post";

type CampusShellProps = {
  active: NavKey;
  children: ReactNode;
  userHref?: string;
};

const navItems: Array<{ key: NavItemKey; label: string; href: string; icon: string }> = [
  { key: "feed", label: "Feed", href: "/", icon: "grid_view" },
  { key: "create-post", label: "Create post", href: "/?=createpost", icon: "add" },
  { key: "club", label: "Clubs", href: "/clubs", icon: "groups" },
  { key: "marketplace", label: "Marketplace", href: "/marketplace", icon: "storefront" },
  { key: "games", label: "Games", href: "/games", icon: "sports_esports" },
  { key: "messages", label: "Chat", href: "/chat", icon: "forum" },
  { key: "profile", label: "Profile", href: "/aarav", icon: "person" },
];

function navHref(itemHref: string, userHref: string) {
  return itemHref === "/aarav" ? userHref : itemHref;
}

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

export function CampusShell({ active, children, userHref = "/aarav" }: CampusShellProps) {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-50 border-b border-outline-variant/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:px-6">
          <div className="flex items-center">
            <Link
              href="/"
              className="font-['Space_Grotesk'] text-2xl font-black tracking-[-0.06em] text-primary"
            >
              Campus Nexus
            </Link>
          </div>
          <div className="hidden justify-center md:flex">
            <div className="w-full max-w-sm rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 md:flex md:items-center md:gap-3">
              <span className="material-symbols-outlined text-base text-on-surface-variant">search</span>
              <input
                className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                placeholder="Search Bengaluru campus spaces..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container">
              <span className="material-symbols-outlined">bolt</span>
            </button>
            <button className="relative rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-secondary" />
            </button>
            <Link href={userHref} className="relative block">
              <img
                alt="Profile avatar"
                className="h-10 w-10 rounded-full border-2 border-primary object-cover"
                src={profileAvatar}
              />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-secondary shadow-[0_0_12px_rgba(236,32,36,0.45)]" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pb-28 pt-6 md:grid-cols-12 md:px-6 md:pb-10">
        <aside className="hidden md:col-span-3 md:block">
          <nav className="sticky top-24 space-y-2">
            {navItems.map((item) => {
              const selected = item.key === active;
              const isCreatePost = item.key === "create-post";
              return (
                <Link
                  key={item.key}
                  href={navHref(item.href, userHref)}
                  className={[
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    isCreatePost
                      ? "bg-secondary text-white shadow-[0_18px_40px_rgba(236,32,36,0.22)] hover:scale-[1.01]"
                      : selected
                      ? "bg-primary text-on-primary shadow-[0_18px_40px_rgba(34,29,92,0.22)]"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-primary",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="mt-8 overflow-hidden rounded-[28px] bg-primary p-6 text-white shadow-[0_24px_60px_rgba(34,29,92,0.24)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">Live on Campus</p>
              <h3 className="mt-3 font-['Space_Grotesk'] text-xl font-bold">Bengaluru Indie Night</h3>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Open mic sets, filter coffee stalls, and student DJs are taking over the central lawn in Bengaluru tonight.
              </p>
              <button className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-primary transition hover:scale-[1.02]">
                Book Pass
              </button>
            </div>
          </nav>
        </aside>

        <main className="md:col-span-9">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/60 bg-white/90 px-2 pb-5 pt-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {navItems.map((item) => {
            const selected = item.key === active;
            const isCreatePost = item.key === "create-post";
            return (
              <Link
                key={item.key}
                href={navHref(item.href, userHref)}
                className={[
                  "flex min-w-16 flex-col items-center rounded-2xl px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition",
                  isCreatePost
                    ? "bg-secondary px-4 text-white"
                    : selected
                    ? "bg-primary-fixed text-primary"
                    : "text-on-surface-variant",
                ].join(" ")}
              >
                <span className="material-symbols-outlined mb-1">{item.icon}</span>
                <span>{isCreatePost ? "Create" : item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
