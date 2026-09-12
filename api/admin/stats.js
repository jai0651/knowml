import { getSql } from "../_db.js";
import { requireAdmin } from "../_admin.js";

/* Everything the dashboard shows, in one round trip.
 *
 * `days` bounds every query. Unique visitors are counted with
 * COUNT(DISTINCT visitor) over the per-day rotating hash, so the number means
 * "distinct people per day, summed" rather than "distinct people over the
 * period" — those differ, and the dashboard says which it is showing rather
 * than letting the reader assume the flattering one. */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (!requireAdmin(req, res)) return;

  const days = Math.min(Math.max(parseInt(req.query?.days, 10) || 30, 1), 365);

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

    const n = (v) => Number(v || 0);
    res.status(200).json({
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
    res.status(500).json({ error: "internal error" });
  }
}
