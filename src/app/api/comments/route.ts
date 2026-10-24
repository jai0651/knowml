import { NextResponse } from "next/server";
import { getSql, hasDb, isValidPageId } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Page comments. Ported from api/comments.js. Without DATABASE_URL, GET
   answers an empty list with `disabled: true` and POST answers 503. */

const MAX_NAME = 60;
const MAX_BODY = 2000;
const MAX_ANCHOR = 400;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

type Row = {
  id: unknown;
  author_name: string;
  body: string;
  anchor_text: string | null;
  anchor_occurrence: number | null;
  created_at: unknown;
};

const shape = (r: Row) => ({
  id: r.id,
  authorName: r.author_name,
  body: r.body,
  anchorText: r.anchor_text,
  anchorOccurrence: r.anchor_occurrence,
  createdAt: r.created_at,
});

export async function GET(req: Request) {
  try {
    const pageId = new URL(req.url).searchParams.get("pageId");
    if (!isValidPageId(pageId)) return json({ error: "invalid or missing pageId" }, 400);
    if (!hasDb()) return json({ pageId, comments: [], disabled: true });

    const sql = getSql();
    const rows = await sql`
      SELECT id, author_name, body, anchor_text, anchor_occurrence, created_at
      FROM comments
      WHERE page_id = ${pageId}
      ORDER BY created_at ASC
      LIMIT 500
    `;
    return json({ pageId, comments: rows.map((r) => shape(r as Row)) });
  } catch (err) {
    console.error("comments api error:", err);
    return json({ error: "internal error" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const body = (text ? JSON.parse(text) : {}) || {};
    const pageId = body.pageId;
    const authorName = (body.authorName || "").toString().trim().slice(0, MAX_NAME);
    const commentBody = (body.body || "").toString().trim().slice(0, MAX_BODY);
    const anchorTextRaw = (body.anchorText || "").toString().trim().slice(0, MAX_ANCHOR);
    const anchorText = anchorTextRaw || null;
    const anchorOccurrence =
      anchorText && Number.isInteger(body.anchorOccurrence) ? body.anchorOccurrence : null;

    if (!isValidPageId(pageId)) return json({ error: "invalid or missing pageId" }, 400);
    if (!authorName) return json({ error: "name is required" }, 400);
    if (!commentBody) return json({ error: "comment text is required" }, 400);
    if (!hasDb()) return json({ error: "comments are unavailable: database not configured" }, 503);

    const sql = getSql();
    const rows = await sql`
      INSERT INTO comments (page_id, author_name, body, anchor_text, anchor_occurrence)
      VALUES (${pageId}, ${authorName}, ${commentBody}, ${anchorText}, ${anchorOccurrence})
      RETURNING id, author_name, body, anchor_text, anchor_occurrence, created_at
    `;
    return json({ comment: shape(rows[0] as Row) }, 201);
  } catch (err) {
    console.error("comments api error:", err);
    return json({ error: "internal error" }, 500);
  }
}
