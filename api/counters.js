import { getSql, isValidPageId, setCors } from "./_db.js";

export default async function handler(req, res) {
  setCors(res);

  try {
    if (req.method === "GET") {
      const pageId = req.query?.pageId;
      if (!isValidPageId(pageId)) {
        res.status(400).json({ error: "invalid or missing pageId" });
        return;
      }
      const sql = getSql();
      const rows = await sql`SELECT views, likes FROM page_counters WHERE page_id = ${pageId}`;
      const row = rows[0] || { views: 0, likes: 0 };
      res.status(200).json({ pageId, views: Number(row.views), likes: Number(row.likes) });
      return;
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { pageId, action } = body;
      if (!isValidPageId(pageId)) {
        res.status(400).json({ error: "invalid or missing pageId" });
        return;
      }
      if (!["view", "like", "unlike"].includes(action)) {
        res.status(400).json({ error: "action must be view, like, or unlike" });
        return;
      }

      const sql = getSql();
      let rows;
      if (action === "view") {
        rows = await sql`
          INSERT INTO page_counters (page_id, views, likes)
          VALUES (${pageId}, 1, 0)
          ON CONFLICT (page_id) DO UPDATE SET views = page_counters.views + 1
          RETURNING views, likes
        `;
      } else if (action === "like") {
        rows = await sql`
          INSERT INTO page_counters (page_id, views, likes)
          VALUES (${pageId}, 0, 1)
          ON CONFLICT (page_id) DO UPDATE SET likes = page_counters.likes + 1
          RETURNING views, likes
        `;
      } else {
        rows = await sql`
          INSERT INTO page_counters (page_id, views, likes)
          VALUES (${pageId}, 0, 0)
          ON CONFLICT (page_id) DO UPDATE SET likes = GREATEST(page_counters.likes - 1, 0)
          RETURNING views, likes
        `;
      }
      const row = rows[0];
      res.status(200).json({ pageId, views: Number(row.views), likes: Number(row.likes) });
      return;
    }

    res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("counters api error:", err);
    res.status(500).json({ error: "internal error" });
  }
}
