import Link from "next/link";
import type { ReactNode } from "react";
import { AuthSessionControl } from "@/components/auth-session-control";
import { HeaderSearch, type HeaderSearchProps } from "@/components/header-search";
import { NotificationsButton } from "@/components/notifications-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CampusNavKey = "feed" | "clubs" | "marketplace" | "games" | "messages" | "profile";

type CampusHeaderProps = {
  active?: CampusNavKey;
  contextAction?: ReactNode;
  feedView?: "home" | "discover";
  searchProps?: Pick<HeaderSearchProps, "placeholder" | "types">;
};

export function CampusHeader({ active, contextAction, feedView = "home", searchProps }: CampusHeaderProps) {
  const homeSelected = active === "feed" && feedView === "home";
  const discoverSelected = active === "feed" && feedView === "discover";

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:px-6">
        <Link href="/" className="text-[1.25rem] font-black tracking-[-0.06em] text-primary">
          Campus Nexus
        </Link>

        <div className="hidden justify-center lg:flex">
          {active === "feed" ? (
            <nav
              aria-label="Feed views"
              className="grid h-12 w-60 grid-cols-2 rounded-[14px] border border-[#2d2d2d] bg-[#151515] p-1"
            >
              <Link
                aria-current={homeSelected ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center rounded-[10px] text-base font-semibold transition-colors",
                  homeSelected ? "bg-white text-black" : "text-[#9ca3af] hover:text-white",
                )}
                href="/?view=home"
              >
                Home
              </Link>
              <Link
                aria-current={discoverSelected ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center rounded-[10px] text-base font-semibold transition-colors",
                  discoverSelected ? "bg-white text-black" : "text-[#9ca3af] hover:text-white",
                )}
                href="/?view=discover"
              >
                Discover
              </Link>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <HeaderSearch className="hidden md:block" expandable {...searchProps} />
          {contextAction}
          <Link
            aria-label="Games"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full text-on-surface-variant")}
            href="/games"
          >
            <span className="material-symbols-outlined shrink-0 text-[22px]">sports_esports</span>
          </Link>
          <NotificationsButton />
          <AuthSessionControl compact />
        </div>
      </div>
    </header>
  );
}
