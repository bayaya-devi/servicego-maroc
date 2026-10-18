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
