import type { ReactNode } from "react";
import { CampusHeader, type CampusNavKey } from "@/components/campus-header";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import type { HeaderSearchProps } from "@/components/header-search";

export function SectionTitle({ eyebrow, title, description, action }: {
  eyebrow?: string; title: string; description?: string; action?: ReactNode;
}) {
  return <div className="flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>{action}
  </div>;
}

export function CampusShell({ active, children, headerSearchProps, contextAction }: {
  active: CampusNavKey;
  children: ReactNode;
  feedView?: "home" | "discover";
  headerSearchProps?: Pick<HeaderSearchProps, "placeholder" | "types">;
  contextAction?: ReactNode;
}) {
  return <div className="min-h-screen bg-background text-foreground">
    <CampusHeader active={active} searchProps={headerSearchProps} contextAction={contextAction} />
    <CollapsibleSidebar active={active} />
    <div className="md:pl-20 xl:pl-56">
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 md:px-8 md:pb-12 lg:pt-10">{children}</main>
    </div>
  </div>;
}
