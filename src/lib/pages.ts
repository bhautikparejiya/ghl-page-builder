import crypto from "node:crypto";
import { num, query } from "./db";
import { DEFAULT_THEME, Theme } from "./theme";

export interface FormConfig {
  tags: string[];
  workflowId?: string;
  successMessage?: string;
  redirectUrl?: string;
  /** Create an opportunity for the contact in this pipeline/stage. */
  pipelineId?: string;
  stageId?: string;
  /** Supports {{name}}, {{email}} and {{page}}. */
  opportunityName?: string;
  opportunityValue?: number;
}

export interface PageSettings {
  title: string;
  description: string;
  /** Social share image (og:image). */
  ogImage?: string;
  /** Ask search engines not to index the hosted page. */
  noindex?: boolean;
  /** "inline" renders embeds without Shadow DOM, so the funnel's fonts and SEO tools see the content as regular page HTML. */
  embedMode?: "shadow" | "inline";
}

export interface PageDoc {
  id: string;
  locationId: string;
  companyId?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: PageSettings;
  theme: Theme;
  draft: { projectData: unknown | null; html: string; css: string };
  published?: {
    html: string;
    css: string;
    theme: Theme;
    forms: Record<string, FormConfig>;
    publishedAt: number;
    version: number;
    /** Google fonts used by widgets (in addition to the brand kit fonts). */
    fonts?: string[];
    /** Runtime modules the page needs (interactive widgets). */
    modules?: string[];
    /** Structured data (JSON-LD) for the hosted page, e.g. FAQ markup. */
    jsonLd?: string;
  };
}

export interface Submission {
  at: number;
  formId: string;
  fields: Record<string, string>;
  contactId?: string;
  error?: string;
}

interface PageRow {
  id: string;
  location_id: string;
  company_id: string | null;
  name: string;
  created_at: unknown;
  updated_at: unknown;
  settings: PageDoc["settings"];
  theme: Theme;
  draft: PageDoc["draft"];
  published: PageDoc["published"] | null;
}

function fromRow(r: PageRow): PageDoc {
  return {
    id: r.id,
    locationId: r.location_id,
    companyId: r.company_id ?? undefined,
    name: r.name,
    createdAt: num(r.created_at),
    updatedAt: num(r.updated_at),
    settings: r.settings,
    theme: r.theme,
    draft: r.draft,
    published: r.published ?? undefined,
  };
}

const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

export function newId(len = 14): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function listPages(locationId: string) {
  // Only lightweight columns — drafts can be large.
  const rows = await query<{ id: string; name: string; created_at: unknown; updated_at: unknown; published_at: unknown }>(
    `SELECT id, name, created_at, updated_at, (published->>'publishedAt')::bigint AS published_at
       FROM pages WHERE location_id = $1 ORDER BY updated_at DESC`,
    [locationId],
  );
  return rows.map((r) => {
    const updatedAt = num(r.updated_at);
    const publishedAt = r.published_at == null ? null : num(r.published_at);
    return {
      id: r.id,
      locationId,
      name: r.name,
      createdAt: num(r.created_at),
      updatedAt,
      publishedAt,
      hasUnpublishedChanges: publishedAt == null || updatedAt > publishedAt,
    };
  });
}

