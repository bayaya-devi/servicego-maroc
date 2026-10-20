const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const baseUrl = process.env.SERVICEGO_URL || "http://127.0.0.1:8787";
const output = path.resolve("docs/frontend/screenshots-v23");
const user = {
  id: "me", email: "nadia@servicego.test", full_name: "Nadia ServiceGO", first_name: "Nadia",
  last_name: "ServiceGO", phone: "+212600000000", district: "Rabat", avatar_url: null,
  cover_url: null, dashboard_prefs: '{"activity":true,"exchanges":true,"tracking":true}',
  bio: "Disponible pour aider.", rating: 4.8, review_count: 3, is_admin: 0, email_verified: 1,
};
const categories = [{ id: "plomberie", name: "Plomberie", icon: "W" }, { id: "peinture", name: "Peinture", icon: "P" }];
const mapData = {
  requests: [{
    id: "r1", requester_id: "u1", category_id: "plomberie", title: "Réparer une fuite à Londres",
    description: "Une fuite sous l'évier.", district: "Camden, Londres", latitude: 51.5072, longitude: -0.1276,
    urgency: "urgent", budget_hint: "80 GBP", status: "open", created_at: "2026-10-20 09:00:00",
    category_name: "Plomberie", category_icon: "W", requester_name: "Samir Alaoui",
  }],
  services: [{
    id: "s1", user_id: "u2", category_id: "peinture", title: "Peinture intérieure à Tokyo",
    description: "Travail soigné.", district: "Shinjuku, Tokyo", latitude: 35.6762, longitude: 139.6503,
    price_hint: "À convenir", available: 1, created_at: "2026-10-19 09:00:00", category_name: "Peinture",
    category_icon: "P", full_name: "Aya Mori", rating: 4.9, review_count: 10,
  }],
};
const conversation = {
  id: "c1", request_id: "r1", request_title: "Réparer une fuite à Londres", request_status: "completed",
  updated_at: "2026-10-20 10:00:00", other_name: "Samir Alaoui", other_avatar_url: null,
  last_message: "https://servicego.example/aide", unread_count: 2,
};
const messages = [
  { id: "m1", sender_id: "u1", sender_name: "Samir Alaoui", body: "Voici le lien https://servicego.example/aide", message_type: "text", created_at: "2026-10-20 09:30:00" },
  { id: "m2", sender_id: "u1", sender_name: "Samir Alaoui", body: "", message_type: "image", media_key: "uploads/u1/photo.jpg", media_mime: "image/jpeg", created_at: "2026-10-20 09:35:00" },
  { id: "m3", sender_id: "me", sender_name: "Nadia ServiceGO", body: "", message_type: "location", latitude: 51.5072, longitude: -0.1276, created_at: "2026-10-20 09:40:00" },
];

function json(route, body, status = 200) { return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); }

