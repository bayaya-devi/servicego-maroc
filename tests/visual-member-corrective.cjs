const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const baseUrl = process.env.SERVICEGO_URL || "http://127.0.0.1:8787";
const output = path.resolve("docs/frontend/screenshots-v22-member-corrective");
const user = { id:"me",email:"test@servicego.ma",full_name:"Nadia ServiceGO",phone:"+212600000000",district:"Rabat",avatar_url:null,bio:"",rating:4.9,review_count:8,is_admin:0,email_verified:1 };
const categories = [{ id:"plomberie",name:"Plomberie",icon:"W" },{ id:"peinture",name:"Peinture",icon:"P" }];
const mapData = {
  requests:[
    { id:"r1",requester_id:"u1",category_id:"plomberie",title:"Fuite sous évier",description:"Une fuite lente sous l'évier de la cuisine.",district:"Rabat",latitude:34.02,longitude:-6.84,urgency:"urgent",budget_hint:"200 DH",status:"open",created_at:"2026-10-19 10:00:00",category_name:"Plomberie",category_icon:"W",requester_name:"Samir Alaoui" },
    { id:"r2",requester_id:"u2",category_id:"peinture",title:"Peindre une chambre",description:"Une chambre à rafraîchir cette semaine.",district:"Rabat",latitude:34.03,longitude:-6.83,urgency:"normal",budget_hint:null,status:"open",created_at:"2026-10-18 10:00:00",category_name:"Peinture",category_icon:"P",requester_name:"Lina Amrani" },
  ],
  services:[{ id:"s1",user_id:"u3",category_id:"peinture",title:"Peinture intérieure",description:"Peinture soignée pour appartements et bureaux.",district:"Casablanca",latitude:33.57,longitude:-7.59,price_hint:"À partir de 250 DH",available:1,created_at:"2026-10-17 12:00:00",category_name:"Peinture",category_icon:"P",full_name:"Youssef Benali",rating:4.8,review_count:12 }],
};
const conversations = [{ id:"c1",request_id:"r1",updated_at:"2026-10-20 09:15:00",request_title:"Fuite sous évier",other_name:"Samir Alaoui",last_message:"Je peux passer à 17 h." }];
const messages = [{ id:"m1",body:"Bonjour, êtes-vous disponible ?",created_at:"2026-10-20 09:00:00",sender_id:"me",sender_name:"Nadia ServiceGO" },{ id:"m2",body:"Je peux passer à 17 h.",created_at:"2026-10-20 09:15:00",sender_id:"u1",sender_name:"Samir Alaoui" }];

