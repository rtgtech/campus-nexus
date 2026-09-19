import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, request }, testInfo) => {
  if (testInfo.title.startsWith("deleting a club")) return;
  const session = await (await request.get("http://127.0.0.1:5055/__fixture__/session")).json();
  await context.addCookies([{ name: "campusNexusToken", value: session.token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript((user) => localStorage.setItem("campusNexusAuth", JSON.stringify({ user })), session.user);
});

test("club counts are visible and sorting has no selector", async ({ page }) => {
  await page.goto("/clubs");
  await expect(page.locator("article").filter({ hasText: "Design Society" })).toContainText("1 members");
  await expect(page.getByRole("combobox", { name: "Sort clubs" })).toHaveCount(0);
  await page.goto("/clubs/design-society");
  await expect(page.getByText(/1 members/).first()).toBeVisible();
});

test("deleting a club closes confirmation when the next club is selected", async ({ page, context, request }) => {
  const session = await (await request.get("http://127.0.0.1:5055/__fixture__/admin-session")).json();
  await context.addCookies([{ name: "campusNexusToken", value: session.token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript((user) => localStorage.setItem("campusNexusAuth", JSON.stringify({ user })), session.user);
  const created = await request.post("http://127.0.0.1:5055/api/clubs/items", { headers: { Authorization: `Bearer ${session.token}` }, data: { title: "Delete Regression Club", slug: "delete-regression-club" } });
  expect(created.ok()).toBeTruthy();
  await page.goto("/admin?tab=clubs&club=delete-regression-club");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Delete Regression Club");
  await page.getByRole("button", { name: "Delete club", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Design Society", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Delete Design Society?");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

for (const width of [360, 1440]) {
  test(`post media and comments fit at ${width}px`, async ({ page, request }) => {
    const posts = await (await request.get("http://127.0.0.1:5055/api/posts")).json();
    const post = posts[posts.length - 1];
    const mediaUrl = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#224436"/></svg>');
    await page.route(`**/api/posts/${post.postId}`, (route) => route.fulfill({ json: { ...post, mediaUrls: [mediaUrl] } }));
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/viewpost?=${post.postId}`);
    const dialog = page.getByRole("dialog");
    const media = dialog.locator("article img");
    const comments = dialog.getByRole("region", { name: "Post comments" });
    await expect(media).toBeVisible();
    await expect(comments).toBeVisible();
    await expect(comments.getByText("No comments yet. Start the conversation.")).toBeVisible();
    const imageBox = (await media.boundingBox())!;
    const commentsBox = (await comments.boundingBox())!;
    if (width >= 768) expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(commentsBox.x + 1);
    else expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(commentsBox.y + 1);
    expect(await dialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBeTruthy();
    await page.screenshot({ path: `test-results/screenshots/split-post-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}
