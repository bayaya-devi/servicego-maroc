import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public home and authentication modal have no serious accessibility violations", async ({ page, baseURL }) => {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".story-v21")).toBeVisible();
  const homeResults = await new AxeBuilder({ page }).analyze();
  expect(homeResults.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);

  await page.locator('.public-nucleus [data-action="open-auth"]').click();
  await expect(page.locator(".auth-modal")).toBeVisible();
  const modalResults = await new AxeBuilder({ page }).include(".auth-modal").analyze();
  expect(modalResults.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);
});
