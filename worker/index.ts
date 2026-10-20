type User = {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  district: string;
  avatar_url: string | null;
  cover_url: string | null;
  dashboard_prefs: string;
  bio: string | null;
  rating: number;
  review_count: number;
  is_admin: number;
  email_verified: number;
};

type AuthUser = User & { password_hash: string };
type UploadMetadata = { contentType: string; userId: string; purpose: string };

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};

const passwordIterations = 100000;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...headers } });
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function unauthorized(): Response {
  return json({ error: "Connexion requise." }, 401);
}

function notFound(): Response {
  return json({ error: "Introuvable." }, 404);
}

function text(value: unknown, max = 280): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -85.051129 &&
    latitude <= 85.051129 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function validUploadKey(key: string, ownerId?: string): boolean {
  const match = key.match(/^uploads\/([A-Za-z0-9_-]{1,80})\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/);
  return Boolean(match && (!ownerId || match[1] === ownerId));
}

function validOwnedFileUrl(value: string, ownerId: string): boolean {
  return value === "" || (value.startsWith("/api/files/") && validUploadKey(value.slice("/api/files/".length), ownerId));
}

function getCookie(request: Request, name: string): string | null {
  const source = request.headers.get("cookie") ?? "";
  for (const part of source.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

function sessionCookie(id: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `sg_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `sg_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function randomHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toHex(bytes.buffer);
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function tokenHash(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

async function passwordHash(password: string, salt = randomHex(16)): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: passwordIterations },
    key,
    256,
  );
  return `pbkdf2:${passwordIterations}:${salt}:${toHex(bits)}`;
}

async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = stored.split(":");
  if (algorithm !== "pbkdf2" || iterations !== String(passwordIterations) || !salt || !expected) return false;
  const actual = await passwordHash(password, salt);
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(stored);
  let difference = actualBytes.length ^ expectedBytes.length;
  const length = Math.max(actualBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  return difference === 0;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json<unknown>();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function currentUser(request: Request, env: Env): Promise<User | null> {
  const sessionId = getCookie(request, "sg_session");
  if (!sessionId) return null;
  return env.DB.prepare(
    `SELECT p.id, p.email, p.full_name, p.first_name, p.last_name, p.phone, p.district, p.avatar_url, p.cover_url, p.dashboard_prefs, p.bio, p.rating, p.review_count, p.is_admin, p.email_verified
     FROM sessions s JOIN profiles p ON p.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now') AND p.is_active = 1`,
  )
    .bind(sessionId)
    .first<User>();
}

async function requireUser(request: Request, env: Env): Promise<User | Response> {
  return (await currentUser(request, env)) ?? unauthorized();
}

function isResponse(value: User | Response): value is Response {
  return value instanceof Response;
}

function requireVerifiedUser(user: User): Response | null {
  return user.email_verified ? null : json({ error: "Confirmez votre adresse e-mail avant de publier ou de contacter un utilisateur." }, 403);
}

async function createSession(userId: string, env: Env): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))")
    .bind(id, userId)
    .run();
  return id;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

async function sendEmail(env: Env, recipient: string, subject: string, html: string): Promise<void> {
  const apiKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY;
  const from = (env as Env & { RESEND_FROM_EMAIL?: string }).RESEND_FROM_EMAIL;
  if (!apiKey || !from) return;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [recipient], subject, html }),
  });
  if (!response.ok) console.warn(JSON.stringify({ event: "resend_failed", status: response.status }));
}

async function createEmailVerification(env: Env, userId: string, email: string, purpose: "signup" | "change_email"): Promise<string> {
  const token = randomToken();
  await env.DB.prepare("UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND purpose = ? AND used_at IS NULL")
    .bind(userId, purpose)
    .run();
  await env.DB.prepare(
    "INSERT INTO email_verifications (id, user_id, email, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+24 hours'))",
  )
    .bind(crypto.randomUUID(), userId, email, purpose, await tokenHash(token))
    .run();
  return token;
}

