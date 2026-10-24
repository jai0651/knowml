import { NextResponse } from "next/server";
import { getSql, hasDb, isValidPageId, NS } from "@/lib/db";
import { visitorHash, referrerHost, countryOf } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Per-page view and like counters. Ported from api/counters.js.
 *
 * Nothing identifying is stored in page_counters. A like is held in the
 * reader's own localStorage, so the server only sees an increment or a
 * decrement. Without DATABASE_URL the endpoint answers zeros with
 * `disabled: true` instead of failing. */

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET(req: Request) {
  try {
    const pageId = new URL(req.url).searchParams.get("pageId");
    if (!isValidPageId(pageId)) return json({ error: "invalid or missing pageId" }, 400);
    if (!hasDb()) return json({ pageId, views: 0, likes: 0, disabled: true });

    const sql = getSql();
    const rows = await sql`SELECT views, likes FROM page_counters WHERE page_id = ${NS + pageId}`;
    const row = rows[0] || { views: 0, likes: 0 };
    return json({ pageId, views: Number(row.views), likes: Number(row.likes) });
  } catch (err) {
    console.error("counters api error:", err);
    return json({ error: "internal error" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const body = (text ? JSON.parse(text) : {}) || {};
    const { pageId, action } = body;
    if (!isValidPageId(pageId)) return json({ error: "invalid or missing pageId" }, 400);
    if (!["view", "like", "unlike"].includes(action)) {
      return json({ error: "action must be view, like, or unlike" }, 400);
    }
    if (!hasDb()) return json({ pageId, views: 0, likes: 0, disabled: true });

    const id = NS + pageId;
    const sql = getSql();
    let rows;
    if (action === "view") {
      rows = await sql`
        INSERT INTO page_counters (page_id, views, likes)
        VALUES (${id}, 1, 0)
        ON CONFLICT (page_id) DO UPDATE SET views = page_counters.views + 1
        RETURNING views, likes
      `;
      // Record the event for the admin dashboard. Analytics must never be the
      // reason a reader's counter fails to render, so errors are swallowed.
      try {
        await sql`
          INSERT INTO page_views (page_id, country, referrer, visitor)
          VALUES (${pageId}, ${countryOf(req)}, ${referrerHost(req)}, ${visitorHash(req)})
        `;
      } catch (e) {
        console.error("page_views insert failed (counter still served):", (e as Error).message);
      }
    } else if (action === "like") {
      rows = await sql`
        INSERT INTO page_counters (page_id, views, likes)
        VALUES (${id}, 0, 1)
        ON CONFLICT (page_id) DO UPDATE SET likes = page_counters.likes + 1
        RETURNING views, likes
      `;
    } else {
      rows = await sql`
        INSERT INTO page_counters (page_id, views, likes)
        VALUES (${id}, 0, 0)
        ON CONFLICT (page_id) DO UPDATE SET likes = GREATEST(page_counters.likes - 1, 0)
        RETURNING views, likes
      `;
    }
    const row = rows[0];
    return json({ pageId, views: Number(row.views), likes: Number(row.likes) });
  } catch (err) {
    console.error("counters api error:", err);
    return json({ error: "internal error" }, 500);
  }
}
