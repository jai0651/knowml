import { NextResponse } from "next/server";
import {
  adminConfigured,
  checkCredentials,
  issueSession,
  hasValidSession,
  clientIp,
} from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* A crude in-memory throttle. Instances are reused, so in practice this
   catches a burst from one address; it is not a distributed rate limiter. The
   real defence is scrypt plus a long password. */
const attempts = new Map<string, { first: number; n: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { first: now, n: 1 });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_ATTEMPTS;
}

const clientKey = (req: Request) => clientIp(req) || "unknown";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET(req: Request) {
  // Lets admin.html decide between the login form and the dashboard without
  // leaking whether a username exists.
  return json({ configured: adminConfigured(), authenticated: hasValidSession(req) });
}

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return json({ error: "admin is not configured on this deployment" }, 503);
  }
  if (tooManyAttempts(clientKey(req))) {
    return json({ error: "too many attempts — wait 15 minutes" }, 429);
  }

  let body: { user?: unknown; password?: unknown } = {};
  try {
    const text = await req.text();
    body = (text ? JSON.parse(text) : {}) || {};
  } catch {
    return json({ error: "bad request" }, 400);
  }

  if (!checkCredentials(body.user, body.password)) {
    // One message for both wrong username and wrong password.
    return json({ error: "wrong username or password" }, 401);
  }

  attempts.delete(clientKey(req));
  const res = json({ ok: true });
  issueSession(res);
  return res;
}
