const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const baseUrl = process.env.SERVICEGO_URL || "http://127.0.0.1:8787";
const output = path.resolve("docs/frontend/screenshots-v22");

const testUser = {
  id: "user-v22-test",
  email: "test@servicego.ma",
  full_name: "Test ServiceGO",
  phone: "+212600000000",
  district: "Rabat",
  avatar_url: null,
  bio: "Disponible pour aider près de chez moi.",
  rating: 5,
  review_count: 0,
  is_admin: 0,
  email_verified: 1,
};

async function capture(page, prefix, name) {
  if (process.env.SERVICEGO_VALIDATE_ONLY === "1") return;
  await page.waitForTimeout(220);
  await page.screenshot({
    path: path.join(output, `${prefix}-${name}.jpg`),
    type: "jpeg",
    quality: 82,
  });
}

async function mockMemberApis(page) {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: testUser } }));
  await page.route("**/api/map", (route) => route.fulfill({ json: { requests: [], services: [] } }));
  await page.route("**/api/categories", (route) => route.fulfill({ json: { categories: [{ id: "cat-1", name: "Plomberie", icon: "tool" }] } }));
  await page.route("**/api/conversations", (route) => route.fulfill({ json: { conversations: [] } }));
  await page.route("**/api/requests", (route) => route.fulfill({ json: { requests: [] } }));
  await page.route("**/api/services", (route) => route.fulfill({ json: { services: [] } }));
  await page.route("**/api/auth/logout", (route) => route.fulfill({ json: { ok: true } }));
}

async function assertViewport(page, label) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    replacement: document.body.innerText.includes("�"),
  }));
  assert.ok(result.overflow <= 1, `${label}: horizontal overflow ${result.overflow}px`);
  assert.equal(result.replacement, false, `${label}: replacement character displayed`);
}

async function publicSuite(browser, prefix, viewport, locale, colorScheme) {
  const page = await browser.newPage({ viewport, colorScheme, reducedMotion: "no-preference" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((value) => localStorage.setItem("servicego-locale", value), locale);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await assertViewport(page, `${prefix} public`);

  const firstScene = await page.evaluate(() => {
    const phone = document.querySelector(".device-perspective").getBoundingClientRect();
    return { left: phone.left, right: phone.right, top: phone.top, bottom: phone.bottom, width: innerWidth, height: innerHeight };
  });
  assert.ok(firstScene.left >= -1 && firstScene.right <= firstScene.width + 1, `${prefix}: phone overflows horizontally`);
  assert.ok(firstScene.top >= -1 && firstScene.bottom <= firstScene.height + 1, `${prefix}: phone is not fully visible`);

  await capture(page, prefix, "01-accueil-public");
  await capture(page, prefix, "02-telephone-3d");
  await capture(page, prefix, "03-noyau-public-ferme");

  const plusStyle = await page.locator('[data-action="toggle-public-menu"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor, style.color];
  });
  await page.locator('[data-action="toggle-public-menu"]').click();
  const minusStyle = await page.locator('[data-action="toggle-public-menu"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor, style.color];
  });
  assert.deepEqual(minusStyle, plusStyle, `${prefix}: plus and minus styles differ`);
  await capture(page, prefix, "04-noyau-public-ouvert");

  await page.locator('[data-action="open-language"]').click();
  assert.ok(await page.locator(".language-nucleus").isVisible(), `${prefix}: language nucleus missing`);
  await capture(page, prefix, "05-selecteur-langue");
  await page.keyboard.press("Escape");
  assert.ok(await page.locator(".public-nucleus.is-expanded").isVisible(), `${prefix}: main nucleus closed with language menu`);

  await page.locator('[data-action="open-faq"]').click();
  await capture(page, prefix, "06-faq");
  await page.locator('[data-action="close-modal"]').click();
  assert.ok(await page.locator(".public-nucleus.is-expanded").isVisible(), `${prefix}: main nucleus closed with FAQ`);

  await page.locator('[data-action="open-legal"]').click();
  await page.locator(".legal-modal").evaluate((element) => { element.dataset.identity = "same-modal"; });
  await page.locator('[data-action="legal-tab"][data-index="5"]').click();
  assert.equal(await page.locator(".legal-modal").getAttribute("data-identity"), "same-modal", `${prefix}: legal dialog was remounted`);
  assert.match(await page.locator(".legal-content").innerText(), /aetbconseil@gmail\.com/);
  await capture(page, prefix, "07-informations-legales");
  await page.locator('[data-action="close-modal"]').click();

  await page.locator('.public-nucleus [data-action="open-auth"]').click();
  assert.ok(await page.locator('input[name="first_name"]').isVisible(), `${prefix}: signup is not the default`);
  assert.equal(await page.locator('input[name="first_name"]').getAttribute("placeholder"), locale === "ar" ? "اسمك الأول" : locale === "en" ? "Your first name" : "Votre prénom");
  assert.equal(await page.getByRole("button", { name: /Google/i }).count(), 0, `${prefix}: fake Google OAuth button is visible`);
  await capture(page, prefix, "08-inscription");
  await page.locator('[data-action="auth-tab"][data-mode="login"]').click();
  await capture(page, prefix, "09-connexion");

  assert.deepEqual(errors, [], `${prefix}: browser errors`);
  await page.close();
}

