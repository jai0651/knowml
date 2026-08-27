import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// neon() tagged-template client doesn't run multi-statement raw SQL directly;
// split on semicolons at statement boundaries (fine for this simple DDL file).
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  console.log("Running:", stmt.slice(0, 60).replace(/\s+/g, " "), "...");
  await sql.query(stmt);
}

console.log("Schema applied.");
