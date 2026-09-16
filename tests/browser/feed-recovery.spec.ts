import { expect, test } from "@playwright/test";

test("feed retries with a ring and preserves posts after a failed page request", async ({ page, context, request }) => {
  const fixture = await (await request.get("http://127.0.0.1:5055/__fixture__/session")).json();
  await context.addCookies([{ name: "campusNexusToken", value: fixture.token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/");
  await expect(page.locator("[data-feed-post]")).toHaveCount(20);
  let attempts = 0;
  await page.route("**/api/feed?**", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
    } else {
      await route.continue();
    }
  });
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  const refreshing = page.getByRole("status").filter({ hasText: "Refreshing feed" });
  await expect(refreshing).toBeVisible();
  await expect(refreshing.locator("svg")).toHaveClass(/animate-spin/);
  await expect(page.locator("[data-feed-post]")).toHaveCount(20);
  await expect(page.getByRole("alert").filter({ hasText: /feed|refresh|unavailable/i })).toHaveCount(0);
  await expect(page.locator("[data-feed-post]")).toHaveCount(33);
  await expect(refreshing).toHaveCount(0);
  expect(attempts).toBe(2);
  await page.screenshot({ path: "test-results/screenshots/feed-recovered.png" });
});
