const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const baseUrl = process.env.SERVICEGO_URL || "http://127.0.0.1:8787";
const output = path.resolve("docs/frontend/screenshots-v21");

async function capture(page, prefix, name) {
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(output, `${prefix}-${name}.jpg`), type: "jpeg", quality: 78 });
}

async function scrollToProgress(page, progress) {
  await page.evaluate((value) => {
    const story = document.querySelector(".story-v21");
    const distance = story.scrollHeight - innerHeight;
    scrollTo({ top: story.offsetTop + distance * value, behavior: "instant" });
  }, progress);
}

async function captureSuite(browser, prefix, viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: "no-preference" });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await capture(page, prefix, "01-first-moment");
  await capture(page, prefix, "05-nucleus-closed");

  await scrollToProgress(page, 0.34);
  await capture(page, prefix, "02-second-moment");
  await scrollToProgress(page, 0.55);
  await capture(page, prefix, "03-character-meeting");
  await scrollToProgress(page, 0.91);
  await capture(page, prefix, "04-third-moment");

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await capture(page, prefix, "06-nucleus-open");
  await page.getByRole("button", { name: "Connexion", exact: true }).click();
  await capture(page, prefix, "07-login");
  await page.getByRole("button", { name: "Creer un compte", exact: true }).click();
  await capture(page, prefix, "08-register");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();

  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await page.getByRole("button", { name: "Questions frequentes", exact: true }).click();
  await capture(page, prefix, "09-faq");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await page.getByRole("button", { name: "Informations legales", exact: true }).click();
  await capture(page, prefix, "10-legal");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await page.getByRole("button", { name: "Contact", exact: true }).click();
  await capture(page, prefix, "11-contact");
  await page.close();
}

async function validateResponsive(browser) {
  const cases = [
    [320, 700, "fr", "light"], [375, 812, "en", "dark"], [390, 844, "ar", "light"],
    [768, 900, "fr", "dark"], [1024, 768, "en", "light"], [1440, 900, "ar", "dark"],
  ];
  for (const [width, height, locale, colorScheme] of cases) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme, reducedMotion: "no-preference" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((value) => localStorage.setItem("servicego-locale", value), locale);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const layout = await page.evaluate(() => {
      const inside = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= innerWidth + 1;
      };
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        titleInside: inside(document.querySelector("#story-title")),
        phoneInside: inside(document.querySelector(".device-perspective")),
        direction: document.documentElement.dir,
      };
    });
    assert.ok(layout.overflow <= 1, `${width}px ${locale}: horizontal overflow ${layout.overflow}px`);
    assert.ok(layout.titleInside && layout.phoneInside, `${width}px ${locale}: first moment leaves the viewport`);
    assert.equal(layout.direction, locale === "ar" ? "rtl" : "ltr");
    await page.locator('[data-action="toggle-public-menu"]').click();
    const nucleusInside = await page.locator(".public-nucleus nav").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= innerWidth + 1;
    });
    assert.ok(nucleusInside, `${width}px ${locale}: expanded nucleus overflows`);
    await page.locator('.public-nucleus [data-action="open-auth"]').click();
    assert.ok(await page.locator(".auth-modal").isVisible(), `${width}px ${locale}: login did not open`);
    assert.deepEqual(errors, [], `${width}px ${locale}: browser errors`);
    await page.close();
  }
}

const testUser = {
  id: "user-cta-test",
  email: "test@servicego.ma",
  full_name: "Test ServiceGO",
  phone: "+212600000000",
  district: "Rabat",
  avatar_url: null,
  bio: null,
  rating: 5,
  review_count: 0,
  is_admin: 0,
  email_verified: 1,
};

async function mockMemberApis(page) {
  await page.route("**/api/map", (route) => route.fulfill({ json: { requests: [], services: [] } }));
  await page.route("**/api/categories", (route) => route.fulfill({ json: { categories: [{ id: "cat-1", name: "Plomberie", icon: "tool" }] } }));
}

async function validateUrgentIntent(browser) {
  const registration = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockMemberApis(registration);
  await registration.route("**/api/auth/register", (route) => route.fulfill({ json: { user: testUser, email_delivery_configured: true } }));
  await registration.goto(baseUrl, { waitUntil: "networkidle" });
  await registration.locator('[data-action="urgent-request"]').click();
  assert.ok(await registration.locator('input[name="first_name"]').isVisible(), "urgent CTA did not open registration");
  await registration.locator('input[name="first_name"]').fill("Test");
  await registration.locator('input[name="last_name"]').fill("ServiceGO");
  await registration.locator('input[name="email"]').fill("test@servicego.ma");
  await registration.locator('input[name="phone_number"]').fill("600000000");
  await registration.locator('input[name="password"]').fill("ServiceGO123!");
  await registration.locator('form[data-form="auth"] button[type="submit"]').click();
  await registration.waitForSelector('form[data-form="request"]');
  await registration.close();

  const login = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await mockMemberApis(login);
  await login.route("**/api/auth/login", (route) => route.fulfill({ json: { user: testUser } }));
  await login.goto(baseUrl, { waitUntil: "networkidle" });
  await login.locator('[data-action="urgent-request"]').click();
  await login.locator('[data-action="auth-tab"][data-mode="login"]').click();
  await login.locator('input[name="email"]').fill("test@servicego.ma");
  await login.locator('input[name="password"]').fill("ServiceGO123!");
  await login.locator('form[data-form="auth"] button[type="submit"]').click();
  await login.waitForSelector('form[data-form="request"]');
  await login.close();

  const authenticated = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockMemberApis(authenticated);
  await authenticated.route("**/api/me", (route) => route.fulfill({ json: { user: testUser } }));
  await authenticated.goto(baseUrl, { waitUntil: "networkidle" });
  await authenticated.locator('[data-action="home"]').first().click();
  await authenticated.locator('[data-action="urgent-request"]').click();
  assert.ok(await authenticated.locator('form[data-form="request"]').isVisible(), "signed-in CTA did not open request creation");
  await authenticated.close();
}

(async () => {
  await mkdir(output, { recursive: true });
  const chromeCandidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const executablePath = chromeCandidates.find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  await captureSuite(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await captureSuite(browser, "mobile-390x844", { width: 390, height: 844 });
  await validateResponsive(browser);
  await validateUrgentIntent(browser);

  const rtl = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  await rtl.addInitScript(() => localStorage.setItem("servicego-locale", "ar"));
  await rtl.goto(baseUrl, { waitUntil: "networkidle" });
  await rtl.getByRole("button", { name: "المزيد", exact: true }).click();
  await rtl.getByRole("button", { name: "الأسئلة الشائعة", exact: true }).click();
  await capture(rtl, "mobile-390x844", "12-arabic-rtl");
  await rtl.close();
  await browser.close();
  console.log(`Visual captures written to ${output}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
