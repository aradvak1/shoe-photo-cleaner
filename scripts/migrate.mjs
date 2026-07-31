import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || "../supabase/migration.sql";
const sql = readFileSync(path.join(__dirname, target), "utf8");

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING,
});

await client.connect();
try {
  await client.query(sql);
  console.log("Migration applied successfully.");
} finally {
  await client.end();
}
