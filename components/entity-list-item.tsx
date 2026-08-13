"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { getInitials } from "@/lib/app-data";

type EntityKind = "user" | "club" | "post" | "product";

type ProfileLike = {
  username?: string | null;
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
  return `/${encodeURIComponent(profile.username || profile.userId || profile.id || "")}`;
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
    <Item className={rowClassName}>
      <ItemMedia>
        <Link href={href} aria-label={title} onClick={onNavigate}>
          <Avatar className={`size-10 text-xs font-bold ${avatarClasses}`}>
            {image ? <AvatarImage alt="" src={image} /> : null}
            <AvatarFallback className="bg-transparent text-inherit">
              {initials || kind === "user" ? (
                initials || getInitials(title)
              ) : (
                <span className="material-symbols-outlined text-xl">{icon || defaultIcons[kind]}</span>
              )}
            </AvatarFallback>
            {badgeIcon ? (
              <AvatarBadge
                aria-label={badgeLabel}
                className="size-5 bg-background text-primary ring-1 ring-background"
                title={badgeLabel}
              >
                <span className="material-symbols-outlined text-[11px] leading-none">{badgeIcon}</span>
              </AvatarBadge>
            ) : null}
          </Avatar>
        </Link>
      </ItemMedia>
      <ItemContent className="min-w-0">
        <Link href={href} onClick={onNavigate}>
          <ItemTitle className={titleClassName ?? defaultTitleClassName}>{title}</ItemTitle>
          {subtitle ? (
            <ItemDescription className={subtitleClassName ?? defaultSubtitleClassName}>{subtitle}</ItemDescription>
          ) : null}
        </Link>
      </ItemContent>
      {trailing ? <ItemActions>{trailing}</ItemActions> : null}
      {badgeLabel && !badgeIcon ? <Badge>{badgeLabel}</Badge> : null}
    </Item>
  );
}