async function mockApis(page, writes) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    if (pathname === "/api/me" && method === "GET") return json(route, { user });
    if (pathname === "/api/me" && method === "PATCH") { writes.profile += 1; return json(route, { user: { ...user, dashboard_prefs: JSON.stringify(request.postDataJSON().dashboard_prefs) } }); }
    if (pathname === "/api/config") return json(route, { mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: "OpenStreetMap contributors" });
    if (pathname === "/api/public-context") return json(route, { country: "GB", region: "England", city: "London", source: "test" });
    if (pathname === "/api/categories") return json(route, { categories });
    if (pathname === "/api/map") return json(route, mapData);
    if (pathname === "/api/requests" && method === "GET") return json(route, { requests: [{ ...mapData.requests[0], requester_id: "me", status: "completed" }] });
    if (pathname === "/api/requests" && method === "POST") { writes.requests += 1; writes.requestBody = request.postDataJSON(); return json(route, { id: "created-request" }, 201); }
    if (pathname === "/api/services" && method === "GET") return json(route, { services: [] });
    if (pathname === "/api/conversations") return json(route, { conversations: [conversation] });
    if (pathname === "/api/conversations/c1/messages" && method === "GET") return json(route, { messages });
    if (pathname === "/api/conversations/c1/messages" && method === "POST") { writes.messages += 1; writes.messageBody = request.postDataJSON(); return json(route, { ok: true }, 201); }
    if (pathname === "/api/requests/r1/offers" && method === "POST") { writes.replies += 1; return json(route, { id: "o1", conversation_id: "c1" }, 201); }
    if (pathname === "/api/requests/r1/complete" && method === "POST") return json(route, { message: "Le service est marqué comme terminé. Les deux participants peuvent maintenant s'évaluer." });
    if (pathname === "/api/requests/r1/reviews" && method === "POST") { writes.reviews += 1; return json(route, { message: "Votre évaluation est enregistrée. Elle sera publiée après l'autre avis ou dans sept jours." }, 201); }
    if (pathname === "/api/activity") return json(route, { replied: [{ id: "r1", title: "Réparer une fuite à Londres", status: "completed", offer_status: "accepted" }], reviews: [{ id: "rv1", rating: 5, comment: "Très bonne entraide.", reviewer_name: "Samir Alaoui", request_title: "Réparer une fuite à Londres", created_at: "2026-10-20 10:00:00" }] });
    if (pathname === "/api/uploads" && method === "POST") { writes.uploads += 1; return json(route, { key: "uploads/me/test.jpg", url: "/api/files/uploads/me/test.jpg" }, 201); }
    if (pathname.startsWith("/api/files/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#2585e6"/></svg>' });
    return json(route, { error: `Unhandled mock ${method} ${pathname}` }, 404);
  });
}

async function shot(page, name) {
  if (process.env.SERVICEGO_VALIDATE_ONLY === "1") return;
  await page.screenshot({ path: path.join(output, `${name}.jpg`), type: "jpeg", quality: 82, fullPage: false });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label}: horizontal overflow ${overflow}px`);
}

async function longPress(page, selector, ratioX = 0.5, ratioY = 0.5) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} has no bounding box`);
  await page.mouse.move(box.x + box.width * ratioX, box.y + box.height * ratioY);
  await page.mouse.down();
  await page.waitForTimeout(680);
  await page.mouse.up();
}

