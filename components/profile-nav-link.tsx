"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readAuthSession } from "@/lib/auth-client";

type ProfileNavLinkProps = {
  className: string;
  icon: string;
  iconClassName?: string;
  label: string;
  labelClassName?: string;
};

function profileHref() {
  const session = readAuthSession();
  const user = session?.user;
  const profileKey = user?.username || user?.user_id || user?.userId || user?.id;
  return profileKey ? `/${encodeURIComponent(profileKey)}` : "/auth";
}

export function ProfileNavLink({ className, icon, iconClassName, label, labelClassName }: ProfileNavLinkProps) {
  const [href, setHref] = useState("/auth");

  useEffect(() => {
    setHref(profileHref());
  }, []);

  return (
    <Link href={href} className={className}>
      <span className={iconClassName ? `material-symbols-outlined ${iconClassName}` : "material-symbols-outlined"}>{icon}</span>
      <span className={labelClassName}>{label}</span>
    </Link>
  );
}
