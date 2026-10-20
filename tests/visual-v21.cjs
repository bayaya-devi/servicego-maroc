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
  await capture(page, prefix, "08-nucleus-closed");

  await scrollToProgress(page, 0.22);
  await capture(page, prefix, "02-characters-emerge");
  await scrollToProgress(page, 0.36);
  await capture(page, prefix, "03-characters-separated");
  await scrollToProgress(page, 0.47);
  await capture(page, prefix, "04-characters-approach");
  await scrollToProgress(page, 0.55);
  await capture(page, prefix, "05-characters-meet");
  await scrollToProgress(page, 0.64);
  await capture(page, prefix, "06-characters-return");
  await scrollToProgress(page, 0.91);
  await capture(page, prefix, "07-characters-alive");

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await capture(page, prefix, "09-nucleus-open");
  await page.getByRole("button", { name: "Connexion", exact: true }).click();
  await capture(page, prefix, "10-login");
  await page.getByRole("button", { name: "Créer un compte", exact: true }).click();
  await capture(page, prefix, "11-register");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();

  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await page.getByRole("button", { name: "Questions fréquentes", exact: true }).click();
  await capture(page, prefix, "12-faq");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await page.getByRole("button", { name: "Informations légales", exact: true }).click();
  await capture(page, prefix, "13-legal");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.getByRole("button", { name: "Plus", exact: true }).click();
  await page.getByRole("button", { name: "Contact", exact: true }).click();
  await capture(page, prefix, "14-contact");
  await page.close();
}

async function validateCharacterSequence(browser) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: "no-preference" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    for (const progress of [0.22, 0.36, 0.47, 0.55, 0.64, 0.91]) {
      await scrollToProgress(page, progress);
      await page.waitForTimeout(100);
      const state = await page.evaluate(() => {
        const stage = document.querySelector(".moment-two .character-stage");
        const blue = document.querySelector(".moment-two .blue-character");
        const green = document.querySelector(".moment-two .green-character");
        const blueRect = blue.getBoundingClientRect();
        const greenRect = green.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        return {
          blueSrc: blue.getAttribute("src"),
          greenSrc: green.getAttribute("src"),
          gap: greenRect.left - blueRect.right,
          inside: blueRect.left >= stageRect.left - 1 && greenRect.right <= stageRect.right + 1,
          opacity: Number(getComputedStyle(blue).opacity),
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      assert.equal(state.blueSrc, "/assets/servicego-character-blue.svg");
      assert.equal(state.greenSrc, "/assets/servicego-character-green.svg");
      assert.ok(state.gap >= -1, `${viewport.width}px at ${progress}: characters overlap by ${-state.gap}px`);
      assert.ok(state.inside, `${viewport.width}px at ${progress}: characters leave their stage`);
      assert.ok(state.opacity > 0, `${viewport.width}px at ${progress}: characters are invisible`);
      assert.ok(state.overflow <= 1, `${viewport.width}px at ${progress}: horizontal overflow`);
    }
    await scrollToProgress(page, 0.91);
    const finalAnimation = await page.locator(".moment-three .blue-character").evaluate((element) => getComputedStyle(element).animationName);
    assert.equal(finalAnimation, "character-greeting", `${viewport.width}px: final bounce is missing`);
    assert.deepEqual(errors, [], `${viewport.width}px: character sequence browser errors`);
    await page.close();
  }
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
        fontFamily: getComputedStyle(document.body).fontFamily,
      };
    });
    assert.ok(layout.overflow <= 1, `${width}px ${locale}: horizontal overflow ${layout.overflow}px`);
    assert.ok(layout.titleInside && layout.phoneInside, `${width}px ${locale}: first moment leaves the viewport`);
    assert.equal(layout.direction, locale === "ar" ? "rtl" : "ltr");
    if (locale === "ar") assert.match(layout.fontFamily, /Noto Sans Arabic/);
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

