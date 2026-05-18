/**
 * Static migration assertions: guarantees that the migration files on disk
 * declare every table, column, and storage bucket the upload + link-lookup
 * code paths depend on. Runs before any upload starts in CI so missing
 * migrations fail loud instead of corrupting runtime state.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function loadAllMigrationSql(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length, "expected migration files on disk").toBeGreaterThan(0);
  return files
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n\n")
    .toLowerCase();
}

const sql = loadAllMigrationSql();

function hasTable(name: string): boolean {
  const re = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${name}\\b`, "i");
  return re.test(sql);
}

function hasColumn(table: string, column: string): boolean {
  // Either declared in CREATE TABLE body or added via ALTER TABLE ... ADD COLUMN
  const addCol = new RegExp(
    `alter\\s+table\\s+(public\\.)?${table}\\s+add\\s+column\\s+(if\\s+not\\s+exists\\s+)?${column}\\b`,
    "i",
  );
  if (addCol.test(sql)) return true;
  // Crude CREATE TABLE body scan
  const createRe = new RegExp(
    `create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${table}\\s*\\(([\\s\\S]*?)\\);`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql)) !== null) {
    if (new RegExp(`(^|[,\\(\\s])${column}\\s`, "i").test(m[3])) return true;
  }
  return false;
}

function hasBucket(id: string): boolean {
  const re = new RegExp(
    `insert\\s+into\\s+storage\\.buckets[^;]*values[^;]*'${id}'`,
    "i",
  );
  return re.test(sql);
}

describe("migration schema: upload + link-lookup prerequisites", () => {
  const REQUIRED_TABLES = [
    "games",
    "library",
    "wallets",
    "profiles",
    "user_roles",
    "download_logs",
    "upload_audit_log",
    "app_settings",
  ];

  it.each(REQUIRED_TABLES)("table %s is created by some migration", (t) => {
    expect(hasTable(t), `missing CREATE TABLE for ${t}`).toBe(true);
  });

  const REQUIRED_COLUMNS: Array<[string, string]> = [
    ["games", "id"],
    ["games", "file_path"],
    ["games", "file_size_bytes"],
    ["games", "storage_provider"],
    ["games", "visible"],
    ["upload_audit_log", "user_id"],
    ["upload_audit_log", "game_id"],
    ["upload_audit_log", "event_type"],
    ["upload_audit_log", "offset_bytes"],
    ["download_logs", "user_id"],
    ["download_logs", "game_id"],
    ["download_logs", "file_path"],
    ["download_logs", "url"],
  ];

  it.each(REQUIRED_COLUMNS)("column %s.%s exists", (t, c) => {
    expect(hasColumn(t, c), `missing column ${t}.${c}`).toBe(true);
  });

  const REQUIRED_BUCKETS = ["game-files", "game-images"];

  it.each(REQUIRED_BUCKETS)("storage bucket %s is provisioned", (id) => {
    expect(hasBucket(id), `missing storage bucket ${id}`).toBe(true);
  });

  it("has_role security-definer function is defined", () => {
    expect(/create\s+(or\s+replace\s+)?function\s+(public\.)?has_role\s*\(/i.test(sql)).toBe(true);
  });
});
