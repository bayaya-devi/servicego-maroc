import { expect, test } from "@playwright/test";

const firstPartyFailure = (baseURL, request) => request.url().startsWith(baseURL)
  && !request.url().includes("/cdn-cgi/")
  && ["document", "script", "stylesheet", "xhr", "fetch"].includes(request.resourceType());

test("public mobile language control is touchable, persistent, and enables Arabic RTL", async ({ page, baseURL }, testInfo) => {
  const failures = [];
  const consoleErrors = [];
  page.on("requestfailed", (request) => {
    if (firstPartyFailure(baseURL, request)) failures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (firstPartyFailure(baseURL, response.request()) && response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".story-v21")).toBeVisible();

  const trigger = page.locator('[data-action="open-language"]');
  await expect(trigger).toBeVisible();
  if (testInfo.project.use.hasTouch) await trigger.tap();
  else await trigger.click();
  const menu = page.locator(".language-nucleus");
  await expect(menu).toBeVisible();
  const bounds = await menu.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: innerWidth, height: innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width);

  const arabic = page.locator('[data-action="set-locale"][data-locale="ar"]');
  if (testInfo.project.use.hasTouch) await arabic.tap();
  else await arabic.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(menu).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
  expect(failures).toEqual([]);
});
