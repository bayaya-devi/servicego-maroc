import { expect, test } from "@playwright/test";

const viewports = [
  { name: "android-small", width: 360, height: 800 },
  { name: "android-standard", width: 393, height: 873 },
  { name: "iphone", width: 390, height: 844 },
  { name: "large-phone", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test(`public home fits ${viewport.name}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.width <= 430, isMobile: viewport.width <= 430, colorScheme: "light" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".story-v21")).toBeVisible();
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, title: document.querySelector("#story-title")?.getBoundingClientRect().width || 0 }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.title).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
