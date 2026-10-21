import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";

const baseUrl = process.env.SERVICEGO_URL || "http://127.0.0.1:8787";
const browser = await chromium.launch({ headless: true });
const axeResults = [];

try {
  for (const scenario of [
    { name: "desktop-fr-home", locale: "fr", viewport: { width: 1440, height: 900 }, auth: false },
    { name: "desktop-ar-auth", locale: "ar", viewport: { width: 1440, height: 900 }, auth: true },
    { name: "mobile-fr-auth", locale: "fr", viewport: { width: 390, height: 844 }, auth: true },
    { name: "mobile-ar-home", locale: "ar", viewport: { width: 390, height: 844 }, auth: false },
  ]) {
    const context = await browser.newContext({ viewport: scenario.viewport });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate((locale) => localStorage.setItem("servicego-locale", locale), scenario.locale);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#main-content").waitFor({ state: "visible" });
    if (scenario.auth) {
      await page.locator('[data-action="open-auth"]').first().click();
      await page.locator('form[data-form="auth"]').waitFor({ state: "visible" });
    }
    const result = await new AxeBuilder({ page }).analyze();
    const blocking = result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    axeResults.push({ name: scenario.name, violations: result.violations.length, blocking: blocking.map((violation) => violation.id) });
    assert.deepEqual(blocking, [], `${scenario.name} has serious or critical accessibility violations`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${scenario.name} overflows horizontally`);
    await context.close();
  }
} finally {
  await browser.close();
}

const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
let lighthouseSummary;
try {
  const result = await lighthouse(baseUrl, {
    port: chrome.port,
    logLevel: "error",
    output: "json",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  });
  assert.ok(result?.lhr, "Lighthouse did not return a report");
  const { categories, audits } = result.lhr;
  lighthouseSummary = {
    performance: categories.performance.score,
    accessibility: categories.accessibility.score,
    bestPractices: categories["best-practices"].score,
    seo: categories.seo.score,
    lcpMs: audits["largest-contentful-paint"].numericValue,
    cls: audits["cumulative-layout-shift"].numericValue,
    tbtMs: audits["total-blocking-time"].numericValue,
  };
  assert.ok(lighthouseSummary.performance >= 0.6, "Lighthouse performance score is below 0.60");
  assert.ok(lighthouseSummary.accessibility >= 0.9, "Lighthouse accessibility score is below 0.90");
  assert.ok(lighthouseSummary.bestPractices >= 0.9, "Lighthouse best-practices score is below 0.90");
  assert.ok(lighthouseSummary.seo >= 0.9, "Lighthouse SEO score is below 0.90");
  assert.ok(lighthouseSummary.cls <= 0.1, "CLS exceeds 0.10");
} finally {
  await chrome.kill();
}

console.log(JSON.stringify({ axe: axeResults, lighthouse: lighthouseSummary }, null, 2));
