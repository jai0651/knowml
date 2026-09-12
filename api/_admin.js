/* Admin authentication for the stats dashboard.
 *
 * One operator, one password, no user table. The password itself is never
 * stored or deployed — ADMIN_PASSWORD_HASH holds a scrypt digest produced by
 * scripts/hash-admin-password.mjs on the operator's own machine, so the
 * deployed environment never contains anything that can be replayed elsewhere
 * if the env is ever read.
 *
 * Required environment variables:
 *   ADMIN_USER            the username
 *   ADMIN_PASSWORD_HASH   "scrypt$<saltHex>$<keyHex>" from the script
 *   ADMIN_SECRET          random 32+ bytes, signs the session cookie and salts
 *                         the visitor hash
 */
import crypto from "node:crypto";

const COOKIE = "kml_admin";
const SESSION_HOURS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function adminConfigured() {
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SECRET);
}

/* Comparing strings of different lengths with timingSafeEqual throws, and
   comparing them with === leaks length through timing. Hash both sides to a
   fixed width first, then compare those. */
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (!salt.length || expected.length !== SCRYPT.keylen) return false;
  const actual = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return crypto.timingSafeEqual(actual, expected);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

function sign(payload) {
  return crypto.createHmac("sha256", process.env.ADMIN_SECRET).update(payload).digest("base64url");
}

export function issueSession(res) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  res.setHeader("Set-Cookie", [
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`,
  ]);
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", [`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`]);
}

export function hasValidSession(req) {
  if (!adminConfigured()) return false;
  const raw = req.headers.cookie || "";
  const hit = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
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

export function requireAdmin(req, res) {
  if (hasValidSession(req)) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

export function checkCredentials(user, password) {
  if (!adminConfigured()) return false;
  // Always run the scrypt verification even when the username is wrong, so a
  // bad username and a bad password take the same time to reject.
  const userOk = safeEqual(user || "", process.env.ADMIN_USER);
  const passOk = verifyPassword(password || "", process.env.ADMIN_PASSWORD_HASH);
  return userOk && passOk;
}

/* A per-day, per-visitor pseudonym. The salt rotates at UTC midnight, so the
   same reader gets a different id tomorrow: enough to count uniques within a
   day, useless for building a profile across days. The raw IP is never stored
   and never leaves this function. */
export function visitorHash(req) {
  if (!process.env.ADMIN_SECRET) return null;
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "";
  const ua = req.headers["user-agent"] || "";
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`${process.env.ADMIN_SECRET}|${day}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);
}

/* Referrers are kept as a bare host. The full URL can carry search terms and
   session ids in its query string, which is more than a view counter needs. */
export function referrerHost(req) {
  const raw = req.headers.referer || req.headers.referrer || "";
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const self = (req.headers.host || "").toLowerCase();
    if (u.hostname.toLowerCase() === self.split(":")[0]) return null;  // internal navigation
    return u.hostname.slice(0, 120);
  } catch {
    return null;
  }
}

export function countryOf(req) {
  const c = req.headers["x-vercel-ip-country"];
  return typeof c === "string" && /^[A-Z]{2}$/.test(c) ? c : null;
}
