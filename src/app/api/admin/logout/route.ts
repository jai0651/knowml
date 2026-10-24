import { NextResponse } from "next/server";
import { clearSession } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The old handler cleared the cookie for any method; POST is what admin.js sends.
async function handle() {
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}

export const POST = handle;
export const GET = handle;
