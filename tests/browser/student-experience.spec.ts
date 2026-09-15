import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, request }) => {
  const fixture = await (await request.get("http://127.0.0.1:5055/__fixture__/session")).json();
  await context.addCookies([{ name: "campusNexusToken", value: fixture.token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript((user) => {
    if (location.origin === "http://127.0.0.1:3100") localStorage.setItem("campusNexusAuth", JSON.stringify({ user }));
  }, fixture.user);
});

for (const width of [360, 768, 1440]) {
  test(`student screens fit at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000); // Each sweep visits eleven routes and captures screenshots.
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [label, route] of Object.entries({ home: "/", clubs: "/clubs", club: "/clubs/design-society", profile: "/alex", activity: "/my_activity", marketplace: "/marketplace", chat: "/chat", games: "/games", leaderboard: "/games/leaderboards", sudoku: "/games/sudoku", "mind-snap": "/games/mind-snap" })) {
      await page.goto(route);
      await page.locator("main").waitFor();
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible({ timeout: 30_000 });
      if (width >= 768) {
        expect((await page.getByRole("searchbox", { name: "Search campus", exact: true }).boundingBox())?.width, label + " search width").toBeGreaterThan(150);
      }
      await expect(page.locator("body")).not.toContainText("Application error");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), label + " overflows").toBeTruthy();
      await page.screenshot({ path: `test-results/screenshots/${label}-${width}.png`, fullPage: label !== "home" });
    }
    expect(errors).toEqual([]);
  });
}

test("feed paginates without duplicate cards and exposes working feedback", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-feed-post]")).toHaveCount(20);
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.locator("[data-feed-post]")).toHaveCount(33);
  const ids = await page.locator("[data-feed-post]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.feedPost));
  expect(new Set(ids).size).toBe(ids.length);
  await page.getByRole("button", { name: "Post options" }).first().click();
  await expect(page.getByText("Why this post?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Not interested", exact: true }).click();
  await expect(page.locator("[data-feed-post]")).toHaveCount(32);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("[data-feed-post]")).toHaveCount(33);
  await page.getByRole("link", { name: "Latest", exact: true }).click();
  await expect(page.getByRole("link", { name: "Latest", exact: true })).toHaveAttribute("aria-current", "page");
});

test("personalization controls persist and reset history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Feed preferences", exact: true }).click();
  expect((await page.getByRole("dialog").boundingBox())?.width).toBeGreaterThan(300);
  await page.screenshot({ path: "test-results/screenshots/preferences-1280.png" });
  const enabled = page.getByRole("checkbox", { name: "Learn from my activity" });
  await expect(enabled).toBeChecked();
  await enabled.uncheck();
  await expect(page.getByText("Feed settings updated.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Feed preferences", exact: true }).click();
  await expect(enabled).not.toBeChecked();
  await enabled.check();
  await page.getByRole("button", { name: "Reset learning history", exact: true }).click();
  await expect(page.getByText("Your learning history has been cleared.", { exact: false })).toBeVisible();
});

test("mobile navigation, post overlay and saved posts are reachable", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("link", { name: "Open post", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/post-detail-360.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "More navigation" }).click();
  await page.getByRole("navigation", { name: "More destinations" }).getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/saved-360.png" });
});

test("feed failures show retry instead of an empty-feed claim", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/feed?**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn't load your feed" })).toBeVisible();
  await expect(page.locator("[data-feed-post]")).toHaveCount(20);
  await page.unroute("**/api/feed?**");
  await page.getByRole("button", { name: "Refresh feed", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn't load your feed" })).not.toBeVisible();
});

test("authentication form fits a small screen", async ({ page, context }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/auth");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: "test-results/screenshots/auth-360.png", fullPage: true });
});

test("comments preserve failed drafts and persist on post detail", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/");
  const card = page.locator("[data-feed-post]").first();
  const postId = await card.getAttribute("data-feed-post");
  await card.getByRole("button", { name: "Comments", exact: true }).click();
  const draft = card.getByRole("textbox", { name: "Write a comment" });
  await draft.fill("Looking forward to this campus conversation!");
  await page.route("**/api/posts/*/comments", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }) : route.continue());
  await card.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(card.getByText("Your comment couldn't be posted. Your draft has been kept.", { exact: true })).toBeVisible();
  await expect(draft).toHaveValue("Looking forward to this campus conversation!");
  await page.unroute("**/api/posts/*/comments");
  await card.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(card.getByText("Comment posted.", { exact: true })).toBeVisible();
  await expect(draft).toHaveValue("");
  await expect(card.getByRole("button", { name: "Comments", exact: true })).toHaveText("1");
  await page.goto(`/viewpost?=${postId}`);
  await expect(page.getByRole("region", { name: "Post comments" }).getByText("Looking forward to this campus conversation!", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/comments-360.png" });
});

test("chat offers friends and disables replies after unfriending", async ({ page, request }) => {
  const fixture = await (await request.get("http://127.0.0.1:5055/__fixture__/session")).json();
  const headers = { Authorization: `Bearer ${fixture.token}` };
  await page.goto("/sam");
  await expect(page.getByRole("button", { name: "Message", exact: true })).toBeDisabled();
  await page.goto("/chat");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  await expect(page.getByRole("button", { name: /Maya Chen/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a friend" }).fill("Sam");
  await expect(page.getByRole("button", { name: /Sam Taylor/ })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Find a friend" }).fill("Maya");
  await page.getByRole("button", { name: /Maya Chen/ }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Hello, friend!");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log", { name: "Messages" }).getByText("Hello, friend!", { exact: true })).toBeVisible();
  try {
    expect((await request.delete("http://127.0.0.1:5055/api/users/2/friends", { headers })).ok()).toBeTruthy();
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await page.screenshot({ path: "test-results/screenshots/chat-friends-only.png" });
  } finally {
    expect((await request.post("http://127.0.0.1:5055/api/users/2/friends", { headers })).ok()).toBeTruthy();
  }
});

test("My Activity is absent from desktop and mobile navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: "My activity", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "More navigation" }).click();
  await expect(page.getByRole("navigation", { name: "More destinations" }).getByRole("link", { name: "My activity", exact: true })).toHaveCount(0);
});

test("post ages stay synchronized across club pages, feed and detail", async ({ page, request }) => {
  const posts = await (await request.get("http://127.0.0.1:5055/api/posts?limit=1")).json();
  const post = posts[0];
  const created = Date.parse(post.createdAt);
  const timeSelector = `time[datetime="${new Date(created).toISOString()}"]`;
  const initialTime = new Date(created + 59_000);
  await page.clock.install({ time: initialTime });
  await page.clock.pauseAt(initialTime);
  await page.goto("/clubs/design-society");
  await expect(page.locator(timeSelector).first()).toHaveText("Just now");
  await page.clock.runFor(2000);
  await expect(page.locator(timeSelector).first()).toHaveText("1 minute ago");
  await page.clock.fastForward(60_000);
  await expect(page.locator(timeSelector).first()).toHaveText("2 minutes ago");
  await page.goto("/");
  const card = page.locator(`[data-feed-post="${post.postId}"]`);
  await expect(card.locator(timeSelector)).toHaveText("2 minutes ago");
  await card.getByRole("link", { name: "Open post", exact: true }).click();
  await expect(page.getByRole("dialog").locator(timeSelector)).toHaveText("2 minutes ago");
  await page.clock.fastForward(60_000);
  await expect(card.locator(timeSelector)).toHaveText("3 minutes ago");
  await expect(page.getByRole("dialog").locator(timeSelector)).toHaveText("3 minutes ago");
  await page.clock.setSystemTime(new Date(created + 3_600_000));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("dialog").locator(timeSelector)).toHaveText("1 hour ago");
  await expect(page.getByRole("dialog").locator(timeSelector)).toHaveAttribute("title", /2026/);
});

test.describe("Home post timezone handling", () => {
  test.use({ timezoneId: "Asia/Kolkata" });
  test("a just-created UTC timestamp without an offset shows Just now in India", async ({ page }) => {
    const now = new Date("2026-09-14T08:00:00Z");
    await page.clock.setFixedTime(now);
    await page.goto("/");
    await page.route("**/api/feed?**", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.feedCards = [{ ...data.feedCards[0], postId: "fresh-time-fixture", id: "fresh-time-fixture", createdAt: "2026-09-14T08:00:00", meta: "2026-09-14T08:00:00" }];
      data.nextCursor = null;
      await route.fulfill({ response, json: data });
    });
    await page.getByRole("button", { name: "Load more", exact: true }).click();
    const postTime = page.locator('[data-feed-post="fresh-time-fixture"] time');
    await expect(postTime).toHaveText("Just now");
    await expect(postTime).toHaveAttribute("datetime", now.toISOString());
  });
});