export async function getPage(id: string): Promise<PageDoc | null> {
  const rows = await query<PageRow>("SELECT * FROM pages WHERE id = $1", [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createPage(
  locationId: string,
  init: { name: string; html?: string; css?: string; theme?: Theme; projectData?: unknown; companyId?: string },
): Promise<PageDoc> {
  const now = Date.now();
  const page: PageDoc = {
    id: newId(),
    locationId,
    companyId: init.companyId,
    name: init.name || "Untitled page",
    createdAt: now,
    updatedAt: now,
    settings: { title: init.name || "", description: "" },
    theme: init.theme ?? { ...DEFAULT_THEME, useKit: true },
    draft: { projectData: init.projectData ?? null, html: init.html ?? "", css: init.css ?? "" },
  };
  await query(
    `INSERT INTO pages (id, location_id, company_id, name, created_at, updated_at, settings, theme, draft, published)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, NULL)`,
    [page.id, locationId, init.companyId ?? null, page.name, now, now, json(page.settings), json(page.theme), json(page.draft)],
  );
  return page;
}

export async function savePage(page: PageDoc) {
  await query(
    `UPDATE pages SET name = $2, updated_at = $3, settings = $4::jsonb, theme = $5::jsonb, draft = $6::jsonb, published = $7::jsonb,
            company_id = COALESCE($8, company_id)
      WHERE id = $1`,
    [page.id, page.name, page.updatedAt, json(page.settings), json(page.theme), json(page.draft), json(page.published), page.companyId ?? null],
  );
}

export async function deletePage(page: PageDoc) {
  await query("DELETE FROM pages WHERE id = $1", [page.id]); // submissions cascade
}

export type RevisionKind = "publish" | "autosave" | "restore";

export interface RevisionSummary {
  id: number;
  at: number;
  kind: RevisionKind;
  version: number | null;
}

/** Revisions kept per page; older ones are pruned on insert. */
const MAX_REVISIONS = 50;
/** Minimum gap between automatic draft snapshots. */
export const AUTOSAVE_SNAPSHOT_MS = 30 * 60 * 1000;

export async function addRevision(page: PageDoc, kind: RevisionKind, version?: number) {
  await query(
    "INSERT INTO page_revisions (page_id, at, kind, version, doc) VALUES ($1, $2, $3, $4, $5::jsonb)",
    [page.id, Date.now(), kind, version ?? null, json({ draft: page.draft, theme: page.theme })],
  );
  await query(
    `DELETE FROM page_revisions WHERE page_id = $1 AND id NOT IN
       (SELECT id FROM page_revisions WHERE page_id = $1 ORDER BY at DESC LIMIT ${MAX_REVISIONS})`,
    [page.id],
  );
}

export async function lastRevisionAt(pageId: string, kind: RevisionKind): Promise<number | null> {
  const rows = await query<{ at: unknown }>(
    "SELECT at FROM page_revisions WHERE page_id = $1 AND kind = $2 ORDER BY at DESC LIMIT 1",
    [pageId, kind],
  );
  return rows[0] ? num(rows[0].at) : null;
}

export async function listRevisions(pageId: string): Promise<RevisionSummary[]> {
  const rows = await query<{ id: unknown; at: unknown; kind: RevisionKind; version: unknown }>(
    "SELECT id, at, kind, version FROM page_revisions WHERE page_id = $1 ORDER BY at DESC",
    [pageId],
  );
  return rows.map((r) => ({ id: num(r.id), at: num(r.at), kind: r.kind, version: r.version == null ? null : num(r.version) }));
}

export async function getRevisionDoc(pageId: string, id: number) {
  const rows = await query<{ doc: { draft: PageDoc["draft"]; theme: Theme } }>(
    "SELECT doc FROM page_revisions WHERE page_id = $1 AND id = $2",
    [pageId, id],
  );
  return rows[0]?.doc ?? null;
}

export async function listSubmissions(pageId: string, limit = 200): Promise<Submission[]> {
  const rows = await query<{ at: unknown; form_id: string; fields: Record<string, string>; contact_id: string | null; error: string | null }>(
    "SELECT at, form_id, fields, contact_id, error FROM submissions WHERE page_id = $1 ORDER BY at DESC LIMIT $2",
    [pageId, limit],
  );
  return rows.map((r) => ({
    at: num(r.at),
    formId: r.form_id,
    fields: r.fields,
    contactId: r.contact_id ?? undefined,
    error: r.error ?? undefined,
  }));
}

export async function addSubmission(pageId: string, sub: Submission) {
  await query(
    "INSERT INTO submissions (page_id, at, form_id, fields, contact_id, error) VALUES ($1, $2, $3, $4::jsonb, $5, $6)",
    [pageId, sub.at, sub.formId, json(sub.fields), sub.contactId ?? null, sub.error ?? null],
  );
}
