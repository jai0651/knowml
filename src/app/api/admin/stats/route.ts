import { NextResponse } from "next/server";
import { getSql, hasDb } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Everything the dashboard shows, in one round trip. Ported from
 * api/admin/stats.js.
 *
 * `days` bounds every query. Unique visitors are COUNT(DISTINCT visitor) over
 * the per-day rotating hash, so the number means "distinct people per day,
 * summed", not "distinct people over the period". */

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) {
    denied.headers.set("Cache-Control", "no-store");
    return denied;
  }

  const raw = new URL(req.url).searchParams.get("days");
  const days = Math.min(Math.max(parseInt(raw ?? "", 10) || 30, 1), 365);

  if (!hasDb()) return json({ error: "database not configured" }, 503);

  try {
    const sql = getSql();

    const [totals, daily, pages, countries, referrers, recent, counters] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::bigint                                   AS views,
          COUNT(DISTINCT visitor)::bigint                    AS visitors,
          COUNT(DISTINCT page_id)::bigint                    AS pages,
          COUNT(*) FILTER (WHERE ts > now() - interval '24 hours')::bigint AS views_24h,
          COUNT(DISTINCT visitor) FILTER (WHERE ts > now() - interval '24 hours')::bigint AS visitors_24h
        FROM page_views
        WHERE ts > now() - (${days} || ' days')::interval
      `,
      sql`
        SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day,
               COUNT(*)::bigint                             AS views,
               COUNT(DISTINCT visitor)::bigint              AS visitors
        FROM page_views
        WHERE ts > now() - (${days} || ' days')::interval
        GROUP BY 1 ORDER BY 1
      `,
      sql`
        SELECT page_id,
               COUNT(*)::bigint                AS views,
               COUNT(DISTINCT visitor)::bigint AS visitors
        FROM page_views
        WHERE ts > now() - (${days} || ' days')::interval
        GROUP BY 1 ORDER BY views DESC LIMIT 40
      `,
      sql`
        SELECT COALESCE(country, '??') AS country,
               COUNT(*)::bigint                AS views,
               COUNT(DISTINCT visitor)::bigint AS visitors
        FROM page_views
        WHERE ts > now() - (${days} || ' days')::interval
        GROUP BY 1 ORDER BY views DESC LIMIT 30
      `,
      sql`
        SELECT referrer, COUNT(*)::bigint AS views
        FROM page_views
        WHERE ts > now() - (${days} || ' days')::interval AND referrer IS NOT NULL
        GROUP BY 1 ORDER BY views DESC LIMIT 25
      `,
      sql`
        SELECT page_id, country, referrer, to_char(ts, 'YYYY-MM-DD HH24:MI') AS ts
        FROM page_views ORDER BY ts DESC LIMIT 30
      `,
      // All-time totals live in the counters table and predate this one, so
      // they are shown separately rather than being mixed into the window.
      sql`SELECT COALESCE(SUM(views),0)::bigint AS views, COALESCE(SUM(likes),0)::bigint AS likes FROM page_counters`,
    ]);

    const n = (v: unknown) => Number(v || 0);
    return json({
      days,
      totals: {
        views: n(totals[0]?.views),
        visitors: n(totals[0]?.visitors),
        pages: n(totals[0]?.pages),
        views24h: n(totals[0]?.views_24h),
        visitors24h: n(totals[0]?.visitors_24h),
      },
      allTime: { views: n(counters[0]?.views), likes: n(counters[0]?.likes) },
      daily: daily.map((r) => ({ day: r.day, views: n(r.views), visitors: n(r.visitors) })),
      pages: pages.map((r) => ({ pageId: r.page_id, views: n(r.views), visitors: n(r.visitors) })),
      countries: countries.map((r) => ({ country: r.country, views: n(r.views), visitors: n(r.visitors) })),
      referrers: referrers.map((r) => ({ referrer: r.referrer, views: n(r.views) })),
      recent: recent.map((r) => ({ pageId: r.page_id, country: r.country, referrer: r.referrer, ts: r.ts })),
    });
  } catch (err) {
    console.error("admin stats error:", err);
    return json({ error: "internal error" }, 500);
  }
}
