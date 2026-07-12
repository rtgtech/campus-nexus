"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { getInitials } from "@/lib/app-data";

type EntityKind = "user" | "club" | "post" | "product";

type ProfileLike = {
  username?: string | null;
  user_id?: string | null;
  userId?: string | null;
  id?: string | number | null;
};

type ClubLike = {
  slug: string;
};

type EntityListItemProps = {
  href: string;
  title: string;
  kind?: EntityKind;
  subtitle?: ReactNode;
  image?: string;
  icon?: string;
  initials?: string;
  selected?: boolean;
  trailing?: ReactNode;
  className?: string;
  avatarClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  badgeIcon?: string;
  badgeLabel?: string;
  onNavigate?: () => void;
};

const defaultIcons: Record<EntityKind, string> = {
  user: "person",
  club: "groups",
  post: "article",
  product: "storefront",
};

export function profileEntityHref(profile: ProfileLike) {
  return `/${encodeURIComponent(profile.username || profile.user_id || profile.userId || profile.id || "")}`;
}

export function clubEntityHref(club: ClubLike) {
  return `/clubs/${encodeURIComponent(club.slug)}`;
}

export function EntityListItem({
  href,
  title,
  kind = "user",
  subtitle,
  image,
  icon,
  initials,
  selected = false,
  trailing,
  className,
  avatarClassName,
  titleClassName,
  subtitleClassName,
  badgeIcon,
  badgeLabel,
  onNavigate,
}: EntityListItemProps) {
  const rowClassName =
    className ??
    [
      "flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 transition",
      selected ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-primary-fixed",
    ].join(" ");
  const avatarClasses =
    avatarClassName ??
    (selected
      ? `${kind === "club" ? "rounded-xl" : "rounded-full"} bg-white/18 text-white`
      : `${kind === "club" ? "rounded-xl" : "rounded-full"} bg-primary-fixed text-primary`);
  const defaultTitleClassName = selected
    ? "block truncate text-sm font-semibold text-white"
    : "block truncate text-sm font-semibold text-on-surface";
  const defaultSubtitleClassName = selected
    ? "block truncate text-xs text-white/75"
    : "block truncate text-xs text-on-surface-variant";

  return (
    <div className={rowClassName}>
      <Link
        href={href}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center text-xs font-bold ${avatarClasses}`}
        aria-label={title}
        onClick={onNavigate}
      >
        {image ? (
          <span className={`absolute inset-0 overflow-hidden ${kind === "club" ? "rounded-xl" : "rounded-full"}`}>
            <img alt="" className="h-full w-full object-cover" src={image} />
          </span>
        ) : initials || kind === "user" ? (
          <span>{initials || getInitials(title)}</span>
        ) : (
          <span className="material-symbols-outlined text-xl">{icon || defaultIcons[kind]}</span>
        )}
        {badgeIcon ? (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white text-primary shadow-sm"
            aria-label={badgeLabel}
            title={badgeLabel}
          >
            <span className="material-symbols-outlined text-[11px] leading-none">{badgeIcon}</span>
          </span>
        ) : null}
      </Link>
      <Link href={href} className="min-w-0 flex-1" onClick={onNavigate}>
        <span className={titleClassName ?? defaultTitleClassName}>{title}</span>
        {subtitle ? (
          <span className={subtitleClassName ?? defaultSubtitleClassName}>{subtitle}</span>
        ) : null}
      </Link>
      {trailing}
    </div>
  );
}
