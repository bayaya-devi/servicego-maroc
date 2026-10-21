const passwordIterations = 100000;

export function getCookie(request: Request, name: string): string | null {
  const source = request.headers.get("cookie") ?? "";
  for (const part of source.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export function sessionCookie(id: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `sg_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `sg_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function randomHex(length: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(length)).buffer);
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function tokenHash(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

export async function passwordHash(password: string, salt = randomHex(16)): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: passwordIterations }, key, 256);
  return `pbkdf2:${passwordIterations}:${salt}:${toHex(bits)}`;
}

export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = stored.split(":");
  if (algorithm !== "pbkdf2" || iterations !== String(passwordIterations) || !salt || !expected) return false;
  const actualBytes = new TextEncoder().encode(await passwordHash(password, salt));
  const expectedBytes = new TextEncoder().encode(stored);
  let difference = actualBytes.length ^ expectedBytes.length;
  const length = Math.max(actualBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  return difference === 0;
}
