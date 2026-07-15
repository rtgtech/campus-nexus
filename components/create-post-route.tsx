"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { CreatePostOverlay } from "@/components/create-post-overlay";

export function CreatePostLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  const pathname = usePathname();
  return <Link {...props} href={`${pathname}?=createpost`} />;
}

export function CreatePostRoute() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const show = [searchParams.get(""), searchParams.get("mode"), searchParams.get("view")].includes("createpost");
  if (!show) return null;

  const remaining = new URLSearchParams(searchParams.toString());
  for (const key of ["", "mode", "view"]) {
    if (remaining.get(key) === "createpost") remaining.delete(key);
  }
  const returnHref = `${pathname}${remaining.size ? `?${remaining}` : ""}`;
  return <CreatePostOverlay returnHref={returnHref} />;
}
