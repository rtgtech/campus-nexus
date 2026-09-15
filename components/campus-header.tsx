import Link from "next/link";
import type { ReactNode } from "react";
import { AuthSessionControl } from "@/components/auth-session-control";
import { HeaderSearch, type HeaderSearchProps } from "@/components/header-search";
import { NotificationsButton } from "@/components/notifications-button";

export type CampusNavKey = "feed" | "clubs" | "marketplace" | "games" | "messages" | "profile";

export function CampusHeader({ contextAction, searchProps, showSearchBar = true }: {
  active?: CampusNavKey;
  contextAction?: ReactNode;
  feedView?: "home" | "discover";
  searchProps?: Pick<HeaderSearchProps, "placeholder" | "types">;
  showSearchBar?: boolean;
}) {
  return <header className="sticky top-0 z-40 border-b border-border bg-white">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <div className="flex min-h-16 items-center justify-between gap-3 px-4 md:px-6">
      <Link href="/" aria-label="Campus Nexus home" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-primary">
        <span aria-hidden="true" className="flex size-8 items-center justify-center bg-primary text-sm text-white">cn<span className="text-on-secondary-fixed-variant">.</span></span>
        <span className="hidden min-[400px]:inline">Campus Nexus</span>
      </Link>
      {showSearchBar && <HeaderSearch className="min-w-0 flex-1 sm:max-w-md" {...searchProps} />}
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">{contextAction}<NotificationsButton /><AuthSessionControl compact /></div>
    </div>
  </header>;
}
