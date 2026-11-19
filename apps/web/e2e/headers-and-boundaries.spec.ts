import { expect, test } from "@playwright/test";

test("security headers are sent (#403)", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("connect-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-frame-options"]).toBe("DENY");
});

test("unknown route shows the custom 404 (#401)", async ({ page }) => {
  const res = await page.goto("/this-route-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to overview" })).toBeVisible();
});
