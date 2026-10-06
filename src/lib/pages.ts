import crypto from "node:crypto";
import { kv } from "./store";
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

const pageKey = (id: string) => `page:${id}`;
const indexKey = (locationId: string) => `pages:${locationId}`;
const subsKey = (id: string) => `subs:${id}`;

export function newId(len = 14): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function listPages(locationId: string) {
  const ids = (await kv().get<string[]>(indexKey(locationId))) ?? [];
  const pages = await Promise.all(ids.map((id) => kv().get<PageDoc>(pageKey(id))));
  return pages
    .filter((p): p is PageDoc => !!p)
    .map(({ draft: _d, published, ...rest }) => ({
      ...rest,
      publishedAt: published?.publishedAt ?? null,
      hasUnpublishedChanges: !published || rest.updatedAt > published.publishedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPage(id: string): Promise<PageDoc | null> {
  return kv().get<PageDoc>(pageKey(id));
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
  await kv().set(pageKey(page.id), page);
  const ids = (await kv().get<string[]>(indexKey(locationId))) ?? [];
  await kv().set(indexKey(locationId), [page.id, ...ids]);
  return page;
}

export async function savePage(page: PageDoc) {
  await kv().set(pageKey(page.id), page);
}

export async function deletePage(page: PageDoc) {
  await kv().del(pageKey(page.id));
  await kv().del(subsKey(page.id));
  const ids = (await kv().get<string[]>(indexKey(page.locationId))) ?? [];
  await kv().set(
    indexKey(page.locationId),
    ids.filter((i) => i !== page.id),
  );
}

export async function listSubmissions(pageId: string): Promise<Submission[]> {
  return (await kv().get<Submission[]>(subsKey(pageId))) ?? [];
}

export async function addSubmission(pageId: string, sub: Submission) {
  const subs = await listSubmissions(pageId);
  await kv().set(subsKey(pageId), [sub, ...subs].slice(0, 200));
}
