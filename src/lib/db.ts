import { createHash } from "node:crypto";
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

ALTER TABLE pages ADD COLUMN IF NOT EXISTS company_id TEXT;

-- Brand kits: key 'loc:<locationId>' (sub-account) or 'co:<companyId>' (agency default for its sub-accounts)
CREATE TABLE IF NOT EXISTS brand_kits (
  key        TEXT PRIMARY KEY,
  kit        JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Saved sections, pages and global (linked) sections. owner_type 'location' or 'company' (shared with all sub-accounts).
CREATE TABLE IF NOT EXISTS library_items (
  id          TEXT PRIMARY KEY,
  owner_type  TEXT NOT NULL,
  owner_id    TEXT NOT NULL,
  kind        TEXT NOT NULL,                -- 'section' | 'page'
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  is_global   BOOLEAN NOT NULL DEFAULT FALSE,
  doc         JSONB NOT NULL,               -- { components, html, css, fonts }
  thumbnail   TEXT,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS library_owner_idx ON library_items (owner_type, owner_id, updated_at DESC);

-- A/B test counters per page / test / variant.
CREATE TABLE IF NOT EXISTS ab_stats (
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  test        TEXT NOT NULL,
  variant     TEXT NOT NULL,
  views       BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, test, variant)
);

-- Custom domains for hosted pages (domain + path → page).
CREATE TABLE IF NOT EXISTS domains (
  host        TEXT NOT NULL,
  path        TEXT NOT NULL DEFAULT '/',
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  created_at  BIGINT NOT NULL,
  PRIMARY KEY (host, path)
);
CREATE INDEX IF NOT EXISTS domains_page_idx ON domains (page_id);

-- Cached HighLevel data used when serving pages (location info, custom values).
CREATE TABLE IF NOT EXISTS location_cache (
  location_id TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  fetched_at  BIGINT NOT NULL
);
`;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

/** Changes whenever SCHEMA changes, so migrations only run once per schema version. */
const SCHEMA_VERSION = createHash("sha1").update(SCHEMA).digest("hex").slice(0, 16);
/** Arbitrary constant: the advisory lock that serialises schema migrations across instances. */
const MIGRATION_LOCK = 72_480_311;

/** Deadlock / serialization failures are safe to retry: Postgres rolled the statement back. */
const RETRYABLE = new Set(["40P01", "40001", "55P03"]);
const isRetryable = (err: unknown) => RETRYABLE.has(String((err as { code?: string })?.code ?? ""));

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, 50 * 2 ** i + Math.random() * 100));
    }
  }
}

async function createNeon(): Promise<QueryFn> {
  const sql = neon(databaseUrl!);
  // Fast path: schema already at this version. A plain read takes no locks, so warm-ups never block each other.
  const current = await sql
    .query("SELECT value FROM app_meta WHERE key = 'schema_version'")
    .then((rows) => (rows as Row[])[0]?.value)
    .catch(() => null); // app_meta doesn't exist yet on a fresh database
  if (current !== SCHEMA_VERSION) {
    // Several serverless instances can cold-start at once. DDL such as ALTER TABLE takes exclusive locks, so
    // concurrent migrations would deadlock each other; the advisory lock makes them run one at a time.
    const statements = SCHEMA.split(";").map((s) => s.trim()).filter(Boolean);
    await withRetry(() =>
      sql.transaction([
        sql.query(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`),
        ...statements.map((s) => sql.query(s)),
        sql.query("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
        sql.query(
          "INSERT INTO app_meta (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
          [SCHEMA_VERSION],
        ),
      ]),
    );
  }
  return (text, params = []) => withRetry(() => sql.query(text, params) as Promise<Row[]>);
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