async function sendVerificationEmail(env: Env, email: string, fullName: string, token: string, origin: string, purpose: "signup" | "change_email"): Promise<void> {
  const link = `${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const subject = purpose === "signup" ? "Confirmez votre compte ServiceGO" : "Confirmez votre nouvelle adresse ServiceGO";
  const intro = purpose === "signup" ? "Confirmez votre adresse pour activer votre compte." : "Confirmez cette adresse pour terminer sa modification.";
  await sendEmail(
    env,
    email,
    subject,
    `<p>Bonjour ${escapeHtml(fullName)},</p><p>${intro}</p><p><a href="${escapeHtml(link)}">Confirmer mon adresse</a></p><p>Ce lien expire dans 24 heures.</p>`,
  );
}

function clientAddress(request: Request): string {
  return text(request.headers.get("CF-Connecting-IP"), 64) || "unknown";
}

async function consumeRateLimit(env: Env, scope: string, subjectKey: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / (windowSeconds * 1000));
  const result = await env.DB.prepare(
    `INSERT INTO rate_limit_windows (scope, subject_key, window_start, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(scope, subject_key, window_start) DO UPDATE SET count = count + 1 WHERE count < ?`,
  ).bind(scope, subjectKey, windowStart, limit).run();
  return (result.meta.changes ?? 0) === 1;
}

async function createNotification(env: Env, userId: string, type: "offer" | "message" | "service_update" | "report_update", title: string, body: string, link?: string): Promise<void> {
  await env.DB.prepare("INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, type, text(title, 120), text(body, 500), text(link, 300) || null)
    .run();
}

async function createPasswordReset(env: Env, userId: string): Promise<string> {
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL").bind(userId),
    env.DB.prepare("INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))")
      .bind(crypto.randomUUID(), userId, await tokenHash(token)),
  ]);
  return token;
}

async function ownsUpload(env: Env, key: string, userId: string, allowedPurposes: string[]): Promise<boolean> {
  if (!validUploadKey(key, userId) || !env.UPLOADS) return false;
  const object = await env.UPLOADS.getWithMetadata<UploadMetadata>(key, "stream");
  return Boolean(object.value && object.metadata?.userId === userId && allowedPurposes.includes(object.metadata.purpose));
}

async function sendPasswordResetEmail(env: Env, email: string, fullName: string, token: string, origin: string): Promise<void> {
  const link = `${origin}/?reset_token=${encodeURIComponent(token)}`;
  await sendEmail(
    env,
    email,
    "Réinitialisez votre mot de passe ServiceGO",
    `<p>Bonjour ${escapeHtml(fullName)},</p><p>Pour choisir un nouveau mot de passe, ouvrez ce lien :</p><p><a href="${escapeHtml(link)}">Réinitialiser mon mot de passe</a></p><p>Ce lien expire dans une heure.</p>`,
  );
}

async function verifyTurnstile(token: string, request: Request, env: Env): Promise<boolean> {
  const secret = (env as Env & { TURNSTILE_SECRET_KEY?: string }).TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

async function findOrCreateConversation(env: Env, requestId: string, firstUserId: string, secondUserId: string): Promise<string> {
  const existing = await env.DB.prepare(
    `SELECT id FROM conversations WHERE request_id = ?
     AND ((user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?))`,
  )
    .bind(requestId, firstUserId, secondUserId, secondUserId, firstUserId)
    .first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO conversations (id, request_id, user_a_id, user_b_id) VALUES (?, ?, ?, ?)")
      .bind(id, requestId, firstUserId, secondUserId)
      .run();
    return id;
  } catch (error) {
    const winner = await env.DB.prepare(
      `SELECT id FROM conversations WHERE request_id = ?
       AND ((user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?))`,
    ).bind(requestId, firstUserId, secondUserId, secondUserId, firstUserId).first<{ id: string }>();
    if (winner) return winner.id;
    throw error;
  }
}

async function refreshProfileRating(env: Env, profileId: string): Promise<{ rating: number; review_count: number }> {
  const aggregate = await env.DB.prepare(
    `SELECT ROUND(AVG(rv.rating), 2) AS rating, COUNT(*) AS review_count FROM reviews rv
     WHERE rv.reviewed_id = ? AND (rv.publish_after <= CURRENT_TIMESTAMP OR
       (SELECT COUNT(*) FROM reviews pair WHERE pair.request_id = rv.request_id) >= 2)`,
  ).bind(profileId).first<{ rating: number | null; review_count: number }>();
  const rating = aggregate?.rating ?? 5;
  const reviewCount = aggregate?.review_count ?? 0;
  await env.DB.prepare(
    "UPDATE profiles SET rating = ?, review_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).bind(rating, reviewCount, profileId).run();
  return { rating, review_count: reviewCount };
}

async function handleAuth(request: Request, env: Env, ctx: ExecutionContext, pathname: string): Promise<Response | null> {
  if (pathname === "/api/auth/verify-email" && request.method === "GET") {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) return badRequest("Lien de confirmation invalide.");
    const verification = await env.DB.prepare(
      "SELECT id, user_id, email FROM email_verifications WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')",
    )
      .bind(await tokenHash(token))
      .first<{ id: string; user_id: string; email: string }>();
    if (!verification) return badRequest("Ce lien est invalide ou a expiré.");
    const existing = await env.DB.prepare("SELECT id FROM profiles WHERE email = ? AND id <> ?")
      .bind(verification.email, verification.user_id)
      .first<{ id: string }>();
    if (existing) return badRequest("Cette adresse e-mail est déjà utilisée.");
    await env.DB.batch([
      env.DB.prepare("UPDATE profiles SET email = ?, email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(verification.email, verification.user_id),
      env.DB.prepare("UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(verification.id),
    ]);
    return Response.redirect(`${new URL(request.url).origin}/?email_verified=1`, 302);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const id = getCookie(request, "sg_session");
    if (id) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(request) });
  }

  if (pathname === "/api/auth/forgot-password" && request.method === "POST") {
    const body = await readBody(request);
    const email = text(body?.email, 254).toLowerCase();
    if (!validEmail(email)) return badRequest("Indiquez une adresse e-mail valide.");
    if (!(await consumeRateLimit(env, "password_reset", clientAddress(request), 5, 3600))) {
      return json({ error: "Trop de demandes. Réessayez dans une heure." }, 429);
    }
    const mailEnv = env as Env & { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string };
    if (!mailEnv.RESEND_API_KEY || !mailEnv.RESEND_FROM_EMAIL) {
      return json({ error: "La récupération par e-mail est temporairement indisponible : le service d'envoi n'est pas configuré." }, 503);
    }
    const account = await env.DB.prepare("SELECT id, email, full_name FROM profiles WHERE email = ? AND is_active = 1")
      .bind(email).first<{ id: string; email: string; full_name: string }>();
    if (account) {
      const token = await createPasswordReset(env, account.id);
      ctx.waitUntil(sendPasswordResetEmail(env, account.email, account.full_name, token, new URL(request.url).origin));
    }
    return json({ message: "Si cette adresse correspond à un compte, un lien de réinitialisation vient d'être envoyé." }, 202);
  }

  if (pathname === "/api/auth/reset-password" && request.method === "POST") {
    const body = await readBody(request);
    const token = text(body?.token, 500);
    const password = text(body?.password, 200);
    if (!token || password.length < 8) return badRequest("Utilisez un lien valide et un mot de passe d'au moins 8 caractères.");
    if (!(await consumeRateLimit(env, "password_reset_confirm", clientAddress(request), 10, 3600))) {
      return json({ error: "Trop de tentatives. Réessayez dans une heure." }, 429);
    }
    const reset = await env.DB.prepare(
      `SELECT pr.id, pr.user_id FROM password_resets pr JOIN profiles p ON p.id = pr.user_id
       WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > datetime('now') AND p.is_active = 1`,
    ).bind(await tokenHash(token)).first<{ id: string; user_id: string }>();
    if (!reset) return badRequest("Ce lien est invalide ou a expiré.");
    const sessionId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("UPDATE profiles SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(await passwordHash(password), reset.user_id),
      env.DB.prepare("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reset.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(reset.user_id),
      env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(sessionId, reset.user_id),
    ]);
    const user = await currentUser(new Request(request.url, { headers: { cookie: `sg_session=${sessionId}` } }), env);
    return json({ user, message: "Votre mot de passe a été réinitialisé." }, 200, { "set-cookie": sessionCookie(sessionId, request) });
  }

  if (pathname !== "/api/auth/register" && pathname !== "/api/auth/login") return null;
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const body = await readBody(request);
  if (!body) return badRequest("Informations invalides.");
  const email = text(body.email, 254).toLowerCase();
  const password = text(body.password, 200);
  if (!validEmail(email) || password.length < 8) return badRequest("Utilisez une adresse e-mail valide et un mot de passe d'au moins 8 caractères.");

  if (!(await consumeRateLimit(env, pathname === "/api/auth/register" ? "register" : "login", clientAddress(request), pathname === "/api/auth/register" ? 5 : 12, 900))) {
    return json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, 429);
  }

  if (pathname === "/api/auth/register") {
    const firstName = text(body.first_name, 40);
    const lastName = text(body.last_name, 40);
    const fullName = text(body.full_name, 80) || `${firstName} ${lastName}`.trim();
    const district = text(body.district, 80) || "Non renseignée";
    if (fullName.length < 2) return badRequest("Indiquez votre prénom et votre nom.");
    if (!(await verifyTurnstile(text(body.turnstile_token, 2048), request, env))) return badRequest("La vérification anti-abus a échoué.");
    const exists = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?").bind(email).first<{ id: string }>();
    if (exists) return json({ error: "Cette adresse e-mail est déjà utilisée. Connectez-vous." }, 409);
    const id = crypto.randomUUID();
    const splitAt = fullName.indexOf(" ");
    const storedFirstName = firstName || (splitAt > 0 ? fullName.slice(0, splitAt) : fullName);
    const storedLastName = lastName || (splitAt > 0 ? fullName.slice(splitAt + 1) : "");
    await env.DB.prepare("INSERT INTO profiles (id, email, password_hash, full_name, first_name, last_name, phone, district) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, email, await passwordHash(password), fullName, storedFirstName, storedLastName, text(body.phone, 30) || null, district)
      .run();
    const sessionId = await createSession(id, env);
    const verificationToken = await createEmailVerification(env, id, email, "signup");
    ctx.waitUntil(sendVerificationEmail(env, email, fullName, verificationToken, new URL(request.url).origin, "signup"));
    const user = await currentUser(new Request(request.url, { headers: { cookie: `sg_session=${sessionId}` } }), env);
    return json({
      user,
      email_delivery_configured: Boolean((env as Env & { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string }).RESEND_API_KEY && (env as Env & { RESEND_FROM_EMAIL?: string }).RESEND_FROM_EMAIL),
    }, 201, { "set-cookie": sessionCookie(sessionId, request) });
  }

  const account = await env.DB.prepare(
    "SELECT id, email, full_name, first_name, last_name, phone, district, avatar_url, cover_url, dashboard_prefs, bio, rating, review_count, is_admin, email_verified, password_hash FROM profiles WHERE email = ? AND is_active = 1",
  )
    .bind(email)
    .first<AuthUser>();
  if (!account || !(await passwordMatches(password, account.password_hash))) return json({ error: "Adresse e-mail ou mot de passe incorrect." }, 401);
  const sessionId = await createSession(account.id, env);
  const { password_hash: _passwordHash, ...user } = account;
  return json({ user }, 200, { "set-cookie": sessionCookie(sessionId, request) });
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const authResponse = await handleAuth(request, env, ctx, pathname);
  if (authResponse) return authResponse;

  if (pathname === "/api/health") return json({ ok: true, city: env.APP_CITY, time: new Date().toISOString() });
  if (pathname === "/api/public-context") {
    const cf = (request as Request & { cf?: { country?: string; region?: string; city?: string } }).cf;
    return json({
      country: text(cf?.country, 2).toUpperCase(),
      region: text(cf?.region, 80),
      city: text(cf?.city, 80),
      source: cf?.country ? "cloudflare" : "fallback",
    }, 200, { "cache-control": "private, max-age=300" });
  }
  if (pathname === "/api/config") {
    const mapEnv = env as Env & { MAP_TILE_URL?: string; MAP_ATTRIBUTION?: string };
    return json({
      mapTileUrl: mapEnv.MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      mapAttribution: mapEnv.MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    });
  }
  if (pathname === "/api/me" && request.method === "GET") return json({ user: await currentUser(request, env) });
  if (pathname === "/api/categories" && request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, name, icon FROM categories ORDER BY sort_order, name").all();
    return json({ categories: results });
  }

  if (pathname === "/api/map" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const [requests, services] = await Promise.all([
      env.DB.prepare(
        `SELECT r.id, r.requester_id, r.category_id, r.title, r.description, r.district,
                ROUND(r.latitude, 2) AS latitude, ROUND(r.longitude, 2) AS longitude,
                r.urgency, r.budget_hint, r.photo_key, r.status, r.created_at,
                c.name AS category_name, c.icon AS category_icon, p.full_name AS requester_name
         FROM service_requests r JOIN categories c ON c.id = r.category_id JOIN profiles p ON p.id = r.requester_id
         WHERE r.status = 'open' ORDER BY r.urgency DESC, r.created_at DESC LIMIT 100`,
      ).all(),
      env.DB.prepare(
        `SELECT s.id, s.user_id, s.category_id, s.title, s.description, s.district,
                ROUND(s.latitude, 2) AS latitude, ROUND(s.longitude, 2) AS longitude,
                s.price_hint, s.available, s.created_at,
                c.name AS category_name, c.icon AS category_icon, p.full_name, p.rating, p.review_count
         FROM user_services s JOIN categories c ON c.id = s.category_id JOIN profiles p ON p.id = s.user_id
         WHERE s.available = 1 AND p.is_active = 1 ORDER BY s.created_at DESC LIMIT 100`,
      ).all(),
    ]);
    return json({ requests: requests.results, services: services.results, city: env.APP_CITY });
  }

  if (pathname === "/api/me" && request.method === "PATCH") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const firstName = text(body.first_name, 40);
    const lastName = text(body.last_name, 40);
    const fullName = text(body.full_name, 80) || `${firstName} ${lastName}`.trim();
    const phone = text(body.phone, 30);
    const district = text(body.district, 80);
    const bio = text(body.bio, 500);
    const avatarUrl = text(body.avatar_url, 500);
    const coverUrl = text(body.cover_url, 500);
    const allowedPrefs = { activity: true, exchanges: true, tracking: true };
    if (body.dashboard_prefs && typeof body.dashboard_prefs === "object" && !Array.isArray(body.dashboard_prefs)) {
      for (const key of Object.keys(allowedPrefs) as Array<keyof typeof allowedPrefs>) allowedPrefs[key] = body.dashboard_prefs[key] !== false;
    }
    if (fullName.length < 2) return badRequest("Indiquez votre prénom et votre nom.");
    if (!validOwnedFileUrl(avatarUrl, user.id) || !validOwnedFileUrl(coverUrl, user.id)) return badRequest("Fichier de profil invalide.");
    await env.DB.prepare("UPDATE profiles SET full_name = ?, first_name = ?, last_name = ?, phone = ?, district = ?, bio = ?, avatar_url = ?, cover_url = ?, dashboard_prefs = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(fullName, firstName || fullName, lastName, phone || null, district || "Non renseignée", bio || null, avatarUrl || null, coverUrl || null, JSON.stringify(allowedPrefs), user.id)
      .run();
    return json({ user: await currentUser(request, env) });
  }

  if (pathname === "/api/me/password" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const currentPassword = text(body.current_password, 200);
    const newPassword = text(body.new_password, 200);
    if (newPassword.length < 8) return badRequest("Le nouveau mot de passe doit comporter au moins 8 caractères.");
    const account = await env.DB.prepare("SELECT password_hash FROM profiles WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
    if (!account || !(await passwordMatches(currentPassword, account.password_hash))) return json({ error: "Mot de passe actuel incorrect." }, 401);
    await env.DB.prepare("UPDATE profiles SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(await passwordHash(newPassword), user.id)
      .run();
    return json({ ok: true });
  }

  if (pathname === "/api/me/email" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const nextEmail = text(body.new_email, 254).toLowerCase();
    const currentPassword = text(body.current_password, 200);
    if (!validEmail(nextEmail) || !currentPassword) return badRequest("Indiquez une nouvelle adresse valide et votre mot de passe actuel.");
    if (nextEmail === user.email) return badRequest("C'est déjà votre adresse actuelle.");
    const exists = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?").bind(nextEmail).first<{ id: string }>();
    if (exists) return json({ error: "Cette adresse e-mail est déjà utilisée." }, 409);
    const account = await env.DB.prepare("SELECT password_hash FROM profiles WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
    if (!account || !(await passwordMatches(currentPassword, account.password_hash))) return json({ error: "Mot de passe actuel incorrect." }, 401);
    const token = await createEmailVerification(env, user.id, nextEmail, "change_email");
    ctx.waitUntil(sendVerificationEmail(env, nextEmail, user.full_name, token, new URL(request.url).origin, "change_email"));
    return json({ message: "Un lien de confirmation a été envoyé à la nouvelle adresse." }, 202);
  }

  if (pathname === "/api/me" && request.method === "DELETE") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const body = await readBody(request);
    const currentPassword = text(body?.current_password, 200);
    const account = await env.DB.prepare("SELECT password_hash FROM profiles WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
    if (!account || !(await passwordMatches(currentPassword, account.password_hash))) return json({ error: "Mot de passe actuel incorrect." }, 401);
    const anonymizedEmail = `deleted-${user.id}@servicego.invalid`;
    await env.DB.batch([
      env.DB.prepare(`UPDATE profiles SET email = ?, password_hash = ?, full_name = 'Compte supprimé', first_name = NULL, last_name = NULL,
        phone = NULL, district = 'Non renseignée', avatar_url = NULL, cover_url = NULL, bio = NULL, is_active = 0,
        deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(anonymizedEmail, await passwordHash(randomToken()), user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      env.DB.prepare("UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL").bind(user.id),
      env.DB.prepare("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL").bind(user.id),
    ]);
    return json({ message: "Votre compte a été désactivé et vos informations personnelles ont été retirées." }, 200, { "set-cookie": clearSessionCookie(request) });
  }

  if (pathname === "/api/auth/resend-verification" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    if (user.email_verified) return badRequest("Votre adresse est déjà confirmée.");
    const mailEnv = env as Env & { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string };
    if (!mailEnv.RESEND_API_KEY || !mailEnv.RESEND_FROM_EMAIL) return json({ error: "L'envoi d'e-mails n'est pas encore configuré." }, 503);
    const token = await createEmailVerification(env, user.id, user.email, "signup");
    ctx.waitUntil(sendVerificationEmail(env, user.email, user.full_name, token, new URL(request.url).origin, "signup"));
    return json({ message: "Un nouveau lien de confirmation a été envoyé." }, 202);
  }

  if (pathname === "/api/notifications" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const { results } = await env.DB.prepare("SELECT id, type, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
      .bind(user.id).all();
    return json({ notifications: results });
  }

  if (pathname === "/api/notifications/read" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const body = await readBody(request);
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id)).slice(0, 50) : [];
    if (!ids.length) return badRequest("Aucune notification valide.");
    const placeholders = ids.map(() => "?").join(",");
    await env.DB.prepare(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id IN (${placeholders})`).bind(user.id, ...ids).run();
    return json({ ok: true });
  }

  if (pathname === "/api/reports" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    if (!(await consumeRateLimit(env, "report", user.id, 10, 86400))) return json({ error: "Trop de signalements. Réessayez demain." }, 429);
    const body = await readBody(request);
    const subjectType = text(body?.subject_type, 20);
    const subjectId = text(body?.subject_id, 80);
    const reason = text(body?.reason, 160);
    const details = text(body?.details, 1200);
    if (!new Set(["request", "service", "user", "message"]).has(subjectType) || !subjectId || reason.length < 3) return badRequest("Signalement invalide.");
    let ownerId = "";
    if (subjectType === "request") ownerId = (await env.DB.prepare("SELECT requester_id AS id FROM service_requests WHERE id = ?").bind(subjectId).first<{ id: string }>())?.id || "";
    if (subjectType === "service") ownerId = (await env.DB.prepare("SELECT user_id AS id FROM user_services WHERE id = ?").bind(subjectId).first<{ id: string }>())?.id || "";
    if (subjectType === "user") ownerId = (await env.DB.prepare("SELECT id FROM profiles WHERE id = ? AND is_active = 1").bind(subjectId).first<{ id: string }>())?.id || "";
    if (subjectType === "message") ownerId = (await env.DB.prepare(
      "SELECT m.sender_id AS id FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.id = ? AND (c.user_a_id = ? OR c.user_b_id = ?)",
    ).bind(subjectId, user.id, user.id).first<{ id: string }>())?.id || "";
    if (!ownerId) return notFound();
    if (ownerId === user.id) return badRequest("Vous ne pouvez pas signaler votre propre contenu.");
    try {
      await env.DB.prepare("INSERT INTO reports (id, reporter_id, subject_type, subject_id, reason, details) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), user.id, subjectType, subjectId, reason, details || null).run();
    } catch {
      return json({ error: "Vous avez déjà signalé cet élément." }, 409);
    }
    return json({ message: "Votre signalement a été enregistré." }, 201);
  }

  if (pathname === "/api/admin/overview" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    if (!user.is_admin) return json({ error: "Accès administrateur requis." }, 403);
    const stats = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM profiles WHERE is_active = 1) AS users,
        (SELECT COUNT(*) FROM service_requests WHERE status = 'open') AS open_requests,
        (SELECT COUNT(*) FROM user_services WHERE available = 1) AS active_services,
        (SELECT COUNT(*) FROM conversations) AS conversations,
        (SELECT COUNT(*) FROM reports WHERE status = 'open') AS open_reports`,
    ).first<{ users: number; open_requests: number; active_services: number; conversations: number; open_reports: number }>();
    return json({ stats });
  }

  if (pathname === "/api/admin/reports" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    if (!user.is_admin) return json({ error: "Accès administrateur requis." }, 403);
    const { results } = await env.DB.prepare(
      `SELECT rp.id, rp.subject_type, rp.subject_id, rp.reason, rp.details, rp.status, rp.created_at,
       reporter.full_name AS reporter_name FROM reports rp JOIN profiles reporter ON reporter.id = rp.reporter_id
       ORDER BY CASE rp.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, rp.created_at DESC LIMIT 100`,
    ).all();
    return json({ reports: results });
  }

  const adminReportMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)$/);
  if (adminReportMatch && request.method === "PATCH") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    if (!user.is_admin) return json({ error: "Accès administrateur requis." }, 403);
    const body = await readBody(request);
    const status = text(body?.status, 20);
    if (!new Set(["open", "reviewing", "closed"]).has(status)) return badRequest("Statut de signalement invalide.");
    const result = await env.DB.prepare("UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, adminReportMatch[1]).run();
    if (!(result.meta.changes ?? 0)) return notFound();
    return json({ ok: true });
  }

  if (pathname === "/api/requests" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const { results } = await env.DB.prepare(
      `SELECT r.*, c.name AS category_name, c.icon AS category_icon
       FROM service_requests r JOIN categories c ON c.id = r.category_id WHERE r.requester_id = ? ORDER BY r.created_at DESC`,
    )
      .bind(user.id)
      .all();
    return json({ requests: results });
  }

  if (pathname === "/api/requests" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const categoryId = text(body.category_id, 60);
    const title = text(body.title, 100);
    const description = text(body.description, 1200);
    const district = text(body.district, 80) || "Rabat";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const urgency = body.urgency === "urgent" ? "urgent" : "normal";
    const photoKey = text(body.photo_key, 500);
    if (!categoryId || title.length < 3 || description.length < 5 || !validCoordinates(latitude, longitude)) {
      return badRequest("Complétez la demande et choisissez une position valide sur la carte.");
    }
    if (photoKey && !(await ownsUpload(env, photoKey, user.id, ["request"]))) return badRequest("Photo de demande invalide.");
    const category = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(categoryId).first<{ id: string }>();
    if (!category) return badRequest("Catégorie inconnue.");
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO service_requests (id, requester_id, category_id, title, description, district, latitude, longitude, urgency, budget_hint, photo_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.id, categoryId, title, description, district, latitude, longitude, urgency, text(body.budget_hint, 80) || null, photoKey || null)
      .run();
    return json({ id, message: "Votre demande est visible sur la carte." }, 201);
  }

  const requestMatch = pathname.match(/^\/api\/requests\/([^/]+)$/);
  if (requestMatch && (request.method === "PATCH" || request.method === "DELETE")) {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const item = await env.DB.prepare("SELECT id, status FROM service_requests WHERE id = ? AND requester_id = ?")
      .bind(requestMatch[1], user.id).first<{ id: string; status: string }>();
    if (!item) return notFound();
    if (request.method === "DELETE") {
      if (item.status !== "open") return badRequest("Seule une demande ouverte peut être retirée.");
      await env.DB.prepare("UPDATE service_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(item.id).run();
      return json({ message: "Votre demande a été retirée de la carte." });
    }
    if (item.status !== "open") return badRequest("Seule une demande ouverte peut être modifiée.");
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const title = text(body.title, 100);
    const description = text(body.description, 1200);
    const district = text(body.district, 80);
    const urgency = body.urgency === "urgent" ? "urgent" : "normal";
    if (title.length < 3 || description.length < 5 || !district) return badRequest("Complétez les informations de la demande.");
    await env.DB.prepare("UPDATE service_requests SET title = ?, description = ?, district = ?, urgency = ?, budget_hint = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(title, description, district, urgency, text(body.budget_hint, 80) || null, item.id).run();
    return json({ message: "Votre demande a été mise à jour." });
  }

  if (pathname === "/api/services" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const { results } = await env.DB.prepare(
      `SELECT s.*, c.name AS category_name, c.icon AS category_icon
       FROM user_services s JOIN categories c ON c.id = s.category_id WHERE s.user_id = ? ORDER BY s.created_at DESC`,
    )
      .bind(user.id)
      .all();
    return json({ services: results });
  }

  if (pathname === "/api/services" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const categoryId = text(body.category_id, 60);
    const title = text(body.title, 100);
    const description = text(body.description, 1200);
    const district = text(body.district, 80) || "Rabat";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!categoryId || title.length < 3 || description.length < 5 || !validCoordinates(latitude, longitude)) {
      return badRequest("Complétez le service et choisissez une position valide sur la carte.");
    }
    const category = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(categoryId).first<{ id: string }>();
    if (!category) return badRequest("Catégorie inconnue.");
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO user_services (id, user_id, category_id, title, description, district, latitude, longitude, price_hint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.id, categoryId, title, description, district, latitude, longitude, text(body.price_hint, 80) || null)
      .run();
    return json({ id, message: "Votre service est visible sur la carte." }, 201);
  }

  const serviceMatch = pathname.match(/^\/api\/services\/([^/]+)$/);
  if (serviceMatch && (request.method === "PATCH" || request.method === "DELETE")) {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const item = await env.DB.prepare("SELECT id, available FROM user_services WHERE id = ? AND user_id = ?")
      .bind(serviceMatch[1], user.id).first<{ id: string; available: number }>();
    if (!item) return notFound();
    if (request.method === "DELETE") {
      await env.DB.prepare("UPDATE user_services SET available = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(item.id).run();
      return json({ message: "Votre service n'est plus visible sur la carte." });
    }
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const title = text(body.title, 100);
    const description = text(body.description, 1200);
    const district = text(body.district, 80);
    if (title.length < 3 || description.length < 5 || !district) return badRequest("Complétez les informations du service.");
    await env.DB.prepare("UPDATE user_services SET title = ?, description = ?, district = ?, price_hint = ?, available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(title, description, district, text(body.price_hint, 80) || null, body.available === false ? 0 : 1, item.id).run();
    return json({ message: "Votre service a été mis à jour." });
  }

  const offerMatch = pathname.match(/^\/api\/requests\/([^/]+)\/offers$/);
  if (offerMatch && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const requestItem = await env.DB.prepare("SELECT id, title FROM service_requests WHERE id = ? AND requester_id = ?")
      .bind(offerMatch[1], user.id)
      .first<{ id: string; title: string }>();
    if (!requestItem) return notFound();
    const { results } = await env.DB.prepare(
      `SELECT o.id, o.message, o.price_hint, o.status, o.created_at, p.full_name, p.rating, p.review_count
       FROM offers o JOIN profiles p ON p.id = o.provider_id WHERE o.request_id = ? ORDER BY o.created_at DESC`,
    )
      .bind(requestItem.id)
      .all();
    return json({ request: requestItem, offers: results });
  }

  if (offerMatch && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    if (!(await consumeRateLimit(env, "offer", user.id, 20, 3600))) return json({ error: "Trop de tentatives. Réessayez dans une heure." }, 429);
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const requestItem = await env.DB.prepare("SELECT id, requester_id, title FROM service_requests WHERE id = ? AND status = 'open'")
      .bind(offerMatch[1])
      .first<{ id: string; requester_id: string; title: string }>();
    if (!requestItem) return notFound();
    if (requestItem.requester_id === user.id) return badRequest("Vous ne pouvez pas répondre à votre propre demande.");
    const message = text(body.message, 1000);
    if (message.length < 3) return badRequest("Écrivez une courte réponse.");
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare("INSERT INTO offers (id, request_id, provider_id, message, price_hint) VALUES (?, ?, ?, ?, ?)")
        .bind(id, requestItem.id, user.id, message, text(body.price_hint, 80) || null)
        .run();
    } catch {
      return json({ error: "Vous avez déjà répondu à cette demande." }, 409);
    }
    const conversationId = await findOrCreateConversation(env, requestItem.id, requestItem.requester_id, user.id);
    const existingMessage = await env.DB.prepare("SELECT id FROM messages WHERE conversation_id = ? AND sender_id = ? LIMIT 1")
      .bind(conversationId, user.id)
      .first<{ id: string }>();
    if (!existingMessage) {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO messages (id, conversation_id, sender_id, body, message_type) VALUES (?, ?, ?, ?, 'text')")
          .bind(crypto.randomUUID(), conversationId, user.id, message),
        env.DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(conversationId),
      ]);
    }
    const requester = await env.DB.prepare("SELECT email, full_name FROM profiles WHERE id = ?").bind(requestItem.requester_id).first<{ email: string; full_name: string }>();
    await createNotification(env, requestItem.requester_id, "offer", "Nouvelle réponse", `${user.full_name} a répondu à votre demande : ${requestItem.title}.`, `/app/messages?conversation=${conversationId}`);
    if (requester) ctx.waitUntil(sendEmail(env, requester.email, "Nouvelle réponse sur ServiceGO", `<p>Bonjour ${escapeHtml(requester.full_name)},</p><p>${escapeHtml(user.full_name)} a répondu à votre demande : ${escapeHtml(requestItem.title)}.</p>`));
    return json({ id, conversation_id: conversationId, message: "Votre réponse a été envoyée. La discussion est ouverte." }, 201);
  }

  const acceptMatch = pathname.match(/^\/api\/offers\/([^/]+)\/accept$/);
  if (acceptMatch && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    const offer = await env.DB.prepare(
      `SELECT o.id, o.request_id, o.provider_id, r.requester_id, r.title
       FROM offers o JOIN service_requests r ON r.id = o.request_id WHERE o.id = ? AND o.status = 'pending'`,
    )
      .bind(acceptMatch[1])
      .first<{ id: string; request_id: string; provider_id: string; requester_id: string; title: string }>();
    if (!offer || offer.requester_id !== user.id) return notFound();
    await env.DB.batch([
      env.DB.prepare("UPDATE offers SET status = 'accepted' WHERE id = ?").bind(offer.id),
      env.DB.prepare("UPDATE offers SET status = 'declined' WHERE request_id = ? AND id <> ? AND status = 'pending'").bind(offer.request_id, offer.id),
      env.DB.prepare("UPDATE service_requests SET status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(offer.request_id),
    ]);
    const conversationId = await findOrCreateConversation(env, offer.request_id, user.id, offer.provider_id);
    await createNotification(env, offer.provider_id, "service_update", "Réponse acceptée", `Votre réponse à « ${offer.title} » a été acceptée.`, `/app/messages?conversation=${conversationId}`);
    return json({ conversation_id: conversationId, message: "Réponse acceptée. La discussion est ouverte." });
  }

  const serviceRequestMatch = pathname.match(/^\/api\/services\/([^/]+)\/request$/);
  if (serviceRequestMatch && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const service = await env.DB.prepare("SELECT id, user_id, category_id, title FROM user_services WHERE id = ? AND available = 1")
      .bind(serviceRequestMatch[1])
      .first<{ id: string; user_id: string; category_id: string; title: string }>();
    if (!service) return notFound();
    if (service.user_id === user.id) return badRequest("C'est votre propre service.");
    const title = text(body.title, 100) || `Besoin: ${service.title}`;
    const description = text(body.description, 1200);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (description.length < 5 || !validCoordinates(latitude, longitude)) return badRequest("Ajoutez une description et une position valide.");
    const requestId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO service_requests (id, requester_id, target_service_id, category_id, title, description, district, latitude, longitude, urgency, budget_hint, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned')`,
    )
      .bind(requestId, user.id, service.id, service.category_id, title, description, text(body.district, 80) || "Rabat", latitude, longitude, body.urgency === "urgent" ? "urgent" : "normal", text(body.budget_hint, 80) || null)
      .run();
    const conversationId = await findOrCreateConversation(env, requestId, user.id, service.user_id);
    await env.DB.prepare("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), conversationId, user.id, description)
      .run();
    await createNotification(env, service.user_id, "offer", "Nouvelle demande directe", `${user.full_name} souhaite vous contacter pour « ${service.title} ».`, `/app/messages?conversation=${conversationId}`);
    return json({ request_id: requestId, conversation_id: conversationId, message: "Votre demande a été envoyée directement." }, 201);
  }

  const completeMatch = pathname.match(/^\/api\/requests\/([^/]+)\/complete$/);
  if (completeMatch && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const item = await env.DB.prepare(
      `SELECT r.id, r.requester_id, COALESCE(o.provider_id, s.user_id) AS provider_id FROM service_requests r
       LEFT JOIN offers o ON o.request_id = r.id AND o.status = 'accepted'
       LEFT JOIN user_services s ON s.id = r.target_service_id
       WHERE r.id = ? AND r.status = 'assigned'`,
    ).bind(completeMatch[1]).first<{ id: string; requester_id: string; provider_id: string }>();
    if (!item || (item.requester_id !== user.id && item.provider_id !== user.id)) return notFound();
    await env.DB.prepare("UPDATE service_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(item.id).run();
    return json({ message: "Le service est marqué comme terminé. Les deux participants peuvent maintenant s'évaluer." });
  }

  const reviewMatch = pathname.match(/^\/api\/requests\/([^/]+)\/reviews$/);
  if (reviewMatch && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    const body = await readBody(request);
    const score = Number(body?.rating);
    const comment = text(body?.comment, 500);
    if (!Number.isInteger(score) || score < 1 || score > 5) return badRequest("Choisissez une note de 1 à 5 étoiles.");
    const item = await env.DB.prepare(
      `SELECT r.id, r.requester_id, COALESCE(o.provider_id, s.user_id) AS provider_id FROM service_requests r
       LEFT JOIN offers o ON o.request_id = r.id AND o.status = 'accepted'
       LEFT JOIN user_services s ON s.id = r.target_service_id
       WHERE r.id = ? AND r.status = 'completed'`,
    ).bind(reviewMatch[1]).first<{ id: string; requester_id: string; provider_id: string }>();
    if (!item || (item.requester_id !== user.id && item.provider_id !== user.id)) return notFound();
    const reviewedId = user.id === item.requester_id ? item.provider_id : item.requester_id;
    try {
      await env.DB.prepare("INSERT INTO reviews (id, request_id, reviewer_id, reviewed_id, rating, comment, publish_after) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+7 days'))")
        .bind(crypto.randomUUID(), item.id, user.id, reviewedId, score, comment || null).run();
    } catch {
      return json({ error: "Vous avez déjà évalué ce service." }, 409);
    }
    const participants = [item.requester_id, item.provider_id];
    for (const profileId of participants) {
      const aggregate = await env.DB.prepare(
        `SELECT ROUND(AVG(rv.rating), 2) AS rating, COUNT(*) AS review_count FROM reviews rv
         WHERE rv.reviewed_id = ? AND (rv.publish_after <= CURRENT_TIMESTAMP OR
           (SELECT COUNT(*) FROM reviews pair WHERE pair.request_id = rv.request_id) >= 2)`,
      ).bind(profileId).first<{ rating: number | null; review_count: number }>();
      await env.DB.prepare("UPDATE profiles SET rating = ?, review_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(aggregate?.rating ?? 5, aggregate?.review_count ?? 0, profileId).run();
    }
    return json({ message: "Votre évaluation est enregistrée. Elle sera publiée après l'autre avis ou dans sept jours." }, 201);
  }

  if (pathname === "/api/activity" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const [replied, reviews, profileRating] = await Promise.all([
      env.DB.prepare(
        `SELECT r.id, r.title, r.status, r.completed_at, o.status AS offer_status
         FROM offers o JOIN service_requests r ON r.id = o.request_id
         WHERE o.provider_id = ? ORDER BY o.created_at DESC LIMIT 50`,
      ).bind(user.id).all(),
      env.DB.prepare(
        `SELECT rv.id, rv.rating, rv.comment, rv.created_at, p.full_name AS reviewer_name, r.title AS request_title
         FROM reviews rv JOIN profiles p ON p.id = rv.reviewer_id JOIN service_requests r ON r.id = rv.request_id
         WHERE rv.reviewed_id = ? AND (rv.publish_after <= CURRENT_TIMESTAMP OR
           (SELECT COUNT(*) FROM reviews pair WHERE pair.request_id = rv.request_id) >= 2)
         ORDER BY rv.created_at DESC LIMIT 50`,
      ).bind(user.id).all(),
      refreshProfileRating(env, user.id),
    ]);
    return json({ replied: replied.results, reviews: reviews.results, ...profileRating });
  }

  if (pathname === "/api/conversations" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.request_id, c.updated_at, r.title AS request_title, r.status AS request_status,
       CASE WHEN c.user_a_id = ? THEN p_b.full_name ELSE p_a.full_name END AS other_name,
       CASE WHEN c.user_a_id = ? THEN p_b.avatar_url ELSE p_a.avatar_url END AS other_avatar_url,
       (SELECT CASE m.message_type WHEN 'image' THEN 'Image' WHEN 'video' THEN 'Vidéo' WHEN 'audio' THEN 'Message vocal' WHEN 'location' THEN 'Localisation' ELSE m.body END FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> ? AND m.rowid > COALESCE((SELECT cr.last_message_rowid FROM conversation_reads cr WHERE cr.conversation_id = c.id AND cr.user_id = ?), 0)) AS unread_count
       FROM conversations c
       JOIN profiles p_a ON p_a.id = c.user_a_id JOIN profiles p_b ON p_b.id = c.user_b_id
       LEFT JOIN service_requests r ON r.id = c.request_id
       WHERE c.user_a_id = ? OR c.user_b_id = ? ORDER BY c.updated_at DESC`,
    )
      .bind(user.id, user.id, user.id, user.id, user.id, user.id)
      .all();
    return json({ conversations: results });
  }

  const messagesMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (messagesMatch) {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const conversation = await env.DB.prepare("SELECT id FROM conversations WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)")
      .bind(messagesMatch[1], user.id, user.id)
      .first<{ id: string }>();
    if (!conversation) return notFound();
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT m.id, m.body, m.message_type, m.media_key, m.media_mime, m.latitude, m.longitude, m.created_at, m.sender_id, p.full_name AS sender_name
         FROM messages m JOIN profiles p ON p.id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
      )
        .bind(conversation.id)
        .all();
      await env.DB.prepare(`INSERT INTO conversation_reads (conversation_id, user_id, read_at, last_message_rowid)
        VALUES (?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT MAX(rowid) FROM messages WHERE conversation_id = ?), 0))
        ON CONFLICT(conversation_id, user_id) DO UPDATE SET
          read_at = CURRENT_TIMESTAMP,
          last_message_rowid = excluded.last_message_rowid`)
        .bind(conversation.id, user.id, conversation.id)
        .run();
      return json({ messages: results });
    }
    if (request.method === "POST") {
      const verificationError = requireVerifiedUser(user);
      if (verificationError) return verificationError;
      if (!(await consumeRateLimit(env, "message", `${user.id}:${conversation.id}`, 60, 60))) return json({ error: "Trop de messages. Réessayez dans une minute." }, 429);
      const body = await readBody(request);
      const message = text(body?.body, 2000);
      const messageType = text(body?.message_type, 20) || "text";
      if (!new Set(["text", "image", "video", "audio", "location"]).has(messageType)) return badRequest("Type de message invalide.");
      const mediaKey = text(body?.media_key, 500);
      const mediaMime = text(body?.media_mime, 100);
      const latitude = Number(body?.latitude);
      const longitude = Number(body?.longitude);
      if (messageType === "text" && !message) return badRequest("Écrivez un message.");
      if (["image", "video", "audio"].includes(messageType) && (!(await ownsUpload(env, mediaKey, user.id, ["message"])) || !mediaMime)) return badRequest("Pièce jointe invalide.");
      if (messageType === "location" && !validCoordinates(latitude, longitude)) return badRequest("Localisation invalide.");
      await env.DB.batch([
        env.DB.prepare("INSERT INTO messages (id, conversation_id, sender_id, body, message_type, media_key, media_mime, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), conversation.id, user.id, message, messageType, mediaKey || null, mediaMime || null, messageType === "location" ? latitude : null, messageType === "location" ? longitude : null),
        env.DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(conversation.id),
      ]);
      const recipientId = await env.DB.prepare("SELECT CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END AS id FROM conversations WHERE id = ?")
        .bind(user.id, conversation.id).first<{ id: string }>();
      if (recipientId) await createNotification(env, recipientId.id, "message", "Nouveau message", `${user.full_name} vous a envoyé un message.`, `/app/messages?conversation=${conversation.id}`);
      return json({ ok: true }, 201);
    }
    return json({ error: "Méthode non autorisée." }, 405);
  }

  if (pathname === "/api/uploads" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    if (!(await consumeRateLimit(env, "upload", user.id, 30, 3600))) return json({ error: "Trop d'envois de fichiers. Réessayez dans une heure." }, 429);
    const uploads = env.UPLOADS;
    if (!uploads) return json({ error: "Le stockage des fichiers n'est pas configuré." }, 503);
    const form = await request.formData();
    const file = form.get("file");
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4"]);
    if (!(file instanceof File) || file.size === 0) return badRequest("Choisissez un fichier valide.");
    if (!allowedTypes.has(file.type)) return badRequest("Ce format de fichier n'est pas accepté.");
    const maxSize = file.type.startsWith("image/") ? 8 * 1024 * 1024 : file.type.startsWith("audio/") ? 15 * 1024 * 1024 : 24 * 1024 * 1024;
    if (file.size > maxSize) return badRequest("Ce fichier dépasse la taille autorisée.");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `uploads/${user.id}/${crypto.randomUUID()}.${extension}`;
    await uploads.put(key, file.stream(), { metadata: { contentType: file.type, userId: user.id, purpose: text(form.get("purpose"), 30) || "attachment" } satisfies UploadMetadata });
    return json({ key, url: `/api/files/${key}` }, 201);
  }

  if (pathname.startsWith("/api/files/") && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const uploads = env.UPLOADS;
    if (!uploads) return notFound();
    const key = decodeURIComponent(pathname.slice("/api/files/".length));
    if (!validUploadKey(key)) return notFound();
    const owned = validUploadKey(key, user.id);
    const referenced = owned || Boolean(await env.DB.prepare(
      `SELECT 1 FROM profiles WHERE avatar_url = ? OR cover_url = ?
       UNION ALL SELECT 1 FROM service_requests WHERE photo_key = ?
       UNION ALL SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.media_key = ? AND (c.user_a_id = ? OR c.user_b_id = ?) LIMIT 1`,
    ).bind(`/api/files/${key}`, `/api/files/${key}`, key, key, user.id, user.id).first());
    if (!referenced) return notFound();
    const object = await uploads.getWithMetadata<UploadMetadata>(key, "stream");
    if (!object.value) return notFound();
    const headers = new Headers({ "content-type": object.metadata?.contentType || "application/octet-stream" });
    headers.set("cache-control", "private, max-age=86400");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.value, { headers });
  }

  return notFound();
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env, ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.error(JSON.stringify({ event: "api_error", path: url.pathname, message }));
      return json({ error: "Une erreur est survenue. Réessayez." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
