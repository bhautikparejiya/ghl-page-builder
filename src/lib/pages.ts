import crypto from "node:crypto";
import { num, query } from "./db";
import { DEFAULT_THEME, Theme } from "./theme";

export interface FormConfig {
  tags: string[];
  workflowId?: string;
  successMessage?: string;
  redirectUrl?: string;
}

export interface PageDoc {
  id: string;
  locationId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: { title: string; description: string };
  theme: Theme;
  draft: { projectData: unknown | null; html: string; css: string };
  published?: {
    html: string;
    css: string;
    theme: Theme;
    forms: Record<string, FormConfig>;
    publishedAt: number;
    version: number;
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
  init: { name: string; html?: string; css?: string; theme?: Theme; projectData?: unknown },
): Promise<PageDoc> {
  const now = Date.now();
  const page: PageDoc = {
    id: newId(),
    locationId,
    name: init.name || "Untitled page",
    createdAt: now,
    updatedAt: now,
    settings: { title: init.name || "", description: "" },
    theme: init.theme ?? { ...DEFAULT_THEME },
    draft: { projectData: init.projectData ?? null, html: init.html ?? "", css: init.css ?? "" },
  };
  await query(
    `INSERT INTO pages (id, location_id, name, created_at, updated_at, settings, theme, draft, published)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, NULL)`,
    [page.id, locationId, page.name, now, now, json(page.settings), json(page.theme), json(page.draft)],
  );
  return page;
}

export async function savePage(page: PageDoc) {
  await query(
    `UPDATE pages SET name = $2, updated_at = $3, settings = $4::jsonb, theme = $5::jsonb, draft = $6::jsonb, published = $7::jsonb
      WHERE id = $1`,
    [page.id, page.name, page.updatedAt, json(page.settings), json(page.theme), json(page.draft), json(page.published)],
  );
}

export async function deletePage(page: PageDoc) {
  await query("DELETE FROM pages WHERE id = $1", [page.id]); // submissions cascade
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