async function mockApis(page, writes) {
  await page.route("**/api/me", (route) => route.fulfill({ json:{ user } }));
  await page.route("**/api/config", (route) => route.fulfill({ json:{ mapTileUrl:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",mapAttribution:"OpenStreetMap contributors" } }));
  await page.route("**/api/public-context", (route) => route.fulfill({ json:{ country:"MA",region:"Rabat-Salé-Kénitra",city:"Rabat",source:"test" } }));
  await page.route("**/api/categories", (route) => route.fulfill({ json:{ categories } }));
  await page.route("**/api/map", (route) => route.fulfill({ json:mapData }));
  await page.route("**/api/requests", async (route) => {
    if (route.request().method() === "POST") { writes.requests += 1; return route.fulfill({ status:201,json:{ id:"new-request",message:"Votre demande est visible sur la carte." } }); }
    return route.fulfill({ json:{ requests:mapData.requests.filter((item) => item.requester_id === user.id) } });
  });
  await page.route("**/api/services", async (route) => {
    if (route.request().method() === "POST") { writes.services += 1; return route.fulfill({ status:201,json:{ id:"new-service",message:"Votre service est visible sur la carte." } }); }
    return route.fulfill({ json:{ services:mapData.services.filter((item) => item.user_id === user.id) } });
  });
  await page.route("**/api/conversations", (route) => route.fulfill({ json:{ conversations } }));
  await page.route("**/api/conversations/c1/messages", async (route) => route.request().method() === "POST" ? route.fulfill({ status:201,json:{ ok:true } }) : route.fulfill({ json:{ messages } }));
}
async function shot(page, name) {
  if (process.env.SERVICEGO_VALIDATE_ONLY === "1") return;
  await page.waitForTimeout(900);
  await page.screenshot({ path:path.join(output, `${name}.jpg`),type:"jpeg",quality:82 });
}
async function assertNoOverflow(page, label) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    metrics: {
      innerWidth,
      htmlClientWidth: document.documentElement.clientWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      scrollX,
    },
    offenders: [...document.querySelectorAll("body *")]
      .map((element) => ({ selector: `${element.tagName.toLowerCase()}.${typeof element.className === "string" ? element.className : ""}`, left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      .filter((item) => item.left < -1 || item.right > innerWidth + 1 || item.scrollWidth > item.clientWidth + 1)
      .slice(0, 8),
  }));
  assert.ok(result.overflow <= 1, `${label}: overflow ${result.overflow}px ${JSON.stringify(result)}`);
}

async function desktopSuite(browser) {
  const context = await browser.newContext({ viewport:{ width:1440,height:900 },colorScheme:"light",geolocation:{ latitude:34.0209,longitude:-6.8416 },permissions:["geolocation"] });
  const page = await context.newPage(); const writes = { requests:0,services:0 }; await mockApis(page,writes);
  await page.goto(`${baseUrl}/app/carte`,{ waitUntil:"networkidle" });
  assert.equal(await page.locator(".actions-panel").count(),0,"central action panel remains");
  assert.equal(await page.locator(".map-fab").count(),2,"floating creation controls missing");
  assert.ok(await page.locator(".map-cluster").first().isVisible(),"dense markers were not grouped");
  await shot(page,"desktop-01-map-clusters");
  for (let attempt = 0; attempt < 6 && await page.locator(".premium-map-pin.need").count() === 0; attempt += 1) {
    const cluster = page.locator(".map-cluster").first();
    if (await cluster.count() === 0) break;
    await cluster.click();
    await page.waitForTimeout(260);
  }
  await page.locator(".premium-map-pin.need").first().click();
  assert.ok(await page.getByText("Proposer mon aide",{ exact:true }).isVisible(),"request action missing");
  assert.match(await page.locator(".listing-detail").innerText(),/Fuite sous évier|Peindre une chambre/);
  await shot(page,"desktop-02-listing-detail");

  await page.locator('[data-action="locate-me"]').click();
  await page.getByText("Carte recentrée sur votre position.",{ exact:true }).waitFor();
  assert.ok(await page.locator(".leaflet-interactive").count() > 0,"location marker missing");
  await shot(page,"desktop-03-location");

  await page.locator('[data-action="open-request"]').click();
  await page.locator('form[data-form="request"] select[name="category_id"]').selectOption("plomberie");
  await page.locator('form[data-form="request"] input[name="title"]').fill("Réparer une fuite");
  await page.locator('form[data-form="request"] textarea[name="description"]').fill("Une fuite à réparer dans la cuisine.");
  await page.locator('form[data-form="request"] button[type="submit"]').click();
  await page.locator('form[data-form="request"]').waitFor({ state:"detached" });
  assert.equal(writes.requests,1,"request creation was not connected");
  await page.locator('[data-action="open-service"]').click();
  await page.locator('form[data-form="service"] select[name="category_id"]').selectOption("peinture");
  await page.locator('form[data-form="service"] input[name="title"]').fill("Peinture intérieure");
  await page.locator('form[data-form="service"] textarea[name="description"]').fill("Peinture propre pour appartements.");
  await page.locator('form[data-form="service"] button[type="submit"]').click();
  await page.locator('form[data-form="service"]').waitFor({ state:"detached" });
  assert.equal(writes.services,1,"service creation was not connected");

  await page.locator('[data-view="messages"]').click(); await page.locator(".messages-page").waitFor();
  assert.ok(await page.getByText("Je peux passer à 17 h.",{ exact:true }).first().isVisible());
  await shot(page,"desktop-04-messages");
  await page.locator('[data-view="profile"]').click(); await page.locator(".profile-page").waitFor();
  for (const heading of ["Mon compte","Mon activité","Mes échanges","Mon suivi"]) assert.ok(await page.getByText(heading,{ exact:true }).isVisible(),`${heading} missing`);
  await shot(page,"desktop-05-dashboard"); await assertNoOverflow(page,"desktop dashboard"); await context.close();
}

async function mobileSuite(browser) {
  const context = await browser.newContext({ viewport:{ width:390,height:844 },colorScheme:"dark" });
  const page = await context.newPage(); const writes={requests:0,services:0};
  await page.addInitScript(() => { localStorage.setItem("servicego-locale","ar"); Object.defineProperty(navigator,"geolocation",{ value:{ getCurrentPosition(_success,error){ error({ code:1 }); } } }); });
  await mockApis(page,writes); await page.goto(`${baseUrl}/app/carte`,{ waitUntil:"networkidle" });
  await page.locator('[data-action="locate-me"]').click(); await page.getByText("تم رفض إذن الموقع. تظل الخريطة متاحة.",{ exact:true }).waitFor();
  assert.ok(await page.locator("#liveMap").isVisible(),"map disappeared after location refusal"); await shot(page,"mobile-01-map-ar-dark");
  await page.locator('[data-view="messages"]').click(); await page.locator(".messages-page").waitFor();
  await page.locator('[data-action="conversation"]').click();
  await page.locator(".show-conversation .chat").waitFor({ state:"visible" });
  await shot(page,"mobile-02-conversation-ar-dark"); await page.locator('[data-action="messages-back"]').click(); await page.locator(".conversation-list").waitFor({ state:"visible" });
  await page.locator('[data-view="profile"]').click(); await page.locator(".profile-page").waitFor(); await assertNoOverflow(page,"mobile dashboard"); await shot(page,"mobile-03-dashboard-ar-dark"); await context.close();
}

(async () => {
  await mkdir(output,{ recursive:true });
  const candidates=["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(existsSync);
  const requestedSuite = process.env.SERVICEGO_SUITE;
  const suites = requestedSuite === "desktop" ? [desktopSuite] : requestedSuite === "mobile" ? [mobileSuite] : [desktopSuite,mobileSuite];
  for (const suite of suites) {
    const browser=await chromium.launch({ headless:true,executablePath:candidates[0] });
    try { await suite(browser); }
    finally { await browser.close(); }
  }
  console.log(`Member corrective captures written to ${output}`);
})().catch((error) => { console.error(error);process.exitCode=1; });
