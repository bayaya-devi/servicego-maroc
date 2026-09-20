type User = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  district: string;
  avatar_url: string | null;
  bio: string | null;
  rating: number;
  review_count: number;
  is_admin: number;
  email_verified: number;
};

type AuthUser = User & { password_hash: string };

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};

const moroccoBounds = { minLat: 27.55, maxLat: 35.95, minLng: -13.25, maxLng: -1.0 };

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

function insideMorocco(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= moroccoBounds.minLat &&
    latitude <= moroccoBounds.maxLat &&
    longitude >= moroccoBounds.minLng &&
    longitude <= moroccoBounds.maxLng
  );
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

function fromHex(value: string): Uint8Array {
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
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: 210000 },
    key,
    256,
  );
  return `pbkdf2:210000:${salt}:${toHex(bits)}`;
}

async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = stored.split(":");
  if (algorithm !== "pbkdf2" || iterations !== "210000" || !salt || !expected) return false;
  const actual = await passwordHash(password, salt);
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(stored);
  return actualBytes.length === expectedBytes.length && crypto.subtle.timingSafeEqual(actualBytes, expectedBytes);
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
    `SELECT p.id, p.email, p.full_name, p.phone, p.district, p.avatar_url, p.bio, p.rating, p.review_count, p.is_admin, p.email_verified
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
  return user.email_verified ? null : json({ error: "Confirmez votre adresse email avant de publier ou contacter un utilisateur." }, 403);
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
  await env.DB.prepare("INSERT INTO conversations (id, request_id, user_a_id, user_b_id) VALUES (?, ?, ?, ?)")
    .bind(id, requestId, firstUserId, secondUserId)
    .run();
  return id;
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
    if (!verification) return badRequest("Ce lien est invalide ou expire.");
    const existing = await env.DB.prepare("SELECT id FROM profiles WHERE email = ? AND id <> ?")
      .bind(verification.email, verification.user_id)
      .first<{ id: string }>();
    if (existing) return badRequest("Cette adresse est deja utilisee.");
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

  if (pathname !== "/api/auth/register" && pathname !== "/api/auth/login") return null;
  if (request.method !== "POST") return json({ error: "Methode non autorisee." }, 405);
  const body = await readBody(request);
  if (!body) return badRequest("Informations invalides.");
  const email = text(body.email, 254).toLowerCase();
  const password = text(body.password, 200);
  if (!validEmail(email) || password.length < 8) return badRequest("Utilisez un email valide et un mot de passe de 8 caracteres minimum.");

  if (pathname === "/api/auth/register") {
    const fullName = text(body.full_name, 80);
    const district = text(body.district, 80) || "Casablanca";
    if (fullName.length < 2) return badRequest("Indiquez votre prenom et nom.");
    if (!(await verifyTurnstile(text(body.turnstile_token, 2048), request, env))) return badRequest("Verification anti-abus invalide.");
    const exists = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?").bind(email).first<{ id: string }>();
    if (exists) return json({ error: "Cet email est deja utilise. Connectez-vous." }, 409);
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO profiles (id, email, password_hash, full_name, phone, district) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, email, await passwordHash(password), fullName, text(body.phone, 30) || null, district)
      .run();
    const sessionId = await createSession(id, env);
    const verificationToken = await createEmailVerification(env, id, email, "signup");
    ctx.waitUntil(sendVerificationEmail(env, email, fullName, verificationToken, new URL(request.url).origin, "signup"));
    const user = await currentUser(new Request(request.url, { headers: { cookie: `sg_session=${sessionId}` } }), env);
    return json({ user }, 201, { "set-cookie": sessionCookie(sessionId, request) });
  }

  const account = await env.DB.prepare(
    "SELECT id, email, full_name, phone, district, avatar_url, bio, rating, review_count, is_admin, email_verified, password_hash FROM profiles WHERE email = ? AND is_active = 1",
  )
    .bind(email)
    .first<AuthUser>();
  if (!account || !(await passwordMatches(password, account.password_hash))) return json({ error: "Email ou mot de passe incorrect." }, 401);
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
    const [requests, services] = await Promise.all([
      env.DB.prepare(
        `SELECT r.*, c.name AS category_name, c.icon AS category_icon, p.full_name AS requester_name
         FROM service_requests r JOIN categories c ON c.id = r.category_id JOIN profiles p ON p.id = r.requester_id
         WHERE r.status = 'open' ORDER BY r.urgency DESC, r.created_at DESC LIMIT 100`,
      ).all(),
      env.DB.prepare(
        `SELECT s.*, c.name AS category_name, c.icon AS category_icon, p.full_name, p.rating, p.review_count
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
    const fullName = text(body.full_name, 80);
    const phone = text(body.phone, 30);
    const district = text(body.district, 80);
    const bio = text(body.bio, 500);
    if (fullName.length < 2) return badRequest("Indiquez votre prenom et nom.");
    await env.DB.prepare("UPDATE profiles SET full_name = ?, phone = ?, district = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(fullName, phone || null, district || "Casablanca", bio || null, user.id)
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
    if (newPassword.length < 8) return badRequest("Le nouveau mot de passe doit avoir 8 caracteres minimum.");
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
    if (nextEmail === user.email) return badRequest("C'est deja votre adresse actuelle.");
    const exists = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?").bind(nextEmail).first<{ id: string }>();
    if (exists) return json({ error: "Cette adresse est deja utilisee." }, 409);
    const account = await env.DB.prepare("SELECT password_hash FROM profiles WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
    if (!account || !(await passwordMatches(currentPassword, account.password_hash))) return json({ error: "Mot de passe actuel incorrect." }, 401);
    const token = await createEmailVerification(env, user.id, nextEmail, "change_email");
    ctx.waitUntil(sendVerificationEmail(env, nextEmail, user.full_name, token, new URL(request.url).origin, "change_email"));
    return json({ message: "Un lien de confirmation a ete envoye a la nouvelle adresse." }, 202);
  }

  if (pathname === "/api/auth/resend-verification" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    if (user.email_verified) return badRequest("Votre adresse est deja confirmee.");
    const token = await createEmailVerification(env, user.id, user.email, "signup");
    ctx.waitUntil(sendVerificationEmail(env, user.email, user.full_name, token, new URL(request.url).origin, "signup"));
    return json({ message: "Un nouveau lien de confirmation a ete envoye." }, 202);
  }

  if (pathname === "/api/admin/overview" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    if (!user.is_admin) return json({ error: "Acces administrateur requis." }, 403);
    const stats = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM profiles WHERE is_active = 1) AS users,
        (SELECT COUNT(*) FROM service_requests WHERE status = 'open') AS open_requests,
        (SELECT COUNT(*) FROM user_services WHERE available = 1) AS active_services,
        (SELECT COUNT(*) FROM conversations) AS conversations`,
    ).first<{ users: number; open_requests: number; active_services: number; conversations: number }>();
    return json({ stats });
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
    const district = text(body.district, 80) || "Casablanca";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const urgency = body.urgency === "urgent" ? "urgent" : "normal";
    if (!categoryId || title.length < 3 || description.length < 5 || !insideMorocco(latitude, longitude)) {
      return badRequest("Completez la demande et choisissez une position au Maroc.");
    }
    const category = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(categoryId).first<{ id: string }>();
    if (!category) return badRequest("Categorie inconnue.");
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO service_requests (id, requester_id, category_id, title, description, district, latitude, longitude, urgency, budget_hint, photo_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.id, categoryId, title, description, district, latitude, longitude, urgency, text(body.budget_hint, 80) || null, text(body.photo_key, 500) || null)
      .run();
    return json({ id, message: "Votre demande est visible sur la carte." }, 201);
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
    const district = text(body.district, 80) || "Casablanca";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!categoryId || title.length < 3 || description.length < 5 || !insideMorocco(latitude, longitude)) {
      return badRequest("Completez le service et choisissez une position au Maroc.");
    }
    const category = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(categoryId).first<{ id: string }>();
    if (!category) return badRequest("Categorie inconnue.");
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO user_services (id, user_id, category_id, title, description, district, latitude, longitude, price_hint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.id, categoryId, title, description, district, latitude, longitude, text(body.price_hint, 80) || null)
      .run();
    return json({ id, message: "Votre service est visible sur la carte." }, 201);
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
    const body = await readBody(request);
    if (!body) return badRequest("Informations invalides.");
    const requestItem = await env.DB.prepare("SELECT id, requester_id, title FROM service_requests WHERE id = ? AND status = 'open'")
      .bind(offerMatch[1])
      .first<{ id: string; requester_id: string; title: string }>();
    if (!requestItem) return notFound();
    if (requestItem.requester_id === user.id) return badRequest("Vous ne pouvez pas repondre a votre propre demande.");
    const message = text(body.message, 1000);
    if (message.length < 3) return badRequest("Ecrivez une courte reponse.");
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare("INSERT INTO offers (id, request_id, provider_id, message, price_hint) VALUES (?, ?, ?, ?, ?)")
        .bind(id, requestItem.id, user.id, message, text(body.price_hint, 80) || null)
        .run();
    } catch {
      return json({ error: "Vous avez deja repondu a cette demande." }, 409);
    }
    const requester = await env.DB.prepare("SELECT email, full_name FROM profiles WHERE id = ?").bind(requestItem.requester_id).first<{ email: string; full_name: string }>();
    if (requester) ctx.waitUntil(sendEmail(env, requester.email, "Nouvelle reponse sur ServiceGO", `<p>Bonjour ${escapeHtml(requester.full_name)},</p><p>${escapeHtml(user.full_name)} a repondu a votre demande: ${escapeHtml(requestItem.title)}.</p>`));
    return json({ id, message: "Votre reponse a ete envoyee." }, 201);
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
    return json({ conversation_id: conversationId, message: "Reponse acceptee. La discussion est ouverte." });
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
    if (description.length < 5 || !insideMorocco(latitude, longitude)) return badRequest("Ajoutez une description et une position au Maroc.");
    const requestId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO service_requests (id, requester_id, target_service_id, category_id, title, description, district, latitude, longitude, urgency, budget_hint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(requestId, user.id, service.id, service.category_id, title, description, text(body.district, 80) || "Casablanca", latitude, longitude, body.urgency === "urgent" ? "urgent" : "normal", text(body.budget_hint, 80) || null)
      .run();
    const conversationId = await findOrCreateConversation(env, requestId, user.id, service.user_id);
    await env.DB.prepare("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), conversationId, user.id, description)
      .run();
    return json({ request_id: requestId, conversation_id: conversationId, message: "Votre demande a ete envoyee directement." }, 201);
  }

  if (pathname === "/api/conversations" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.request_id, c.updated_at, r.title AS request_title,
       CASE WHEN c.user_a_id = ? THEN p_b.full_name ELSE p_a.full_name END AS other_name,
       (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM conversations c
       JOIN profiles p_a ON p_a.id = c.user_a_id JOIN profiles p_b ON p_b.id = c.user_b_id
       LEFT JOIN service_requests r ON r.id = c.request_id
       WHERE c.user_a_id = ? OR c.user_b_id = ? ORDER BY c.updated_at DESC`,
    )
      .bind(user.id, user.id, user.id)
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
        `SELECT m.id, m.body, m.created_at, m.sender_id, p.full_name AS sender_name
         FROM messages m JOIN profiles p ON p.id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
      )
        .bind(conversation.id)
        .all();
      return json({ messages: results });
    }
    if (request.method === "POST") {
      const verificationError = requireVerifiedUser(user);
      if (verificationError) return verificationError;
      const body = await readBody(request);
      const message = text(body?.body, 2000);
      if (!message) return badRequest("Ecrivez un message.");
      await env.DB.batch([
        env.DB.prepare("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)")
          .bind(crypto.randomUUID(), conversation.id, user.id, message),
        env.DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(conversation.id),
      ]);
      return json({ ok: true }, 201);
    }
    return json({ error: "Methode non autorisee." }, 405);
  }

  if (pathname === "/api/uploads" && request.method === "POST") {
    const user = await requireUser(request, env);
    if (isResponse(user)) return user;
    const verificationError = requireVerifiedUser(user);
    if (verificationError) return verificationError;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 6 * 1024 * 1024) return badRequest("Choisissez une image de 6 Mo maximum.");
    if (!file.type.startsWith("image/")) return badRequest("Seules les images sont acceptees.");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `uploads/${user.id}/${crypto.randomUUID()}.${extension}`;
    await env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { userId: user.id } });
    return json({ key, url: `/api/files/${key}` }, 201);
  }

  if (pathname.startsWith("/api/files/") && request.method === "GET") {
    const key = decodeURIComponent(pathname.slice("/api/files/".length));
    if (!key.startsWith("uploads/") || key.includes("..")) return notFound();
    const object = await env.UPLOADS.get(key);
    if (!object) return notFound();
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, max-age=86400");
    return new Response(object.body, { headers });
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
      console.error(JSON.stringify({ event: "api_error", path: url.pathname, message: error instanceof Error ? error.message : "unknown" }));
      return json({ error: "Une erreur est survenue. Reessayez." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
