"use client";

import { formatPostTime, parsePostTimestamp } from "@/lib/post-time";
import { useCurrentTime } from "@/lib/use-current-time";

export function PostTime({ value, fallback = "Time unavailable" }: { value?: string; fallback?: string }) {
  const now = useCurrentTime();
  const timestamp = value ? parsePostTimestamp(value) : NaN;
  if (!Number.isFinite(timestamp)) return <span>{value || fallback}</span>;
  const date = new Date(timestamp);
  return <time dateTime={date.toISOString()} title={now ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" }) : undefined}>
    {now ? formatPostTime(value, now) : ""}
  </time>;
}
