import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { config } from "./config.js";

const databaseUrl = config.databaseUrl;
let pool: pg.Pool | undefined;
let localDb: PGlite | undefined;
let ready: Promise<void> | undefined;

export type SqlRow = Record<string, unknown>;

export async function ensureDb(): Promise<void> {
  ready ??= initDb();
  await ready;
}

async function initDb(): Promise<void> {
  if (databaseUrl !== "") {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 8 });
    const client = await pool.connect();
    try {
      await runMigrations({
        exec: async (q) => {
          await client.query(q);
        },
        query: async <T extends SqlRow>(text: string, params: unknown[] = []) =>
          (await client.query(text, params)).rows as T[],
      });
    } finally {
      client.release();
    }
    return;
  }

  if (config.dataDir === ":memory:") {
    localDb = new PGlite();
  } else {
    await mkdir(config.dataDir, { recursive: true });
    localDb = new PGlite(config.dataDir);
  }
  await runMigrations({
    exec: async (q) => {
      await localDb!.exec(q);
    },
    query: async <T extends SqlRow>(text: string, params: unknown[] = []) =>
      (await localDb!.query<T>(text, params)).rows,
  });
}

type Runner = {
  exec: (query: string) => Promise<void>;
  query: <T extends SqlRow>(text: string, params?: unknown[]) => Promise<T[]>;
};

async function runMigrations(runner: Runner): Promise<void> {
  await runner.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await readdir(config.migrationsDir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const existing = await runner.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations WHERE filename = $1",
      [file],
    );
    if (existing.length > 0) continue;
    const body = await readFile(join(config.migrationsDir, file), "utf8");
    await runner.exec(body);
    await runner.exec(
      `INSERT INTO schema_migrations (filename) VALUES ('${file.replace(/'/g, "''")}');`,
    );
  }
}

export async function sql<T extends SqlRow = SqlRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureDb();
  if (pool) {
    return (await pool.query(text, params)).rows as T[];
  }
  return (await localDb!.query<T>(text, params)).rows;
}

export async function sqlOne<T extends SqlRow = SqlRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await sql<T>(text, params);
  return rows[0] ?? null;
}

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
  if (localDb) await localDb.close();
}
