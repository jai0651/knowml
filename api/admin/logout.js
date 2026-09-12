import { clearSession } from "../_admin.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  clearSession(res);
  res.status(200).json({ ok: true });
}
