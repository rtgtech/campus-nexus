import Link from "next/link";
import { ProfileNavLink } from "@/components/profile-nav-link";

type BottomNavKey = "feed" | "club" | "marketplace" | "games" | "messages" | "profile";

type SourceBottomNavProps = {
  active: BottomNavKey;
  variant: "club" | "games";
};

const items: Array<{ key: BottomNavKey; label: string; href: string; icon: string }> = [
  { key: "feed", label: "Feed", href: "/", icon: "grid_view" },
  { key: "club", label: "Clubs", href: "/clubs", icon: "groups" },
  { key: "marketplace", label: "Market", href: "/marketplace", icon: "storefront" },
  { key: "games", label: "Games", href: "/games", icon: "sports_esports" },
  { key: "messages", label: "Chat", href: "/chat", icon: "forum" },
  { key: "profile", label: "Profile", href: "/auth", icon: "person" },
];

export function SourceBottomNav({ active, variant }: SourceBottomNavProps) {
  const shellClass =
    variant === "games"
      ? "fixed bottom-0 left-0 w-full flex justify-around items-center px-3 pt-2 pb-3 bg-white/95 dark:bg-primary/95 backdrop-blur-2xl border-t border-surface-container-highest shadow-2xl z-50"
      : "fixed bottom-0 left-0 w-full flex justify-around items-center px-3 pt-2 pb-3 bg-white/95 backdrop-blur-2xl border-t border-surface-container-highest shadow-xl z-50";

  return (
    <nav className={shellClass}>
      {items.map((item) => {
        const isActive = item.key === active;

        let className =
          "flex flex-col items-center justify-center px-2.5 py-1 transition-all duration-300";

        if (isActive && variant === "club") {
          className += " text-primary bg-primary/5 rounded-2xl px-4";
        } else if (isActive && variant === "games" && item.key === "games") {
          className += " text-secondary bg-secondary-fixed-dim/20 rounded-2xl active:scale-90";
        } else {
          className +=
            " text-outline hover:text-primary";
          if (variant === "games") {
            className += " active:scale-90 duration-150";
          }
        }

        if (item.key === "profile") {
          return (
            <ProfileNavLink
              key={item.key}
              className={className}
              icon={item.icon}
              label={item.label}
              labelClassName="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em]"
            />
          );
        }

        return (
          <Link key={item.key} href={item.href} className={className}>
            <span
              className="material-symbols-outlined"
              style={
                isActive && (item.key === "club" || item.key === "marketplace" || item.key === "games")
                  ? { fontVariationSettings: "'FILL' 1" }
                  : undefined
              }
            >
              {item.icon}
            </span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em]">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
