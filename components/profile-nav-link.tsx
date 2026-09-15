"use client";

import { CampusIcon } from "@/components/campus-icon";


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
  const profileKey = user?.username || user?.userId;
  return profileKey ? `/${encodeURIComponent(profileKey)}` : "/auth";
}

export function ProfileNavLink({ className, icon, iconClassName, label, labelClassName }: ProfileNavLinkProps) {
  const [href, setHref] = useState("/auth");

  useEffect(() => {
    setHref(profileHref());
  }, []);

  return (
    <Link href={href} className={className}>
      <CampusIcon name={icon} className={iconClassName ? ` ${iconClassName}` : ""} />
      <span className={labelClassName}>{label}</span>
    </Link>
  );
}
