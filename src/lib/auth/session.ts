export const SESSION_COOKIE_NAME = "dca_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function getAuthSecret() {
  return process.env.AUTH_SECRET;
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(signature);
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createSessionToken() {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET is required.");

  const issuedAt = Date.now().toString();
  const signature = await sign(issuedAt, secret);
  return `${issuedAt}.${signature}`;
}

export async function verifySessionToken(token?: string) {
  const secret = getAuthSecret();
  if (!secret || !token) return false;

  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) return false;

  const ageMs = Date.now() - issuedAtMs;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_SECONDS * 1000) return false;

  const expectedSignature = await sign(issuedAt, secret);
  return constantTimeEqual(signature, expectedSignature);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
