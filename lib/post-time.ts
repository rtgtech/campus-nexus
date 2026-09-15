function ago(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export function parsePostTimestamp(value: string) {
  const trimmed = value.trim();
  // SQLite/legacy API timestamps without an offset represent UTC, matching
  // the backend's as_utc helper. Date's default would interpret them locally.
  const normalized = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)
    ? trimmed.replace(" ", "T") + "Z"
    : trimmed;
  return new Date(normalized).getTime();
}

export function formatPostTime(value?: string, now = Date.now()) {
  if (!value) return "";

  const parsedTime = parsePostTimestamp(value);
  if (!Number.isFinite(parsedTime)) return value;

  const seconds = Math.max(0, Math.floor((now - parsedTime) / 1000));
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return ago(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ago(hours, "hour");

  const days = Math.floor(hours / 24);
  if (days < 30) return ago(days, "day");
  if (days < 365) return ago(Math.floor(days / 30), "month");
  return ago(Math.floor(days / 365), "year");
}