async function memberSuite(browser, prefix, viewport, locale, colorScheme) {
  const page = await browser.newPage({ viewport, colorScheme, reducedMotion: "no-preference" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((value) => localStorage.setItem("servicego-locale", value), locale);
  await mockMemberApis(page);
  await page.goto(`${baseUrl}/app/carte`, { waitUntil: "networkidle" });
  await assertViewport(page, `${prefix} map`);
  assert.equal(new URL(page.url()).pathname, "/app/carte");
  assert.equal(await page.locator(".map-toolbar, .map-controls, .info-button, .legend").count(), 0, `${prefix}: obsolete map controls remain`);
  await capture(page, prefix, "10-carte-membre");
  await capture(page, prefix, "11-noyau-membre-ferme");

  await page.locator('[data-action="toggle-public-menu"]').click();
  assert.equal(await page.locator(".member-secondary .nucleus-icon").count(), 1, `${prefix}: member nucleus has extra actions`);
  await capture(page, prefix, "12-noyau-membre-ouvert");

  await page.locator('[data-view="messages"]').click();
  await page.locator(".messages-page").waitFor();
  assert.equal(new URL(page.url()).pathname, "/app/messages");
  await capture(page, prefix, "13-messages");

  await page.locator('[data-view="profile"]').click();
  await page.locator(".profile-page").waitFor();
  assert.equal(new URL(page.url()).pathname, "/app/profil");
  await capture(page, prefix, "14-profil");

  await page.locator('[data-action="open-settings"]').click();
  await capture(page, prefix, "15-parametres");
  await page.locator('[data-action="set-locale"][data-locale="en"]').click();
  assert.equal(await page.locator("html").getAttribute("lang"), "en", `${prefix}: member language did not change`);
  await page.locator('[data-action="close-modal"]').click();
  await page.goBack({ waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/app/messages", `${prefix}: browser back did not return to messages`);
  await page.goBack({ waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/app/carte", `${prefix}: browser back did not return to map`);
  await page.goForward({ waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/app/messages", `${prefix}: browser forward did not return to messages`);
  await page.goBack({ waitUntil: "networkidle" });
  await page.locator('[data-view="profile"]').click();
  await page.locator(".profile-page").waitFor();
  await page.locator('[data-action="logout"]').click();
  await page.locator(".story-v21").waitFor();
  assert.equal(new URL(page.url()).pathname, "/", `${prefix}: logout did not return home`);
  assert.ok(await page.locator(".story-v21").isVisible(), `${prefix}: public home missing after logout`);
  await assertViewport(page, `${prefix} refreshed map`);
  assert.deepEqual(errors, [], `${prefix}: browser errors`);
  await page.close();
}

async function responsiveMatrix(browser) {
  const cases = [
    [320, 700, "fr", "light"],
    [375, 812, "en", "dark"],
    [390, 844, "ar", "light"],
    [768, 900, "fr", "dark"],
    [1024, 768, "en", "light"],
    [1440, 900, "ar", "dark"],
  ];
  for (const [width, height, locale, colorScheme] of cases) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme, reducedMotion: "no-preference" });
    await page.addInitScript((value) => localStorage.setItem("servicego-locale", value), locale);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await assertViewport(page, `${width}x${height} ${locale}`);
    const layout = await page.evaluate(() => {
      const phone = document.querySelector(".device-perspective").getBoundingClientRect();
      return {
        phoneInside: phone.left >= -1 && phone.right <= innerWidth + 1 && phone.top >= -1 && phone.bottom <= innerHeight + 1,
        direction: document.documentElement.dir,
      };
    });
    assert.ok(layout.phoneInside, `${width}x${height} ${locale}: phone leaves first viewport`);
    assert.equal(layout.direction, locale === "ar" ? "rtl" : "ltr");
    await page.locator('[data-action="toggle-public-menu"]').click();
    const nucleusInside = await page.locator(".public-nucleus nav").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= innerWidth + 1;
    });
    assert.ok(nucleusInside, `${width}x${height} ${locale}: expanded nucleus overflows`);
    await page.close();
  }

  const direct = await browser.newPage({ viewport: { width: 768, height: 900 }, colorScheme: "dark" });
  await mockMemberApis(direct);
  await direct.goto(`${baseUrl}/app/profil`, { waitUntil: "networkidle" });
  assert.ok(await direct.locator(".profile-page").isVisible(), "direct authenticated profile route failed");
  await assertViewport(direct, "direct member profile");
  await direct.goto(`${baseUrl}/app/carte`, { waitUntil: "networkidle" });
  assert.ok(await direct.locator("#liveMap").isVisible(), "direct authenticated map route failed");
  await direct.close();
}

async function englishCheck(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("servicego-locale", "en"));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('.public-nucleus [data-action="open-auth"]').click();
  assert.ok(await page.getByRole("button", { name: "Create an account", exact: true }).isVisible());
  await capture(page, "desktop-1024x768-en-dark", "08-inscription");
  await page.close();
}

(async () => {
  await mkdir(output, { recursive: true });
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const executablePath = candidates.find(existsSync);
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu"],
    ...(executablePath ? { executablePath } : {}),
  });
  await publicSuite(browser, "desktop-1440x900-fr-light", { width: 1440, height: 900 }, "fr", "light");
  await memberSuite(browser, "desktop-1440x900-fr-light", { width: 1440, height: 900 }, "fr", "light");
  await publicSuite(browser, "mobile-390x844-ar-dark", { width: 390, height: 844 }, "ar", "dark");
  await memberSuite(browser, "mobile-390x844-ar-dark", { width: 390, height: 844 }, "ar", "dark");
  await englishCheck(browser);
  await responsiveMatrix(browser);
  await browser.close();
  console.log(`V2.2 visual captures written to ${output}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
