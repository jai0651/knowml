import { NextResponse } from "next/server";
import { buildIndex } from "@/lib/search";

/* Prerendered at build time, so the modal fetches a static file rather than
   hitting a function. The index is a few hundred kilobytes and is loaded on
   first open, not on page load. */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildIndex());
}
