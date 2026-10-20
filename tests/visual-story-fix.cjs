const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const baseUrl = process.env.SERVICEGO_URL || "http://127.0.0.1:8787";
const output = path.resolve("docs/frontend/screenshots-story-fix");
const browserPath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find(existsSync);

function mockPublicApi(page) {
  return page.route("**/api/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === "/api/me" ? { user: null }
      : pathname === "/api/config" ? { mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: "OpenStreetMap" }
        : pathname === "/api/public-context" ? { country: "MA", region: "Rabat-Salé-Kénitra", city: "Rabat", source: "test" }
          : pathname === "/api/categories" ? { categories: [] } : {};
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function scrollToScene(page, selector) {
  await page.evaluate(({ target }) => {
    const story = document.querySelector(".story-v21");
    const markers = { ".moment-one": 0, ".moment-two": 0.45, ".moment-three": 0.91 };
    const offset = story.offsetTop + (story.offsetHeight - innerHeight) * markers[target];
    scrollTo({ top: offset, behavior: "instant" });
  }, { target: selector });
  await page.waitForFunction((target) => {
    const scene = document.querySelector(target);
    const style = getComputedStyle(scene);
    const rect = scene.getBoundingClientRect();
    return Number(style.opacity) > 0.75 && rect.bottom > 64 && rect.top < innerHeight - 64;
  }, selector);
}

async function assertScene(page, selector, photoSelector, label, capture) {
  await scrollToScene(page, selector);
  await page.waitForFunction((sceneSelector) => [...document.querySelectorAll(`${sceneSelector} .character`)]
    .every((character) => character.complete && character.naturalWidth > 0), selector);
  const state = await page.evaluate(({ sceneSelector, imageSelector }) => {
    const scene = document.querySelector(sceneSelector);
    const image = document.querySelector(imageSelector);
    const photo = document.querySelector(imageSelector === ".photo-one" ? ".photo-one" : ".photo-two");
    const viewport = document.querySelector(".story-viewport").getBoundingClientRect();
    const rect = scene.getBoundingClientRect();
    return {
      sceneOpacity: Number(getComputedStyle(scene).opacity),
      sceneTop: rect.top,
      sceneBottom: rect.bottom,
      viewportTop: viewport.top,
      viewportBottom: viewport.bottom,
      photoVisible: Number(getComputedStyle(photo).opacity) > 0.7,
      hasPhoto: getComputedStyle(photo).backgroundImage !== "none",
      charactersReady: [...scene.querySelectorAll(".character")].every((character) => character.complete && character.naturalWidth > 0),
      staticFallback: document.querySelector(".story-v21").classList.contains("story-static"),
    };
  }, { sceneSelector: selector, imageSelector: photoSelector });
  assert.ok(state.sceneOpacity > 0.75, `${label}: scene remains invisible`);
  assert.ok(state.sceneBottom > 64 && state.sceneTop < 800, `${label}: scene does not intersect the viewport`);
  assert.equal(state.hasPhoto, true, `${label}: missing scene photo`);
  assert.equal(state.photoVisible, true, `${label}: scene photo is hidden`);
  assert.equal(state.charactersReady, true, `${label}: official characters did not load`);
  if (capture) await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: false });
}

async function runCase(browser, { name, viewport, locale, colorScheme, reducedMotion, capture }) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript((selectedLocale) => localStorage.setItem("servicego-locale", selectedLocale), locale);
  await mockPublicApi(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".story-v21").waitFor({ state: "visible" });

  await assertScene(page, ".moment-one", ".photo-one", `${name}-scene-1`, capture);
  // Exercise both gradual scroll updates and a direct jump through the story.
  for (const progress of [0.12, 0.24, 0.36]) {
    await page.evaluate((value) => {
      const story = document.querySelector(".story-v21");
      scrollTo({ top: story.offsetTop + (story.offsetHeight - innerHeight) * value, behavior: "instant" });
    }, progress);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await assertScene(page, ".moment-two", ".photo-one", `${name}-scene-2`, capture);
  await assertScene(page, ".moment-three", reducedMotion === "reduce" ? ".photo-one" : ".photo-two", `${name}-scene-3`, capture);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".story-v21").waitFor({ state: "visible" });
  await scrollToScene(page, ".moment-two");
  await page.setViewportSize({ width: viewport.width, height: Math.max(640, viewport.height - 80) });
  await scrollToScene(page, ".moment-three");
  assert.deepEqual(errors, [], `${name}: browser errors: ${errors.join(" | ")}`);
  await context.close();
}

(async () => {
  assert.ok(browserPath, "No Chromium browser found");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    await runCase(browser, { name: "desktop-fr-light", viewport: { width: 1440, height: 900 }, locale: "fr", colorScheme: "light", reducedMotion: "no-preference", capture: true });
    await runCase(browser, { name: "desktop-en-dark", viewport: { width: 1280, height: 800 }, locale: "en", colorScheme: "dark", reducedMotion: "no-preference", capture: false });
    await runCase(browser, { name: "mobile-ar-dark", viewport: { width: 390, height: 844 }, locale: "ar", colorScheme: "dark", reducedMotion: "no-preference", capture: true });
    await runCase(browser, { name: "mobile-fr-reduced", viewport: { width: 360, height: 800 }, locale: "fr", colorScheme: "light", reducedMotion: "reduce", capture: false });
  } finally {
    await browser.close();
  }
  console.log(`Story regression screenshots written to ${output}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
