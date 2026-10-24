/* Admin authentication for the stats dashboard. Ported from api/_admin.js.
 *
 * One operator, one password, no user table. The password itself is never
 * stored or deployed: ADMIN_PASSWORD_HASH holds a scrypt digest produced by
 * scripts/hash-admin-password.mjs on the operator's own machine.
 *
 * Required environment variables:
 *   ADMIN_USER            the username
 *   ADMIN_PASSWORD_HASH   "scrypt$<saltHex>$<keyHex>" from the script
 *   ADMIN_SECRET          random 32+ bytes, signs the session cookie and salts
 *                         the visitor hash
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";

const COOKIE = "kml_admin";
const SESSION_HOURS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function adminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USER && process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SECRET,
  );
}

/* Hash both sides to a fixed width, then compare, so differing lengths neither
   throw nor leak through timing. */
function safeEqual(a: unknown, b: unknown): boolean {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (!salt.length || expected.length !== SCRYPT.keylen) return false;
  const actual = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return crypto.timingSafeEqual(actual, expected);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SECRET as string)
    .update(payload)
    .digest("base64url");
}

/* Cookie strings are written out by hand so the attributes match the old
   handlers exactly (Next's cookie helper would lowercase/reorder them). */
export function issueSession(res: NextResponse): void {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  res.headers.append(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`,
  );
}

export function clearSession(res: NextResponse): void {
  res.headers.append(
    "Set-Cookie",
    `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
  );
}

export function hasValidSession(req: Request): boolean {
  if (!adminConfigured()) return false;
  const raw = req.headers.get("cookie") || "";
  const hit = raw
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`));
  if (!hit) return false;
  const token = hit.slice(COOKIE.length + 1);
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

/** Returns a 401 response when there is no valid session, otherwise null. */
export function requireAdmin(req: Request): NextResponse | null {
  if (hasValidSession(req)) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function checkCredentials(user: unknown, password: unknown): boolean {
  if (!adminConfigured()) return false;
  // Always run scrypt even when the username is wrong, so both failures take
  // the same time.
  const userOk = safeEqual(user || "", process.env.ADMIN_USER);
  const passOk = verifyPassword((password as string) || "", process.env.ADMIN_PASSWORD_HASH as string);
  return userOk && passOk;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
}

/* A per-day, per-visitor pseudonym. The salt rotates at UTC midnight. The raw
   IP is never stored and never leaves this function. */
export function visitorHash(req: Request): string | null {
  if (!process.env.ADMIN_SECRET) return null;
  const ip = clientIp(req) || req.headers.get("x-real-ip") || "";
  const ua = req.headers.get("user-agent") || "";
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`${process.env.ADMIN_SECRET}|${day}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);
}

/* Referrers are kept as a bare host; the full URL can carry search terms. */
export function referrerHost(req: Request): string | null {
  const raw = req.headers.get("referer") || req.headers.get("referrer") || "";
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const self = (req.headers.get("host") || "").toLowerCase();
    if (u.hostname.toLowerCase() === self.split(":")[0]) return null; // internal navigation
    return u.hostname.slice(0, 120);
  } catch {
    return null;
  }
}

export function countryOf(req: Request): string | null {
  const c = req.headers.get("x-vercel-ip-country");
  return typeof c === "string" && /^[A-Z]{2}$/.test(c) ? c : null;
}
