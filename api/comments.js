import { getSql, isValidPageId, setCors } from "./_db.js";

const MAX_NAME = 60;
const MAX_BODY = 2000;
const MAX_ANCHOR = 400;

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
      const rows = await sql`
        SELECT id, author_name, body, anchor_text, anchor_occurrence, created_at
        FROM comments
        WHERE page_id = ${pageId}
        ORDER BY created_at ASC
        LIMIT 500
      `;
      res.status(200).json({
        pageId,
        comments: rows.map((r) => ({
          id: r.id,
          authorName: r.author_name,
          body: r.body,
          anchorText: r.anchor_text,
          anchorOccurrence: r.anchor_occurrence,
          createdAt: r.created_at,
        })),
      });
      return;
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const pageId = body.pageId;
      const authorName = (body.authorName || "").toString().trim().slice(0, MAX_NAME);
      const commentBody = (body.body || "").toString().trim().slice(0, MAX_BODY);
      const anchorTextRaw = (body.anchorText || "").toString().trim().slice(0, MAX_ANCHOR);
      const anchorText = anchorTextRaw || null;
      const anchorOccurrence = anchorText && Number.isInteger(body.anchorOccurrence) ? body.anchorOccurrence : null;

      if (!isValidPageId(pageId)) {
        res.status(400).json({ error: "invalid or missing pageId" });
        return;
      }
      if (!authorName) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      if (!commentBody) {
        res.status(400).json({ error: "comment text is required" });
        return;
      }

      const sql = getSql();
      const rows = await sql`
        INSERT INTO comments (page_id, author_name, body, anchor_text, anchor_occurrence)
        VALUES (${pageId}, ${authorName}, ${commentBody}, ${anchorText}, ${anchorOccurrence})
        RETURNING id, author_name, body, anchor_text, anchor_occurrence, created_at
      `;
      const r = rows[0];
      res.status(201).json({
        comment: {
          id: r.id,
          authorName: r.author_name,
          body: r.body,
          anchorText: r.anchor_text,
          anchorOccurrence: r.anchor_occurrence,
          createdAt: r.created_at,
        },
      });
      return;
    }

    res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("comments api error:", err);
    res.status(500).json({ error: "internal error" });
  }
}
