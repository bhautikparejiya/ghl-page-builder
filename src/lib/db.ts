import { neon } from "@neondatabase/serverless";

/**
 * Postgres access.
 * - Production (Vercel): Neon serverless driver over HTTP (DATABASE_URL, set by the Vercel ↔ Neon integration)
 * - Local dev without DATABASE_URL: PGlite (embedded Postgres, persisted in ./.data/pg) — same SQL, zero setup
 */
type Row = Record<string, unknown>;
type QueryFn = (text: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS installs (
  key           TEXT PRIMARY KEY,            -- 'loc:<locationId>' or 'co:<companyId>'
  user_type     TEXT NOT NULL,               -- 'Location' | 'Company'
  location_id   TEXT,
  company_id    TEXT,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    BIGINT NOT NULL,             -- ms epoch
  scope         TEXT,
  installed_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL,
  settings    JSONB NOT NULL,
  theme       JSONB NOT NULL,
  draft       JSONB NOT NULL,
  published   JSONB
);
CREATE INDEX IF NOT EXISTS pages_location_idx ON pages (location_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS submissions (
  id         BIGSERIAL PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  at         BIGINT NOT NULL,
  form_id    TEXT,
  fields     JSONB NOT NULL,
  contact_id TEXT,
  error      TEXT
);
CREATE INDEX IF NOT EXISTS submissions_page_idx ON submissions (page_id, at DESC);

CREATE TABLE IF NOT EXISTS page_revisions (
  id         BIGSERIAL PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  at         BIGINT NOT NULL,
  kind       TEXT NOT NULL,                 -- 'publish' | 'autosave' | 'restore'
  version    INT,                           -- published version, for kind = 'publish'
  doc        JSONB NOT NULL                 -- { draft, theme }
);
CREATE INDEX IF NOT EXISTS page_revisions_page_idx ON page_revisions (page_id, at DESC);
`;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function createNeon(): Promise<QueryFn> {
  const sql = neon(databaseUrl!);
  // Idempotent schema setup, sent as a single HTTP round trip on cold start.
  const statements = SCHEMA.split(";").map((s) => s.trim()).filter(Boolean);
  await sql.transaction(statements.map((s) => sql.query(s)));
  return (text, params = []) => sql.query(text, params) as Promise<Row[]>;
}

async function createPglite(): Promise<QueryFn> {
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Neon database to this Vercel project (see README).");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), ".data", "pg");
  // PGlite creates the data dir but not its parent (fresh clones have no .data/).
  await (await import("node:fs/promises")).mkdir(path.dirname(dir), { recursive: true });
  const db = new PGlite(dir);
  await db.exec(SCHEMA);
  return async (text, params = []) => (await db.query<Row>(text, params as unknown[])).rows;
}

// Cache across hot reloads in dev and across invocations of a warm serverless instance.
const g = globalThis as unknown as { __gpbDb?: Promise<QueryFn> };

function db(): Promise<QueryFn> {
  if (!g.__gpbDb) {
    g.__gpbDb = (databaseUrl ? createNeon() : createPglite()).catch((err) => {
      g.__gpbDb = undefined; // allow retry on next request
      throw err;
    });
  }
  return g.__gpbDb;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await db())(text, params)) as T[];
}

/** BIGINT columns come back as strings (Neon) or bigint (PGlite) — normalise to number. */
export const num = (v: unknown): number => (v == null ? 0 : Number(v));
