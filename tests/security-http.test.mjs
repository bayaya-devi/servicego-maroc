import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "http://servicego.test";
let miniflare;
let database;
let registrationAddress = 10;

function splitSqlStatements(source) {
  const statements = [];
  let statement = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (!quote && character === "-" && next === "-") { lineComment = true; index += 1; continue; }
    if (!quote && character === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (quote) {
      statement += character;
      if (character === quote && next === quote) { statement += next; index += 1; }
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; statement += character; continue; }
    if (character === ";") {
      if (statement.trim()) statements.push(statement.trim());
      statement = "";
      continue;
    }
    statement += character;
  }
  if (statement.trim()) statements.push(statement.trim());
  return statements;
}

async function api(pathname, { cookie, method = "GET", body, headers } = {}) {
  const response = await miniflare.dispatchFetch(`${base}${pathname}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({}));
  return { response, json, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function register(email, name) {
  const result = await api("/api/auth/register", { method: "POST", headers: { "cf-connecting-ip": `192.0.2.${registrationAddress++}` }, body: { email, password: "Phase1Test!", first_name: name, last_name: "Test", full_name: `${name} Test`, phone: "+212600000000", district: "Rabat" } });
  assert.equal(result.response.status, 201);
  return result.cookie;
}
const requestBody = (title) => ({ category_id: "plomberie", title, description: "Description de test suffisamment longue.", district: "Rabat", latitude: 34.02, longitude: -6.84, urgency: "normal" });

test.before(async () => {
  const workerSource = await readFile(path.join(root, "worker", "index.ts"), "utf8");
  const script = ts.transpileModule(workerSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: "worker/index.ts",
    reportDiagnostics: true,
  });
  const errors = script.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
  assert.deepEqual(errors, [], "The Worker must transpile before security tests run");

  miniflare = new Miniflare({
    script: script.outputText,
    modules: true,
    compatibilityDate: "2026-09-19",
    compatibilityFlags: ["nodejs_compat"],
    bindings: { APP_NAME: "ServiceGO", APP_CITY: "Maroc", ENVIRONMENT: "test" },
    d1Databases: { DB: "servicego-security-tests" },
    kvNamespaces: { UPLOADS: "servicego-security-uploads" },
  });
  database = await miniflare.getD1Database("DB");

  const migrationsDirectory = path.join(root, "migrations");
  const migrationNames = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
  for (const migrationName of migrationNames) {
    const migration = await readFile(path.join(migrationsDirectory, migrationName), "utf8");
    for (const statement of splitSqlStatements(migration)) await database.prepare(statement).run();
  }
}, { timeout: 120000 });

test.after(async () => {
  await miniflare?.dispose();
});

test("SG-001 enforces the rolling quota with concurrent HTTP requests", async () => {
  const email = "quota-a@example.test";
  const initialCookie = await register(email, "Quota");
  await database.prepare("UPDATE profiles SET email_verified = 1 WHERE email = ?").bind(email).run();
  const login = await api("/api/auth/login", { method: "POST", body: { email, password: "Phase1Test!" } });
  assert.equal(login.response.status, 200);
  assert.notEqual(login.cookie, initialCookie);
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => api("/api/requests", { cookie: login.cookie, method: "POST", body: requestBody(`Concurrent ${index}`) })));
  assert.equal(results.filter((result) => result.response.status === 201).length, 3);
  assert.equal(results.filter((result) => result.response.status === 429).length, 7);
  const rejected = results.find((result) => result.response.status === 429);
  assert.equal(rejected.json.code, "REQUEST_QUOTA_EXCEEDED");
  const mine = await api("/api/requests", { cookie: login.cookie });
  const firstId = mine.json.requests[0].id;
  assert.equal((await api(`/api/requests/${firstId}`, { cookie: login.cookie, method: "DELETE" })).response.status, 200);
  assert.equal((await api("/api/requests", { cookie: login.cookie, method: "POST", body: requestBody("Still limited") })).response.status, 429);
  await database.prepare("UPDATE service_requests SET created_at = datetime('now', '-25 hours') WHERE requester_id = (SELECT id FROM profiles WHERE email = ?)").bind(email).run();
  assert.equal((await api("/api/requests", { cookie: login.cookie, method: "POST", body: requestBody("Window released") })).response.status, 201);
});

test("SG-002 rejects cross-account private operations without writes", async () => {
  const aEmail = "security-a@example.test";
  const bEmail = "security-b@example.test";
  const adminEmail = "security-admin@example.test";
  await register(aEmail, "Alice"); await register(bEmail, "Benoit"); await register(adminEmail, "Admin");
  await database.prepare("UPDATE profiles SET email_verified = 1, is_admin = CASE WHEN email = ? THEN 1 ELSE 0 END WHERE email IN (?, ?, ?)").bind(adminEmail, aEmail, bEmail, adminEmail).run();
  const a = await api("/api/auth/login", { method: "POST", body: { email: aEmail, password: "Phase1Test!" } });
  const b = await api("/api/auth/login", { method: "POST", body: { email: bEmail, password: "Phase1Test!" } });
  const admin = await api("/api/auth/login", { method: "POST", body: { email: adminEmail, password: "Phase1Test!" } });
  const created = await api("/api/requests", { cookie: a.cookie, method: "POST", body: requestBody("Alice request") });
  const id = created.json.id;
  assert.equal((await api(`/api/requests/${id}`, { cookie: b.cookie, method: "PATCH", body: { title: "intrusion", description: "intrusion attempt", district: "Rabat" } })).response.status, 404);
  const aRequests = await api("/api/requests", { cookie: a.cookie });
  assert.equal(aRequests.json.requests.find((item) => item.id === id).title, "Alice request");
  assert.equal((await api("/api/admin/overview", { cookie: b.cookie })).response.status, 403);
  assert.equal((await api("/api/admin/overview", { cookie: admin.cookie })).response.status, 200);
  assert.equal((await api("/api/conversations/not-a-conversation/messages", { cookie: b.cookie })).response.status, 404);
  assert.equal((await api("/api/files/uploads/not-owner/00000000-0000-0000-0000-000000000000.jpg", { cookie: b.cookie })).response.status, 404);
});

test("SG-004 resets a password with a single-use token and revokes previous sessions", async () => {
  const email = "reset@example.test";
  const cookie = await register(email, "Reset");
  await database.prepare("UPDATE profiles SET email_verified = 1 WHERE email = ?").bind(email).run();
  const token = "phase1-reset-token";
  const hash = createHash("sha256").update(token).digest("hex");
  await database.prepare("INSERT INTO password_resets (id, user_id, token_hash, expires_at) SELECT ?, id, ?, datetime('now', '+1 hour') FROM profiles WHERE email = ?").bind("00000000-0000-0000-0000-000000000001", hash, email).run();
  const reset = await api("/api/auth/reset-password", { method: "POST", body: { token, password: "NewPhase1!" } });
  assert.equal(reset.response.status, 200);
  assert.equal((await api("/api/me", { cookie })).json.user, null);
  assert.equal((await api("/api/auth/login", { method: "POST", body: { email, password: "Phase1Test!" } })).response.status, 401);
  assert.equal((await api("/api/auth/login", { method: "POST", body: { email, password: "NewPhase1!" } })).response.status, 200);
  assert.equal((await api("/api/auth/reset-password", { method: "POST", body: { token, password: "AnotherPass1!" } })).response.status, 400);
});

test("SG-006 blocks new offers and messages in both directions", async () => {
  const ownerEmail = "block-owner@example.test";
  const providerEmail = "block-provider@example.test";
  await register(ownerEmail, "Owner");
  await register(providerEmail, "Provider");
  await database.prepare("UPDATE profiles SET email_verified = 1 WHERE email IN (?, ?)").bind(ownerEmail, providerEmail).run();
  const owner = await api("/api/auth/login", { method: "POST", body: { email: ownerEmail, password: "Phase1Test!" } });
  const provider = await api("/api/auth/login", { method: "POST", body: { email: providerEmail, password: "Phase1Test!" } });
  const ownerId = (await api("/api/me", { cookie: owner.cookie })).json.user.id;
  const providerId = (await api("/api/me", { cookie: provider.cookie })).json.user.id;
  const created = await api("/api/requests", { cookie: owner.cookie, method: "POST", body: requestBody("Blocked request") });

  assert.equal((await api(`/api/blocks/${ownerId}`, { cookie: provider.cookie, method: "POST" })).response.status, 201);
  const refusedOffer = await api(`/api/requests/${created.json.id}/offers`, { cookie: provider.cookie, method: "POST", body: { message: "Je peux vous aider." } });
  assert.equal(refusedOffer.response.status, 403);
  assert.equal(refusedOffer.json.code, "USER_BLOCKED");
  assert.equal((await api(`/api/blocks/${ownerId}`, { cookie: provider.cookie, method: "DELETE" })).response.status, 200);

  const offer = await api(`/api/requests/${created.json.id}/offers`, { cookie: provider.cookie, method: "POST", body: { message: "Je peux vous aider." } });
  assert.equal(offer.response.status, 201);
  assert.equal((await api(`/api/blocks/${providerId}`, { cookie: owner.cookie, method: "POST" })).response.status, 201);
  const refusedMessage = await api(`/api/conversations/${offer.json.conversation_id}/messages`, { cookie: provider.cookie, method: "POST", body: { body: "Message interdit" } });
  assert.equal(refusedMessage.response.status, 403);
  assert.equal(refusedMessage.json.code, "USER_BLOCKED");
  const blockedList = await api("/api/blocks", { cookie: owner.cookie });
  assert.equal(blockedList.json.blocks.some((item) => item.id === providerId), true);
});