async function validateLocalizedMemberViews(browser) {
  const cases = [
    ["fr", { width: 1440, height: 900 }, "Services autour de vous", "Quel besoin avez-vous ?", "Vos discussions", "Votre compte ServiceGO", "Tableau de bord"],
    ["en", { width: 1440, height: 900 }, "Services near you", "What do you need?", "Your conversations", "Your ServiceGO account", "Dashboard"],
    ["ar", { width: 1440, height: 900 }, "خدمات قريبة منك", "ما الخدمة التي تحتاجها؟", "محادثاتك", "حسابك في ServiceGO", "لوحة التحكم"],
    ["fr", { width: 390, height: 844 }, "Services autour de vous", "Quel besoin avez-vous ?", "Vos discussions", "Votre compte ServiceGO", "Tableau de bord"],
    ["en", { width: 390, height: 844 }, "Services near you", "What do you need?", "Your conversations", "Your ServiceGO account", "Dashboard"],
    ["ar", { width: 390, height: 844 }, "خدمات قريبة منك", "ما الخدمة التي تحتاجها؟", "محادثاتك", "حسابك في ServiceGO", "لوحة التحكم"],
  ];
  for (const [locale, viewport, mapTitle, requestTitle, messagesTitle, profileTitle, adminTitle] of cases) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((value) => localStorage.setItem("servicego-locale", value), locale);
    await page.route("**/api/me", (route) => route.fulfill({ json: { user: { ...testUser, is_admin: 1 } } }));
    await mockMemberApis(page);
    await page.route("**/api/conversations", (route) => route.fulfill({ json: { conversations: [] } }));
    await page.route("**/api/requests", (route) => route.fulfill({ json: { requests: [] } }));
    await page.route("**/api/services", (route) => route.fulfill({ json: { services: [] } }));
    await page.route("**/api/admin/overview", (route) => route.fulfill({ json: { stats: { users: 3, open_requests: 1, active_services: 2, conversations: 1 } } }));
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    assert.ok(await page.getByText(mapTitle, { exact: true }).isVisible(), `${locale} ${viewport.width}: map copy is not localized`);
    await page.locator('[data-action="open-request"]').first().click();
    assert.ok(await page.getByRole("heading", { name: requestTitle, exact: true }).isVisible());
    await page.locator('[data-action="close-modal"]').click();

    const nav = viewport.width <= 760 ? ".mobile-tabbar" : ".topbar";
    await page.locator(`${nav} [data-view="messages"]`).click();
    await page.getByRole("heading", { name: messagesTitle, exact: true }).waitFor();
    await page.locator(`${nav} [data-view="profile"]`).click();
    await page.getByRole("heading", { name: profileTitle, exact: true }).waitFor();
    await page.locator('[data-action="open-profile"]').click();
    assert.ok(await page.locator('form[data-form="profile"]').isVisible());
    await page.locator('[data-action="close-modal"]').click();
    await page.locator('.topbar [data-view="admin"]').evaluate((button) => button.click());
    await page.getByRole("heading", { name: adminTitle, exact: true }).waitFor();

    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      replacementCharacter: document.body.innerText.includes("�"),
      direction: document.documentElement.dir,
      language: document.documentElement.lang,
    }));
    assert.ok(state.overflow <= 1, `${locale} ${viewport.width}: member view overflows by ${state.overflow}px`);
    assert.equal(state.replacementCharacter, false);
    assert.equal(state.language, locale);
    assert.equal(state.direction, locale === "ar" ? "rtl" : "ltr");
    assert.deepEqual(errors, [], `${locale} ${viewport.width}: member-view browser errors`);
    await page.close();
  }
}

async function validateUrgentIntent(browser) {
  const registration = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockMemberApis(registration);
  await registration.route("**/api/auth/register", (route) => route.fulfill({ json: { user: testUser, email_delivery_accepted: true } }));
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
  if (!process.env.SERVICEGO_I18N_ONLY) {
    await captureSuite(browser, "desktop-1440x900", { width: 1440, height: 900 });
    await captureSuite(browser, "mobile-390x844", { width: 390, height: 844 });
    await validateResponsive(browser);
    await validateCharacterSequence(browser);
    await validateUrgentIntent(browser);
  }
  await validateLocalizedMemberViews(browser);

  if (!process.env.SERVICEGO_I18N_ONLY) {
    const rtl = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
    await rtl.addInitScript(() => localStorage.setItem("servicego-locale", "ar"));
    await rtl.goto(baseUrl, { waitUntil: "networkidle" });
    await rtl.getByRole("button", { name: "المزيد", exact: true }).click();
    await rtl.getByRole("button", { name: "الأسئلة الشائعة", exact: true }).click();
    await capture(rtl, "mobile-390x844", "12-arabic-rtl");
    await rtl.close();
  }
  await browser.close();
  console.log(`Visual captures written to ${output}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
