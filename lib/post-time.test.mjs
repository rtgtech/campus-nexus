import assert from "node:assert/strict";
import test from "node:test";
import { formatPostTime } from "./post-time.ts";

test("formats post time boundaries", () => {
  const now = Date.parse("2026-07-20T12:00:00Z");
  const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();

  assert.equal(formatPostTime(daysAgo(360), now), "12 months ago");
  assert.equal(formatPostTime(daysAgo(365), now), "1 year ago");
  assert.equal(formatPostTime("2026-07-20T11:59:30Z", now), "Just now");
});
