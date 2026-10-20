const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const baseUrl = process.env.SERVICEGO_URL || "http://127.0.0.1:8787";
const output = path.resolve("docs/frontend/screenshots-premium");
const user = {
  id: "me", email: "nadia@servicego.test", full_name: "Nadia ServiceGO", first_name: "Nadia",
  last_name: "ServiceGO", phone: "+212600000000", district: "Rabat", avatar_url: null,
  cover_url: null, dashboard_prefs: '{"activity":true,"exchanges":true,"tracking":true}',
  bio: "Disponible pour aider.", rating: 4.8, review_count: 3, is_admin: 0, email_verified: 1,
};
const categories = [{ id: "plomberie", name: "Plomberie", icon: "P" }];
const request = {
  id: "r1", requester_id: "u1", category_id: "plomberie", title: "Réparer une fuite",
  description: "Une fuite sous l'évier demande une intervention.", district: "Rabat",
  latitude: 34.0209, longitude: -6.8416, urgency: "urgent", budget_hint: "300 DH",
  status: "completed", created_at: "2026-10-20 09:00:00", category_name: "Plomberie",
  category_icon: "P", requester_name: "Samir Alaoui",
};
const service = {
  id: "s1", user_id: "u2", category_id: "plomberie", title: "Plomberie à domicile",
  description: "Interventions soignées.", district: "Salé", latitude: 34.05, longitude: -6.79,
  price_hint: "À convenir", available: 1, created_at: "2026-10-19 09:00:00",
  category_name: "Plomberie", category_icon: "P", full_name: "Aya ServiceGO", rating: 4.9, review_count: 8,
};
const conversation = {
  id: "c1", request_id: "r1", request_title: request.title, request_status: "completed",
  updated_at: "2026-10-20 10:00:00", other_name: "Samir Alaoui", other_avatar_url: null,
  last_message: "Je peux vous aider aujourd'hui.", unread_count: 2,
};

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockMember(page) {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/me") return json(route, { user });
    if (url.pathname === "/api/config") return json(route, { mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: "OpenStreetMap" });
    if (url.pathname === "/api/public-context") return json(route, { country: "MA", region: "Rabat-Salé-Kénitra", city: "Rabat", source: "test" });
    if (url.pathname === "/api/categories") return json(route, { categories });
    if (url.pathname === "/api/map") return json(route, { requests: [request], services: [service] });
    if (url.pathname === "/api/requests" && method === "GET") return json(route, { requests: [{ ...request, requester_id: "me" }] });
    if (url.pathname === "/api/services" && method === "GET") return json(route, { services: [service] });
    if (url.pathname === "/api/conversations") return json(route, { conversations: [conversation] });
    if (url.pathname === "/api/conversations/c1/messages") return json(route, { messages: [
      { id: "m1", sender_id: "u1", sender_name: "Samir Alaoui", body: "Je peux vous aider aujourd'hui.", message_type: "text", created_at: "2026-10-20 09:30:00" },
      { id: "m2", sender_id: "me", sender_name: "Nadia ServiceGO", body: "Merci, voici ma position.", message_type: "location", latitude: 34.0209, longitude: -6.8416, created_at: "2026-10-20 09:40:00" },
    ] });
    if (url.pathname === "/api/activity") return json(route, { rating: 4.8, review_count: 3, replied: [{ ...request, offer_status: "accepted" }], reviews: [{ id: "rv1", rating: 5, comment: "Une entraide très efficace.", reviewer_name: "Samir Alaoui", request_title: request.title, created_at: "2026-10-20 10:00:00" }] });
    return json(route, { ok: true });
  });
}

