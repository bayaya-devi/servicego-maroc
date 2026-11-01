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
  dashboard_prefs: "{}",
  bio: "Compte de recette.",
  rating: 5,
  review_count: 0,
  is_admin: 0,
  email_verified: 1,
};

async function mockMemberApi(page) {
  const response = (route, json) => route.fulfill({ contentType: "application/json", body: JSON.stringify(json) });
  await page.route("**/api/me", (route) => response(route, { user }));
  await page.route("**/api/config", (route) => response(route, { turnstile: { enabled: false }, mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: "OpenStreetMap" }));
  await page.route("**/api/public-context", (route) => response(route, { country: "MA", region: "Rabat-Salé-Kénitra", city: "Rabat", source: "qa" }));
  await page.route("**/api/map", (route) => response(route, { requests: [], services: [] }));
  await page.route("**/api/categories", (route) => response(route, { categories: [{ id: "plomberie", name: "Plomberie", icon: "tool" }] }));
  await page.route("**/api/conversations", (route) => response(route, { conversations: [] }));
  await page.route("**/api/requests", (route) => response(route, { requests: [] }));
  await page.route("**/api/services", (route) => response(route, { services: [] }));
  await page.route("**/api/activity", (route) => response(route, { replied: [], reviews: [], rating: 5, review_count: 0 }));
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
  await page.screenshot({ path: testInfo.outputPath("member-profile.png") });

  await page.locator('[data-action="open-language"]').tap();
  await expect(page.locator(".language-nucleus")).toBeVisible();
  await page.locator('[data-action="set-locale"][data-locale="en"]').tap();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
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
