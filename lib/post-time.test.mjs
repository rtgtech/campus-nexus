import assert from "node:assert/strict";
import test from "node:test";
import { formatPostTime, parsePostTimestamp } from "./post-time.ts";

test("formats post time boundaries", () => {
  const now = Date.parse("2026-07-20T12:00:00Z");
  const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();

  assert.equal(formatPostTime(daysAgo(360), now), "12 months ago");
  assert.equal(formatPostTime(daysAgo(365), now), "1 year ago");
  assert.equal(formatPostTime("2026-07-20T11:59:30Z", now), "Just now");
});

test("timestamp offsets and legacy UTC values describe the same instant in every timezone", () => {
  const previousZone = process.env.TZ;
  const now = Date.parse("2026-09-14T08:00:00Z");
  try {
    for (const zone of ["UTC", "Asia/Kolkata", "America/New_York"]) {
      process.env.TZ = zone;
      assert.equal(formatPostTime("2026-09-14T08:00:00", now), "Just now", zone);
      for (const value of ["2026-09-14T07:00:00Z", "2026-09-14T12:30:00+05:30", "2026-09-14T03:00:00-04:00", "2026-09-14T07:00:00", "2026-09-14 07:00:00.000000"]) {
        assert.equal(formatPostTime(value, now), "1 hour ago", `${zone}: ${value}`);
        assert.equal(parsePostTimestamp(value), now - 3_600_000);
      }
    }
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test("relative ages cross minute, hour, and day boundaries consistently", () => {
  const post = "2026-09-14T07:00:00.250Z";
  const created = Date.parse(post);
  for (const [elapsed, label] of [[59_999, "Just now"], [60_000, "1 minute ago"], [3_599_999, "59 minutes ago"], [3_600_000, "1 hour ago"], [86_400_000, "1 day ago"]]) {
    assert.equal(formatPostTime(post, created + elapsed), label);
  }
  assert.equal(formatPostTime(undefined, created), "");
  assert.equal(formatPostTime("2h ago", created), "2h ago");
});
