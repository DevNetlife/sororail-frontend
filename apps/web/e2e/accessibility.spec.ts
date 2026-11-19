import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function stubNetwork(page: Page) {
  await page.route(/soroban-testnet\.stellar\.org/, async (request) => {
    const body = request.request().postDataJSON() as { id: number; method: string };
    if (body.method === "getNetwork") {
      await request.fulfill({
        json: {
          jsonrpc: "2.0",
          id: body.id,
          result: { passphrase: "Test SDF Network ; September 2015" },
        },
      });
      return;
    }
    await request.continue();
  });
}

test.describe("mobile navigation at 375px (#405)", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("links collapse behind a toggle that opens, closes on Escape and on navigation", async ({
    page,
  }) => {
    await stubNetwork(page);
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Menu" });
    const payroll = page.getByRole("link", { name: "Payroll" });

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(payroll).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(payroll).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(payroll).toBeHidden();

    await toggle.click();
    await payroll.click();
    await expect(page).toHaveURL(/\/payroll$/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("reduced motion (#407)", () => {
  test.use({ reducedMotion: "reduce" });

  test("no animations run when the user prefers reduced motion", async ({ page }) => {
    await stubNetwork(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    const running = await page.evaluate(
      () => document.getAnimations().filter((animation) => animation.playState === "running").length,
    );
    expect(running).toBe(0);
  });
});

test("keyboard focus shows the shared focus ring (#406)", async ({ page }) => {
  await stubNetwork(page);
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  const outline = await skip.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).toBe("solid");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "SoroRail" })).toBeFocused();
});

const routes = [
  ["/", "Overview"],
  ["/payroll", "Payroll"],
  ["/streams", "Streams"],
  ["/vesting", "Vesting"],
  ["/escrow", "Escrow"],
] as const;

for (const [route, heading] of routes) {
  test(`${route} has no serious or critical accessibility violations`, async ({
    page,
  }) => {
    await page.route(/soroban-testnet\.stellar\.org/, async (request) => {
      const body = request.request().postDataJSON() as {
        id: number;
        method: string;
      };
      if (body.method === "getNetwork") {
        await request.fulfill({
          json: {
            jsonrpc: "2.0",
            id: body.id,
            result: { passphrase: "Test SDF Network ; September 2015" },
          },
        });
        return;
      }
      await request.continue();
    });
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    );

    expect(
      violations,
      `${route}: ${JSON.stringify(violations.map(({ id, help }) => ({ id, help })))}`,
    ).toEqual([]);
  });
}