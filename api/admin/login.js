import { adminConfigured, checkCredentials, issueSession, hasValidSession } from "../_admin.js";

/* A crude in-memory throttle. Fluid Compute reuses instances, so in practice
   this catches a burst from one address; it is not a distributed rate limiter
   and does not pretend to be. The real defence is scrypt plus a password long
   enough that online guessing is hopeless — which is why the hashing script
   refuses anything under 12 characters. */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { first: now, n: 1 });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_ATTEMPTS;
}

function clientKey(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    // Lets admin.html decide whether to show the login form or the dashboard
    // without leaking whether a username exists.
    res.status(200).json({ configured: adminConfigured(), authenticated: hasValidSession(req) });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  if (!adminConfigured()) {
    res.status(503).json({ error: "admin is not configured on this deployment" });
    return;
  }

  if (tooManyAttempts(clientKey(req))) {
    res.status(429).json({ error: "too many attempts — wait 15 minutes" });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    res.status(400).json({ error: "bad request" });
    return;
  }

  if (!checkCredentials(body.user, body.password)) {
    // One message for both wrong-username and wrong-password: saying which was
    // wrong tells an attacker half the answer.
    res.status(401).json({ error: "wrong username or password" });
    return;
  }

  attempts.delete(clientKey(req));
  issueSession(res);
  res.status(200).json({ ok: true });
}