async function desktopSuite(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", geolocation: { latitude: 51.5072, longitude: -0.1276 }, permissions: ["geolocation"] });
  const page = await context.newPage();
  const writes = { requests: 0, replies: 0, messages: 0, uploads: 0, reviews: 0, profile: 0 };
  await mockApis(page, writes);
  await page.goto(`${baseUrl}/app/carte`, { waitUntil: "domcontentloaded" });
  await page.locator("#liveMap").waitFor({ state: "visible" });
  assert.equal(await page.locator(".map-floating-actions").count(), 0);
  assert.ok(await page.getByText(/Pour demander un service, choisissez un emplacement/).isVisible());
  await shot(page, "desktop-01-world-map");

  const mapBox = await page.locator("#liveMap").boundingBox();
  await page.mouse.move(mapBox.x + 120, mapBox.y + 120); await page.mouse.down();
  await page.mouse.move(mapBox.x + 170, mapBox.y + 150); await page.waitForTimeout(680); await page.mouse.up();
  assert.equal(await page.locator('form[data-form="request"]').count(), 0, "map movement did not cancel long press");

  await longPress(page, "#liveMap", 0.62, 0.48);
  await page.locator('form[data-form="request"]').waitFor({ state: "visible" });
  await shot(page, "desktop-02-long-press-request");
  await page.locator('form[data-form="request"] select[name="category_id"]').selectOption("plomberie");
  await page.locator('form[data-form="request"] input[name="district"]').fill("Londres centre");
  await page.locator('form[data-form="request"] input[name="title"]').fill("Besoin mondial de test");
  await page.locator('form[data-form="request"] textarea[name="description"]').fill("Demande créée par appui long sur la carte mondiale.");
  await page.locator('form[data-form="request"] button[type="submit"]').click();
  await page.locator('form[data-form="request"]').waitFor({ state: "detached" });
  assert.equal(writes.requests, 1);
  assert.ok(writes.requestBody.latitude >= -85 && writes.requestBody.latitude <= 85);
  assert.ok(writes.requestBody.longitude >= -180 && writes.requestBody.longitude <= 180);

  for (let attempt = 0; attempt < 4 && await page.locator('.premium-map-pin.need').count() === 0; attempt += 1) {
    const cluster = page.locator(".map-cluster").first(); if (await cluster.count()) await cluster.click();
  }
  await page.locator('.premium-map-pin.need').first().click();
  await page.getByText("Proposer mon aide", { exact: true }).click();
  await page.locator('form[data-form="reply"] textarea').fill("Je peux intervenir aujourd'hui.");
  await page.locator('form[data-form="reply"] button[type="submit"]').click();
  await page.locator(".messages-page").waitFor({ state: "visible" });
  assert.equal(writes.replies, 1);
  assert.ok(await page.locator(".unread-badge").isVisible());
  assert.ok(await page.locator('.message a[href="https://servicego.example/aide"]').isVisible());
  assert.ok(await page.locator(".shared-location").isVisible());
  await shot(page, "desktop-03-rich-messages");

  await page.locator('[data-action="share-message-location"]').click();
  await page.locator(".message-draft-preview").waitFor({ state: "visible" });
  await page.locator('form[data-form="message"] .send-message').click();
  assert.equal(writes.messages, 1);
  assert.equal(writes.messageBody.message_type, "location");

  await page.locator('[data-view="profile"]').click();
  await page.locator(".profile-page").waitFor({ state: "visible" });
  assert.ok(await page.getByText("Services auxquels j'ai répondu", { exact: true }).isVisible());
  assert.ok(await page.getByText("Très bonne entraide.", { exact: true }).isVisible());
  await page.getByText("Évaluer", { exact: true }).first().click();
  await page.locator('form[data-form="review"] input[value="5"]').check();
  await page.locator('form[data-form="review"] textarea').fill("Service terminé avec succès.");
  await page.locator('form[data-form="review"] button[type="submit"]').click();
  assert.equal(writes.reviews, 1);
  await page.locator('form[data-form="review"]').waitFor({ state: "detached" });
  await shot(page, "desktop-04-dashboard-reviews");
  await assertNoHorizontalOverflow(page, "desktop");
  await context.close();
}

async function mobileSuite(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", geolocation: { latitude: 35.6762, longitude: 139.6503 }, permissions: ["geolocation"] });
  const page = await context.newPage();
  const writes = { requests: 0, replies: 0, messages: 0, uploads: 0, reviews: 0, profile: 0 };
  await page.addInitScript(() => localStorage.setItem("servicego-locale", "ar"));
  await mockApis(page, writes);
  await page.goto(`${baseUrl}/app/carte`, { waitUntil: "domcontentloaded" });
  await page.locator("#liveMap").waitFor({ state: "visible" });
  await longPress(page, "#liveMap", 0.52, 0.55);
  await page.locator('form[data-form="request"]').waitFor({ state: "visible" });
  assert.ok(await page.getByText("النشر على الخريطة", { exact: true }).isVisible());
  await shot(page, "mobile-01-long-press-ar-dark");
  await page.locator('[data-action="close-modal"]').click();
  await page.locator('[data-view="messages"]').click();
  await page.locator('[data-action="conversation"]').click();
  await page.locator(".show-conversation .chat").waitFor({ state: "visible" });
  await shot(page, "mobile-02-messages-ar-dark");
  await assertNoHorizontalOverflow(page, "mobile messages");
  await page.locator('[data-action="messages-back"]').click();
  await page.locator('[data-view="profile"]').click();
  await page.locator(".profile-page").waitFor({ state: "visible" });
  await shot(page, "mobile-03-profile-ar-dark");
  await assertNoHorizontalOverflow(page, "mobile profile");
  await context.close();
}

(async () => {
  await mkdir(output, { recursive: true });
  const executablePath = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
  assert.ok(executablePath, "No Chromium browser found");
  const browser = await chromium.launch({ headless: true, executablePath });
  try { await desktopSuite(browser); await mobileSuite(browser); }
  finally { await browser.close(); }
  console.log(`V2.3 captures written to ${output}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
