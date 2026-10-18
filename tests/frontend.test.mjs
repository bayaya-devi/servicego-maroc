import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the document exposes the design system and a skip link", async () => {
  const html = await read("public/index.html");
  assert.match(html, /tokens\.css/);
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /assets\/servicego-symbol\.png/);
});

test("official semantic colors and responsive rules are centralized", async () => {
  const [tokens, styles] = await Promise.all([read("public/tokens.css"), read("public/styles.css")]);
  assert.match(tokens, /--sg-blue:\s*#2585e6/i);
  assert.match(tokens, /--sg-orange:\s*#ff9138/i);
  assert.match(tokens, /--sg-mint:\s*#43c6a5/i);
  assert.match(styles, /@media \(max-width:760px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\[dir="rtl"\]/);
});

test("critical member controls and three locales are present", async () => {
  const source = await read("public/app.js");
  assert.match(source, /open-quick/);
  assert.match(source, /accessibleMapList/);
  assert.match(source, /mapMode/);
  assert.match(source, /uiTranslations/);
  assert.match(source, /[\u0600-\u06ff]/);
});

test("the V2 public story uses the official characters and exact narrative", async () => {
  const [source, styles] = await Promise.all([read("public/app.js"), read("public/styles.css")]);
  assert.match(source, /Un besoin\.<\/span><span>Une personne\.<\/span><span>Une solution\./);
  assert.match(source, /Deux possibilités\. Un seul compte\./);
  assert.match(source, /L'entraide commence ici\./);
  assert.match(source, /class="character blue-character"/);
  assert.match(source, /class="character green-character"/);
  assert.match(styles, /servicego-symbol\.png/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test("public information and immersive assets are wired locally", async () => {
  const [source, styles] = await Promise.all([read("public/app.js"), read("public/styles.css")]);
  assert.match(source, /faqModal/);
  assert.match(source, /legalModal/);
  assert.match(styles, /assets\/scenes\/rabat-people\.jpg/);
  assert.match(styles, /assets\/scenes\/marrakech-people\.jpg/);
  assert.doesNotMatch(source, /mailto:contact@servicego\.ma/);
});

test("the operational map requires a session and rounds coordinates", async () => {
  const worker = await read("worker/index.ts");
  const route = worker.slice(worker.indexOf('pathname === "/api/map"'), worker.indexOf('pathname === "/api/me" && request.method === "PATCH"'));
  assert.match(route, /requireUser/);
  assert.match(route, /ROUND\(r\.latitude, 2\)/);
  assert.match(route, /ROUND\(s\.longitude, 2\)/);
});

test("deployment targets the active branch and D1 database", async () => {
  const workflow = await read(".github/workflows/deploy.yml");
  assert.match(workflow, /branches: \[master\]/);
  assert.match(workflow, /d1 migrations apply servicego-production --remote/);
});

test("V2.1 uses one scroll-driven viewport with a real marketing map", async () => {
  const [source, styles] = await Promise.all([read("public/app.js"), read("public/styles.css")]);
  assert.match(source, /class="story-viewport"/);
  assert.match(source, /id="marketing-map"/);
  assert.match(source, /Leaflet\.map\(mapElement/);
  assert.match(source, /--meeting-progress/);
  assert.match(styles, /\.story-viewport\s*\{[^}]*position:sticky/s);
  assert.match(styles, /rotateY\(var\(--phone-rotate/);
  assert.doesNotMatch(source, /class="visitor-brand"/);
  assert.doesNotMatch(source, />Découvrir <span/);
});

test("V2.1 public nucleus expands horizontally and exposes icon actions", async () => {
  const [source, styles] = await Promise.all([read("public/app.js"), read("public/styles.css")]);
  assert.match(source, /class="nucleus-secondary"/);
  assert.match(source, /data-action="cycle-locale"/);
  assert.match(source, /data-action="open-contact"/);
  assert.match(source, /state\.publicMenuOpen \? "−" : "\+"/);
  assert.doesNotMatch(source, /class="nucleus-more"/);
  assert.match(styles, /\.is-expanded \.nucleus-secondary\s*\{[^}]*width:/s);
});

test("V2.1 signup, recovery and public information are complete", async () => {
  const [source, worker] = await Promise.all([read("public/app.js"), read("worker/index.ts")]);
  assert.match(source, /name="first_name"/);
  assert.match(source, /name="last_name"/);
  assert.match(source, /name="dial_code"/);
  assert.match(source, /data-form="forgot"/);
  assert.match(source, /aetbconseil@gmail\.com/);
  assert.match(source, /data-action="legal-tab"/);
  assert.match(worker, /\/api\/auth\/forgot-password/);
  assert.match(worker, /\/api\/public-context/);
});

test("the immediate-help CTA preserves request intent through authentication", async () => {
  const [source, styles] = await Promise.all([read("public/app.js"), read("public/styles.css")]);
  assert.match(source, /data-action="urgent-request"/);
  assert.match(source, /J'ai besoin d'aide maintenant/);
  assert.match(source, /I need help now/);
  assert.match(source, /أحتاج إلى المساعدة الآن/);
  assert.match(source, /state\.pendingIntent = "request"/);
  assert.match(source, /state\.authMode = "register"/);
  assert.match(source, /continueToRequest \? "request" : null/);
  assert.match(styles, /\.urgent-help-cta\s*\{[^}]*backdrop-filter:[^}]*animation:urgent-help-pulse/s);
  assert.match(styles, /\.discover-arrow,\.urgent-help-cta\s*\{\s*animation:none/);
});

test("photo selection is deterministic and falls back internationally", async () => {
  const { photoCatalog, selectPhotoSet } = await import("../public/photo-catalog.js");
  assert.ok(photoCatalog.length >= 6);
  const madrid = selectPhotoSet("ES", () => 0.5);
  assert.equal(madrid.length, 2);
  assert.ok(madrid.every((photo) => photo.country === "ES"));
  assert.deepEqual(selectPhotoSet("XX", () => 0), selectPhotoSet("XX", () => 0));
  assert.ok(photoCatalog.every((photo) => photo.credit && photo.license && photo.source && photo.alt.fr && photo.alt.en && photo.alt.ar));
});
