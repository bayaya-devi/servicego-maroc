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
  assert.match(source, /\/i18n\.js/);
  assert.match(source, /[\u0600-\u06ff]/);
});

test("the V2 public story uses the official characters and exact narrative", async () => {
  const [source, styles] = await Promise.all([read("public/app.js"), read("public/styles.css")]);
  assert.match(source, /Un besoin\.<\/span><span>Une personne\.<\/span><span>Une solution\./);
  assert.match(source, /Deux possibilités\. Un seul compte\./);
  assert.match(source, /L'entraide commence ici\./);
  assert.match(source, /class="character blue-character"/);
  assert.match(source, /class="character green-character"/);
  assert.match(source, /servicego-character-blue\.svg/);
  assert.match(source, /servicego-character-green\.svg/);
  assert.doesNotMatch(source + styles, /servicego-characters\.png/);
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
  const [source, styles, i18n] = await Promise.all([read("public/app.js"), read("public/styles.css"), read("public/i18n.js")]);
  assert.match(source, /data-action="urgent-request"/);
  assert.match(source, /J'ai besoin d'aide maintenant/);
  assert.match(i18n, /I need help now/);
  assert.match(i18n, /أحتاج إلى المساعدة الآن/);
  assert.match(source, /state\.pendingIntent = "request"/);
  assert.match(source, /state\.authMode = "register"/);
  assert.match(source, /continueToRequest \? "request" : null/);
  assert.match(styles, /\.urgent-help-cta\s*\{[^}]*backdrop-filter:[^}]*animation:urgent-help-pulse/s);
  assert.match(styles, /\.discover-arrow,\.urgent-help-cta\s*\{\s*animation:none/);
});

test("the translation catalog is complete, normalized and valid UTF-8", async () => {
  const { translationEntries, uiTranslations } = await import("../public/i18n.js");
  const files = ["public/index.html", "public/app.js", "public/i18n.js", "public/photo-catalog.js", "public/styles.css", "public/tokens.css", "worker/index.ts"];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const file of files) {
    const bytes = await readFile(new URL(`../${file}`, import.meta.url));
    const value = decoder.decode(bytes);
    assert.ok(!value.includes("�"), `${file} contains a replacement character`);
    assert.equal(value, value.normalize("NFC"), `${file} is not normalized as NFC`);
  }
  const keys = translationEntries.map(([fr]) => fr);
  assert.equal(new Set(keys).size, keys.length, "the translation catalog contains duplicate French keys");
  for (const [fr, en, ar] of translationEntries) {
    assert.ok(fr.trim() && en.trim() && ar.trim(), `incomplete translation for: ${fr}`);
    assert.equal(uiTranslations.en[fr], en);
    assert.equal(uiTranslations.ar[fr], ar);
    assert.match(ar, /[\u0600-\u06ff]/, `Arabic translation missing Arabic characters for: ${fr}`);
  }
});

test("every static interface label and API message has EN and AR translations", async () => {
  const { uiTranslations } = await import("../public/i18n.js");
  const [source, worker] = await Promise.all([read("public/app.js"), read("worker/index.ts")]);
  const candidates = new Set();
  for (const match of source.matchAll(/>([^<>{}\n]+)</g)) {
    const value = match[1].trim();
    if (/[A-Za-zÀ-ÿ]/.test(value)) candidates.add(value);
  }
  for (const match of source.matchAll(/(?:aria-label|placeholder)="([^"$]+)"/g)) candidates.add(match[1].trim());
  for (const pattern of [/badRequest\("([^"]+)"/g, /(?:error|message): "([^"]+)"/g]) {
    for (const match of worker.matchAll(pattern)) candidates.add(match[1].trim());
  }
  const allowed = new Set(["ServiceGO", "OpenStreetMap", "GO", "FR", "EN", "AR", "2D", "C+", "A/文", "i", "x", "×", "6 12 34 56 78", "aetbconseil@gmail.com", "`).join(\"\") : `"]);
  const missing = [...candidates].filter((value) => !allowed.has(value) && (!uiTranslations.en[value] || !uiTranslations.ar[value]));
  assert.deepEqual(missing, [], `missing translations: ${missing.join(" | ")}`);
});

test("French system copy has no known unaccented spellings", async () => {
  const [source, worker] = await Promise.all([read("public/app.js"), read("worker/index.ts")]);
  const forbidden = /\b(?:Apercu|Categorie|Completez|Creez|Creer|Ecrire|Menage|Methode|Prenom|Reessayez|Repondre|Reponse|Selection|Telephone|deconnecter|deja|envoyee|etes|meme|reponse|resultat|securisee|utilisee)\b/;
  assert.doesNotMatch(source, forbidden);
  assert.doesNotMatch(worker, forbidden);
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
