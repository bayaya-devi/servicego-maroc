import { expect, test } from "@playwright/test";

const user = {
  id: "qa-member",
  email: "qa-member@example.test",
  full_name: "QA Member",
  first_name: "QA",
  last_name: "Member",
  district: "Rabat",
  avatar_url: null,
  cover_url: null,
  dashboard_prefs: "{\"activity\":true,\"exchanges\":true,\"tracking\":true}",
  bio: "Compte de recette.",
  rating: 5,
  review_count: 0,
  is_admin: 0,
  email_verified: 1,
};

async function mockMemberApi(page, account = user) {
  const response = (route, json, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  await page.route("**/api/me", (route) => response(route, { user: account }));
  await page.route("**/api/config", (route) => response(route, { turnstile: { enabled: false }, mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: "OpenStreetMap" }));
  await page.route("**/api/public-context", (route) => response(route, { country: "MA", region: "Rabat-Salé-Kénitra", city: "Rabat", source: "qa" }));
  await page.route("**/api/map", (route) => response(route, { requests: [], services: [] }));
  await page.route("**/api/categories", (route) => response(route, { categories: [{ id: "plomberie", name: "Plomberie", icon: "tool" }] }));
  await page.route("**/api/conversations", (route) => response(route, { conversations: [] }));
  await page.route("**/api/requests", (route) => response(route, { requests: [] }));
  await page.route("**/api/services", (route) => response(route, { services: [] }));
  await page.route("**/api/activity", (route) => response(route, { replied: [], reviews: [], rating: 0, review_count: 0 }));
  await page.route("**/api/notifications", (route) => response(route, { notifications: [] }));
  await page.route("**/api/notification-preferences", (route) => response(route, { preferences: { in_app: true, email: true, push: false } }));
}

test("member map, fallback, navigation and mobile language controls remain usable", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 393, height: 873 }, hasTouch: true, isMobile: true, colorScheme: "dark" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockMemberApi(page);
  await page.goto(`${baseURL}/app/carte`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".premium-map-workspace")).toBeVisible();
  await expect(page.locator(".map-mode-control")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("member-map.png") });

  await page.locator('[data-action="map-mode"][data-value="2d"]').tap();
  await expect(page.locator("#liveMap")).not.toHaveClass(/real-globe/);
  await expect(page.locator('[data-action="locate-me"]')).toBeVisible();

  await page.locator('[data-view="messages"]').tap();
  await expect(page.locator(".messages-page")).toBeVisible();
  await page.locator('[data-view="profile"]').tap();
  await expect(page.locator(".profile-page")).toBeVisible();
  await expect(page.getByText(/Pas encore de note|No rating yet|لا يوجد تقييم بعد/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("member-profile.png") });

  await page.locator('[data-action="open-language"]').tap();
  await expect(page.locator(".language-nucleus")).toBeVisible();
  await page.locator('[data-action="set-locale"][data-locale="en"]').tap();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
  await context.close();
});

test("an unverified account stays on the code screen and shows a contextual error", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 393, height: 873 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await mockMemberApi(page, { ...user, email_verified: 0, rating: 0, review_count: 0 });
  await page.route("**/api/auth/verify-email", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Code de confirmation invalide ou expiré." }) }));
  await page.goto(`${baseURL}/app/carte`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".verification-page")).toBeVisible();
  await page.locator('input[name="code"]').fill("000000");
  await page.locator('button[type="submit"]').tap();
  await expect(page.locator(".form-error")).toHaveText("Code de confirmation invalide ou expiré.");
  await context.close();
});

test("a zero-review profile never presents a default five-star score", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 393, height: 873 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await mockMemberApi(page, { ...user, rating: 0, review_count: 0 });
  await page.goto(`${baseURL}/app/profil`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".profile-page")).toBeVisible();
  await expect(page.getByText(/Pas encore de note|No rating yet|لا يوجد تقييم بعد/)).toBeVisible();
  await expect(page.getByText("5.0", { exact: true })).toHaveCount(0);
  await context.close();
});

test("the desktop globe loads an Earth texture instead of a technical wireframe", async ({ browser, baseURL }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The mobile experience intentionally starts with the accessible 2D fallback.");
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: "dark" });
  const page = await context.newPage();
  const earthTexture = page.waitForResponse((response) => response.url().endsWith("/assets/globe-earth.svg") && response.ok());
  await mockMemberApi(page);
  await page.goto(`${baseURL}/app/carte`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#liveMap.real-globe canvas")).toBeVisible();
  await earthTexture;
  await expect(page.locator("#liveMap")).not.toHaveAttribute("aria-busy", "true");
  await context.close();
});

test("reduced motion keeps the essential 2D map fallback available", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await mockMemberApi(page);
  await page.goto(`${baseURL}/app/carte`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#liveMap")).not.toHaveClass(/real-globe/);
  await expect(page.locator('[data-action="map-mode"][data-value="globe"]')).toBeDisabled();
  await expect(page.locator('[data-action="locate-me"]')).toBeVisible();
  await context.close();
});
