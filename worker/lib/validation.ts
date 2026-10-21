const maxJsonBodyBytes = 64 * 1024;

export function text(value: unknown, max = 280): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function encodeCursor(value: number | null | undefined): string | null {
  return value ? btoa(String(value)).replaceAll("=", "") : null;
}

export function decodeCursor(value: string | null): number | null {
  if (!value) return null;
  try {
    const decoded = Number(atob(value));
    return Number.isSafeInteger(decoded) && decoded > 0 ? decoded : null;
  } catch {
    return null;
  }
}

export function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -85.051129 && latitude <= 85.051129 && longitude >= -180 && longitude <= 180;
}

export function validUploadKey(key: string, ownerId?: string): boolean {
  const match = key.match(/^uploads\/([A-Za-z0-9_-]{1,80})\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/);
  return Boolean(match && (!ownerId || match[1] === ownerId));
}

export function validOwnedFileUrl(value: string, ownerId: string): boolean {
  return value === "" || (value.startsWith("/api/files/") && validUploadKey(value.slice("/api/files/".length), ownerId));
}

export function validMediaSignature(bytes: Uint8Array, contentType: string): boolean {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (start: number, value: string) => [...value].every((character, index) => bytes[start + index] === character.charCodeAt(0));
  if (contentType === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (contentType === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (contentType === "image/webp") return ascii(0, "RIFF") && ascii(8, "WEBP");
  if (contentType === "image/gif") return ascii(0, "GIF87a") || ascii(0, "GIF89a");
  if (contentType === "video/mp4" || contentType === "audio/mp4") return ascii(4, "ftyp");
  if (contentType === "video/webm" || contentType === "audio/webm") return starts(0x1a, 0x45, 0xdf, 0xa3);
  if (contentType === "audio/ogg") return ascii(0, "OggS");
  if (contentType === "audio/mpeg") return ascii(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return false;
}

export function mediaExtension(contentType: string): string {
  return ({
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/webm": "webm", "audio/webm": "webm", "audio/ogg": "ogg",
    "audio/mpeg": "mp3", "audio/mp4": "m4a",
  } as Record<string, string>)[contentType] || "bin";
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > maxJsonBodyBytes) return null;
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > maxJsonBodyBytes) return null;
    const body = JSON.parse(source) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
