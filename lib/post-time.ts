function ago(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export function formatPostTime(value?: string, now = Date.now()) {
  if (!value) return "";

  const parsedTime = new Date(value).getTime();
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
