import { expect, test } from "@playwright/test";

const locales = ["fr", "en", "ar"];
const colorSchemes = ["light", "dark"];

for (const locale of locales) {
  for (const colorScheme of colorSchemes) {
    test(`public interface is readable in ${locale} ${colorScheme}`, async ({ browser, baseURL }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        colorScheme,
      });
      await context.addInitScript((selectedLocale) => localStorage.setItem("servicego-locale", selectedLocale), locale);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".story-v21")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await page.screenshot({ path: testInfo.outputPath(`${locale}-${colorScheme}-home.png`), fullPage: false });
      await page.locator('.public-nucleus [data-action="open-auth"]').tap();
      await expect(page.locator(".auth-modal")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${locale}-${colorScheme}-auth.png`), fullPage: false });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        replacementCharacter: document.body.innerText.includes("�"),
      }));
      expect(layout.overflow).toBeLessThanOrEqual(1);
      expect(layout.replacementCharacter).toBe(false);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
