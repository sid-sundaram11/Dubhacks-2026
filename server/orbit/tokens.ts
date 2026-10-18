import { createHmac, timingSafeEqual } from "node:crypto";

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signJwt(userId: string, secret: string, nowSec: number, ttlSec: number): string {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      iat: nowSec,
      exp: nowSec + ttlSec,
    }),
  );
  const data = `${header}.${payload}`;
  return `${data}.${sign(data, secret)}`;
}

export function verifyJwt(token: string, secret: string, nowSec: number): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;
  const data = `${header}.${payload}`;
  if (!same(signature, sign(data, secret))) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      role?: string;
      exp?: number;
    };
    if (!body.sub || body.role !== "authenticated") return null;
    if (typeof body.exp !== "number" || body.exp <= nowSec) return null;
    return body.sub;
  } catch {
    return null;
  }
}

export function verifyAnyJwt(token: string, secrets: readonly string[], nowSec: number): string | null {
  for (const secret of secrets) {
    if (!secret) continue;
    const userId = verifyJwt(token, secret, nowSec);
    if (userId) return userId;
  }
  return null;
}

export function signMediaToken(path: string, secret: string, exp: number): string {
  const body = encode(JSON.stringify({ path, exp }));
  return `${body}.${sign(body, secret)}`;
}

export function verifyMediaToken(token: string, secret: string, nowSec: number): string | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!same(signature, sign(body, secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { path?: string; exp?: number };
    if (!parsed.path || typeof parsed.exp !== "number" || parsed.exp <= nowSec) return null;
    if (parsed.path.includes("..")) return null;
    return parsed.path;
  } catch {
    return null;
  }
}
