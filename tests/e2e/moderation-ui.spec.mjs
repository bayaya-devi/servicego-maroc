import { expect, test } from "@playwright/test";

const member = {
  id: "member-qa",
  email: "member@example.test",
  full_name: "Membre QA",
  first_name: "Membre",
  last_name: "QA",
  district: "Rabat",
  dashboard_prefs: "{\"activity\":true,\"exchanges\":true,\"tracking\":true}",
  rating: 0,
  review_count: 0,
  is_admin: 0,
  email_verified: 1,
};

const listing = {
  id: "request-external",
  requester_id: "other-member",
  requester_name: "Autre membre",
  category_id: "plomberie",
  category_name: "Plomberie",
  category_icon: "tool",
  title: "Réparer une fuite",
  description: "Une fuite doit être réparée rapidement.",
  district: "Rabat",
  latitude: 34.02,
  longitude: -6.84,
  urgency: "normal",
  status: "open",
};

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function mockBase(page, user = member) {
  await page.route("**/api/me", (route) => json(route, { user }));
  await page.route("**/api/config", (route) => json(route, { turnstile: { enabled: false }, mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: "OpenStreetMap" }));
  await page.route("**/api/public-context", (route) => json(route, { country: "MA", city: "Rabat", source: "qa" }));
  await page.route("**/api/categories", (route) => json(route, { categories: [{ id: "plomberie", name: "Plomberie", icon: "tool" }] }));
  await page.route("**/api/notifications", (route) => json(route, { notifications: [] }));
  await page.route("**/api/notification-preferences", (route) => json(route, { preferences: { in_app: true, email: true, push: false } }));
}

test("a member can report another listing from the accessible map", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 393, height: 873 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => localStorage.setItem("servicego-locale", "fr"));
  const page = await context.newPage();
  await mockBase(page);
  await page.route("**/api/map", (route) => json(route, { requests: [listing], services: [] }));
  let reportPayload;
  await page.route("**/api/reports", async (route) => {
    reportPayload = route.request().postDataJSON();
    await json(route, { message: "Votre signalement a été enregistré." }, 201);
  });

  await page.goto(`${baseURL}/app/carte`, { waitUntil: "domcontentloaded" });
  await page.locator(".leaflet-marker-icon.servicego-marker").tap();
  await page.locator('[data-action="open-report"]').tap();
  await expect(page.locator('form[data-form="report"]')).toBeVisible();
  await page.locator('textarea[name="details"]').fill("Annonce test à vérifier.");
  await page.locator('form[data-form="report"] button[type="submit"]').tap();
  await expect(page.locator(".report-modal")).toHaveCount(0);
  expect(reportPayload).toMatchObject({ subject_type: "request", subject_id: "request-external", reason: "Contenu trompeur" });
  await context.close();
});

test("an administrator can review reports and persist a moderation status", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => localStorage.setItem("servicego-locale", "fr"));
  const page = await context.newPage();
  await mockBase(page, { ...member, id: "admin-qa", is_admin: 1 });
  await page.route("**/api/admin/overview", (route) => json(route, { stats: { users: 3, open_requests: 1, active_services: 1, conversations: 1, open_reports: 1 } }));
  await page.route("**/api/admin/reports", (route) => json(route, { reports: [{ id: "report-1", subject_type: "request", subject_id: listing.id, reason: "Contenu trompeur", details: "À contrôler", status: "open", reporter_name: "Membre QA", created_at: "2026-11-01 12:00:00" }] }));
  let updatedStatus;
  await page.route("**/api/admin/reports/report-1", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    updatedStatus = route.request().postDataJSON().status;
    await json(route, { ok: true });
  });

  await page.goto(`${baseURL}/app/admin`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".admin-page")).toBeVisible();
  await expect(page.getByText("Contenu trompeur")).toBeVisible();
  await page.locator('[data-action="admin-report-status"]').selectOption("reviewing");
  await expect.poll(() => updatedStatus).toBe("reviewing");
  await context.close();
});