async function assertLayout(page, label) {
  await page.waitForTimeout(650);
  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    overflowingElements: [...document.querySelectorAll("body *")]
      .filter((element) => { const rect = element.getBoundingClientRect(); return rect.right > innerWidth + 1 || rect.left < -1; })
      .slice(0, 8)
      .map((element) => `${element.tagName}.${element.className}`),
    empty: !document.body.innerText.trim(),
    overflowingButtons: [...document.querySelectorAll("button")]
      .filter((button) => button.offsetParent && button.innerText.trim() && button.scrollWidth > button.clientWidth + 2)
      .map((button) => `${button.className}: ${button.textContent.trim()}`),
  }));
  assert.ok(metrics.overflow <= 1, `${label}: horizontal overflow ${metrics.overflow}px (${metrics.overflowingElements.join(", ")})`);
  assert.equal(metrics.empty, false, `${label}: blank page`);
  assert.deepEqual(metrics.overflowingButtons, [], `${label}: button text overflow: ${metrics.overflowingButtons.join(" | ")}`);
}

async function capture(page, name) {
  await assertLayout(page, name);
  if (process.env.SERVICEGO_VALIDATE_ONLY !== "1") {
    await page.screenshot({ path: path.join(output, `${name}.jpg`), type: "jpeg", quality: 84, fullPage: false });
  }
}

async function publicCase(browser, width, height, locale, colorScheme) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme });
  const page = await context.newPage();
  await page.addInitScript((selected) => localStorage.setItem("servicego-locale", selected), locale);
  await page.route("**/api/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/me") return json(route, { user: null });
    if (pathname === "/api/public-context") return json(route, { country: "MA", region: "Rabat-Salé-Kénitra", city: "Rabat", source: "test" });
    if (pathname === "/api/config") return json(route, { mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: "OpenStreetMap" });
    if (pathname === "/api/categories") return json(route, { categories });
    return json(route, {});
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await capture(page, `public-${width}-${locale}-${colorScheme}`);
  await page.locator('[data-action="urgent-request"]').dispatchEvent("click");
  await page.locator(".auth-modal").waitFor({ state: "visible" });
  await capture(page, `auth-${width}-${locale}-${colorScheme}`);
  await context.close();
}

async function memberCase(browser, width, height, locale, colorScheme) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, geolocation: { latitude: 34.0209, longitude: -6.8416 }, permissions: ["geolocation"] });
  const page = await context.newPage();
  await page.addInitScript((selected) => localStorage.setItem("servicego-locale", selected), locale);
  await mockMember(page);
  await page.goto(`${baseUrl}/app/carte`, { waitUntil: "domcontentloaded" });
  await page.locator("#liveMap").waitFor({ state: "visible" });
  await capture(page, `map-${width}-${locale}-${colorScheme}`);
  await page.locator('[data-view="messages"]').click();
  await page.locator(".messages-page").waitFor({ state: "visible" });
  if (width <= 760) await page.locator('[data-action="conversation"]').click();
  await capture(page, `messages-${width}-${locale}-${colorScheme}`);
  await page.locator('[data-view="profile"]').click();
  await page.locator(".profile-page").waitFor({ state: "visible" });
  await page.evaluate(() => scrollTo(0, 0));
  await capture(page, `profile-${width}-${locale}-${colorScheme}`);
  await page.locator('[data-action="open-settings"]').click();
  await page.locator(".settings-modal").waitFor({ state: "visible" });
  await capture(page, `settings-${width}-${locale}-${colorScheme}`);
  await context.close();
}

(async () => {
  await mkdir(output, { recursive: true });
  const executablePath = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
  assert.ok(executablePath, "No Chromium browser found");
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    await publicCase(browser, 320, 720, "fr", "light");
    await publicCase(browser, 360, 800, "en", "dark");
    await publicCase(browser, 390, 844, "ar", "dark");
    await memberCase(browser, 390, 844, "ar", "dark");
    await memberCase(browser, 768, 1024, "fr", "light");
    await memberCase(browser, 1280, 800, "en", "dark");
    await memberCase(browser, 1440, 900, "fr", "light");
  } finally { await browser.close(); }
  console.log(`Premium visual matrix written to ${output}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
