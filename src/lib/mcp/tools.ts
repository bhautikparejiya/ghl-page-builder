/**
 * Tools the PageForge MCP server offers to AI assistants. Every tool acts on the one sub-account
 * the API key belongs to.
 */
import { BLUEPRINTS, type Node, SECTIONS } from "../blueprints";
import { config } from "../config";
import { getKit } from "../kits";
import { canRead, createLibraryItem, getLibraryItem, type LibraryKind, listLibrary, updateLibraryItem } from "../library";
import { addRevision, createPage, getPage, listPages, type PageDoc, savePage } from "../pages";
import { getSiteSettings, saveSiteSettings } from "../site";
import { BRAND_PATHS, ICON_PATHS } from "../widgets/icon-data";
import {
  bodyComponents,
  buildTree,
  normalizeTree,
  projectDataFor,
  publishExtras,
  readTree,
  STRUCTURE_GUIDE,
  TreeError,
  VALUE_FORMATS,
  widgetDetails,
  widgetSummary,
  type WidgetNode,
} from "./tree";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ToolError extends Error {}

/** Who the tools act for: the sub-account of an API key or an OAuth-connected app. */
export interface Principal {
  locationId: string;
  companyId?: string;
}

type Args = Record<string, any>;

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Args, key: Principal) => Promise<unknown>;
}

const NODES_SCHEMA = {
  type: "array",
  description:
    "Widget tree. Each node: { type, settings?, children? }, or { blueprint: '<section id>' }, or { type: 'global_section', libraryId }. Read get_builder_guide first.",
  items: { type: "object", additionalProperties: true },
};

const pagesOrigin = () => config.pagesUrl || config.appUrl;
const liveUrl = (id: string) => `${pagesOrigin()}/p/${id}`;

function pageStatus(p: { published?: unknown; publishedAt?: number | null; updatedAt: number }) {
  const at = p.publishedAt ?? (p.published as PageDoc["published"])?.publishedAt ?? null;
  if (!at) return "draft";
  return p.updatedAt > at ? "live_with_unpublished_changes" : "live";
}

async function ownedPage(key: Principal, id: unknown): Promise<PageDoc> {
  const page = typeof id === "string" ? await getPage(id) : null;
  if (!page || page.locationId !== key.locationId) throw new ToolError("Page not found. Use list_pages for valid ids.");
  return page;
}

async function readableItem(key: Principal, id: unknown) {
  const item = typeof id === "string" ? await getLibraryItem(id) : null;
  if (!item || !canRead(item, key.locationId, key.companyId)) throw new ToolError("Template not found. Use list_templates for valid ids.");
  return item;
}

function tree(nodes: unknown, topLevel = true) {
  try {
    return normalizeTree(nodes, { topLevel });
  } catch (e) {
    if (e instanceof TreeError) throw new ToolError(e.message);
    throw e;
  }
}

const blueprintNodes = (nodes: Node[]): WidgetNode[] =>
  nodes.map((n) => ({ type: n.type, settings: n.s, ...(n.c ? { children: blueprintNodes(n.c) } : {}) }));

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Applies the page-level fields an AI may set (name, SEO, custom code, header/footer visibility). */
function applyPageFields(page: PageDoc, a: Args) {
  if (typeof a.name === "string" && a.name.trim()) page.name = a.name.trim().slice(0, 120);
  const st = page.settings;
  const set = <K extends keyof PageDoc["settings"]>(k: K, v: PageDoc["settings"][K] | undefined) => {
    if (v !== undefined) st[k] = v;
  };
  set("title", text(a.title, 200));
  set("description", text(a.description, 500));
  set("ogImage", text(a.ogImage, 1000));
  set("customCss", text(a.customCss, 100_000));
  set("headCode", text(a.headCode, 100_000));
  set("bodyCode", text(a.bodyCode, 100_000));
  if (typeof a.hideHeader === "boolean") st.hideHeader = a.hideHeader;
  if (typeof a.hideFooter === "boolean") st.hideFooter = a.hideFooter;
  if (typeof a.noindex === "boolean") st.noindex = a.noindex;
}

const PAGE_FIELDS = {
  title: { type: "string", description: "SEO title (browser tab and search results)." },
  description: { type: "string", description: "SEO meta description." },
  ogImage: { type: "string", description: "Social share image URL." },
  customCss: { type: "string", description: "Custom CSS for this page only." },
  headCode: { type: "string", description: "HTML added to <head> on the hosted page (pixels, meta tags)." },
  bodyCode: { type: "string", description: "HTML/scripts added before </body>." },
  hideHeader: { type: "boolean", description: "Hide the site header on this page." },
  hideFooter: { type: "boolean", description: "Hide the site footer on this page." },
  noindex: { type: "boolean", description: "Ask search engines not to index the hosted page." },
};

function publishNow(page: PageDoc) {
  const extras = publishExtras(bodyComponents(page.draft.projectData));
  const now = Date.now();
  page.updatedAt = now;
  page.published = {
    html: page.draft.html,
    css: page.draft.css,
    theme: page.theme,
    forms: extras.forms,
    fonts: extras.fonts,
    jsonLd: extras.jsonLd,
    publishedAt: now,
    version: (page.published?.version ?? 0) + 1,
  };
}

const pageSummary = (p: PageDoc) => ({
  pageId: p.id,
  name: p.name,
  status: pageStatus(p),
  liveUrl: p.published ? liveUrl(p.id) : null,
});

export const TOOLS: Tool[] = [
  {
    name: "get_builder_guide",
    title: "Get builder guide",
    description:
      "Start here. Explains how PageForge pages are structured (sections, containers, widgets), the setting value formats, the sub-account's brand kit and the list of widgets. Read this before creating or editing pages or templates.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_a, key) => {
      const { kit } = await getKit(key.locationId, key.companyId);
      return {
        structure: STRUCTURE_GUIDE,
        valueFormats: VALUE_FORMATS,
        brandKit: { colors: kit.colors.map((c) => ({ token: `global:${c.id}`, label: c.label, value: c.value })), fonts: kit.fonts, radius: kit.radius, contentWidth: kit.contentWidth },
        widgets: widgetSummary(),
        next: "Call get_widget_reference with the widget types you plan to use to see their settings.",
      };
    },
  },
  {
    name: "get_widget_reference",
    title: "Get widget settings",
    description: "Full settings schema (keys, control types, options, defaults) for the given widget types, e.g. [\"section\", \"container\", \"heading\", \"button\"].",
    inputSchema: {
      type: "object",
      properties: { types: { type: "array", items: { type: "string" }, description: "Widget types from get_builder_guide.", maxItems: 12 } },
      required: ["types"],
    },
    annotations: { readOnlyHint: true },
    run: async (a) => {
      const types = Array.isArray(a.types) ? a.types.map(String).slice(0, 12) : [];
      if (!types.length) throw new ToolError("Pass at least one widget type.");
      return { widgets: widgetDetails(types) };
    },
  },
  {
    name: "list_section_blueprints",
    title: "List section blueprints",
    description: "Ready-made sections (hero, features, pricing, FAQ, lead form, footer…). Use one in a tree as { \"blueprint\": \"<id>\" }, or pass include_nodes to see and adapt its widgets.",
    inputSchema: {
      type: "object",
      properties: { include_nodes: { type: "array", items: { type: "string" }, description: "Blueprint ids whose widget trees to return." } },
    },
    annotations: { readOnlyHint: true },
    run: async (a) => {
      const want = new Set(Array.isArray(a.include_nodes) ? a.include_nodes.map(String) : []);
      return {
        blueprints: Object.entries(SECTIONS).map(([id, b]) => ({
          id,
          label: b.label,
          category: b.category,
          description: b.description,
          ...(want.has(id) ? { nodes: blueprintNodes(b.nodes) } : {}),
        })),
      };
    },
  },
  {
    name: "search_icons",
    title: "Search icons",
    description: "Finds icon names for icon settings. Outline icons are used by name (\"check\"); brand logos as \"brand:<name>\" (\"brand:instagram\").",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    annotations: { readOnlyHint: true },
    run: async (a) => {
      const q = String(a.query ?? "").toLowerCase().trim();
      if (!q) throw new ToolError("Pass a search word.");
      return {
        icons: Object.keys(ICON_PATHS).filter((n) => n.includes(q)).slice(0, 40),
        brands: Object.keys(BRAND_PATHS).filter((n) => n.includes(q)).slice(0, 20).map((n) => `brand:${n}`),
      };
    },
  },
  {
    name: "list_pages",
    title: "List pages",
    description: "Pages in this sub-account with their status (draft, live, live_with_unpublished_changes).",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_a, key) => ({
      pages: (await listPages(key.locationId)).map((p) => ({
        pageId: p.id,
        name: p.name,
        status: pageStatus(p),
        updatedAt: new Date(p.updatedAt).toISOString(),
        liveUrl: p.publishedAt ? liveUrl(p.id) : null,
      })),
    }),
  },
  {
    name: "get_page",
    title: "Get page",
    description: "A page's settings and widget tree. Edit the tree and send it back with update_page.",
    inputSchema: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] },
    annotations: { readOnlyHint: true },
    run: async (a, key) => {
      const page = await ownedPage(key, a.pageId);
      const nodes = readTree(bodyComponents(page.draft.projectData), page.draft.projectData ? "" : page.draft.html);
      return { ...pageSummary(page), settings: page.settings, nodes };
    },
  },
  {
    name: "create_page",
    title: "Create page",
    description:
      "Creates a page from a widget tree (or a built-in template). It is saved as a draft that opens in the PageForge editor; pass publish: true to make it live immediately.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Page name shown in PageForge." },
        nodes: NODES_SCHEMA,
        templateId: { type: "string", description: `Instead of nodes, start from a built-in template: ${BLUEPRINTS.map((b) => b.id).join(", ")}.` },
        publish: { type: "boolean", description: "Publish right away (default false)." },
        ...PAGE_FIELDS,
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: async (a, key) => {
      const bp = typeof a.templateId === "string" ? BLUEPRINTS.find((b) => b.id === a.templateId) : undefined;
      if (a.templateId && !bp) throw new ToolError(`Unknown templateId. Use one of: ${BLUEPRINTS.map((b) => b.id).join(", ")}.`);
      const { nodes, warnings } = tree(bp ? blueprintNodes(bp.nodes) : (a.nodes ?? []));
      const built = buildTree(nodes);
      const page = await createPage(key.locationId, {
        name: String(a.name || "AI page").slice(0, 120),
        projectData: projectDataFor(built.components),
        html: built.html,
        css: built.css,
        companyId: key.companyId,
      });
      page.settings.title = page.name;
      applyPageFields(page, a);
      if (a.publish === true) publishNow(page);
      await savePage(page);
      if (page.published) await addRevision(page, "publish", page.published.version);
      return { ...pageSummary(page), widgets: countNodes(nodes), warnings, next: page.published ? undefined : "Review it in the PageForge editor, or call publish_page." };
    },
  },
  {
    name: "update_page",
    title: "Update page",
    description:
      "Updates a page: name, SEO and custom code fields, and/or its content. `nodes` replaces the whole page body (read it with get_page first and send back the full edited tree). The previous version is kept in the page's revision history. Live pages change only after publish_page.",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string" }, name: { type: "string" }, nodes: NODES_SCHEMA, ...PAGE_FIELDS },
      required: ["pageId"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    run: async (a, key) => {
      const page = await ownedPage(key, a.pageId);
      let warnings: string[] = [];
      let widgets: number | undefined;
      if (a.nodes !== undefined) {
        const t = tree(a.nodes);
        warnings = t.warnings;
        widgets = countNodes(t.nodes);
        // Snapshot first, so the AI's change can be undone from Revision history.
        await addRevision(page, "autosave");
        const built = buildTree(t.nodes);
        page.draft = { projectData: projectDataFor(built.components), html: built.html, css: built.css };
      }
      applyPageFields(page, a);
      page.updatedAt = Date.now();
      await savePage(page);
      return { ...pageSummary(page), ...(widgets !== undefined ? { widgets } : {}), warnings };
    },
  },
  {
    name: "publish_page",
    title: "Publish page",
    description: "Publishes the page's current draft: the hosted link and HighLevel embeds show it (embeds refresh within ~30 seconds).",
    inputSchema: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: async (a, key) => {
      const page = await ownedPage(key, a.pageId);
      if (!page.draft.projectData) {
        // Pages made from a built-in template keep editor markup until first opened; build them here.
        const nodes = readTree(null, page.draft.html);
        if (!nodes.length) throw new ToolError("This page is empty. Add content with update_page first.");
        const built = buildTree(tree(nodes).nodes);
        page.draft = { projectData: projectDataFor(built.components), html: built.html, css: built.css };
      }
      publishNow(page);
      await savePage(page);
      await addRevision(page, "publish", page.published!.version);
      return { ...pageSummary(page), version: page.published!.version };
    },
  },
  {
    name: "unpublish_page",
    title: "Unpublish page",
    description: "Takes a live page offline and back to draft. The draft and revision history are kept.",
    inputSchema: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    run: async (a, key) => {
      const page = await ownedPage(key, a.pageId);
      if (page.published) {
        page.published = undefined;
        page.updatedAt = Date.now();
        await savePage(page);
      }
      return pageSummary(page);
    },
  },
  {
    name: "list_templates",
    title: "List templates",
    description:
      "Saved templates in the library: sections, page templates, site headers and footers (shared agency templates included), plus built-in page templates. Global sections update every page that uses them.",
    inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["section", "page", "header", "footer"] } } },
    annotations: { readOnlyHint: true },
    run: async (a, key) => {
      const site = await getSiteSettings(key.locationId);
      const usedOn = (id: string) => [...site.headers, ...site.footers].find((r) => r.itemId === id)?.mode ?? null;
      const items = (await listLibrary(key.locationId, key.companyId)).filter((i) => !a.kind || i.kind === a.kind);
      return {
        templates: items.map((i) => ({
          templateId: i.id,
          name: i.name,
          kind: i.kind,
          category: i.category,
          global: i.isGlobal,
          sharedByAgency: i.ownerType === "company",
          ...(i.kind === "header" || i.kind === "footer" ? { displayedOn: usedOn(i.id) ?? "not used" } : {}),
        })),
        builtInPageTemplates: a.kind && a.kind !== "page" ? undefined : BLUEPRINTS.map((b) => ({ templateId: b.id, name: b.name, description: b.description })),
      };
    },
  },
  {
    name: "get_template",
    title: "Get template",
    description: "A saved template's widget tree.",
    inputSchema: { type: "object", properties: { templateId: { type: "string" } }, required: ["templateId"] },
    annotations: { readOnlyHint: true },
    run: async (a, key) => {
      const item = await readableItem(key, a.templateId);
      const nodes = readTree((item.doc?.components as any) ?? null, item.doc?.html ?? "");
      return { templateId: item.id, name: item.name, kind: item.kind, global: item.isGlobal, nodes };
    },
  },
  {
    name: "create_template",
    title: "Create template",
    description:
      "Saves a widget tree to the library as a reusable section, page template, or site header/footer. Headers and footers can be shown on every page at once (useOnAllPages). A global section can be placed on many pages and edited in one place.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["section", "page", "header", "footer"] },
        name: { type: "string" },
        category: { type: "string", description: "Library category, e.g. Hero, Pricing, Footer." },
        nodes: NODES_SCHEMA,
        global: { type: "boolean", description: "kind=section only: make it a global section." },
        useOnAllPages: { type: "boolean", description: "kind=header/footer only: display it on all pages (replaces the current all-pages rule)." },
      },
      required: ["kind", "name", "nodes"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: async (a, key) => {
      const kind = a.kind as LibraryKind;
      if (!["section", "page", "header", "footer"].includes(kind)) throw new ToolError("kind must be section, page, header or footer.");
      const { nodes, warnings } = tree(a.nodes);
      if (!nodes.length) throw new ToolError("nodes is empty.");
      const built = buildTree(nodes);
      const item = await createLibraryItem({
        ownerType: "location",
        ownerId: key.locationId,
        kind,
        name: String(a.name || "AI template").slice(0, 120),
        category: String(a.category || (kind === "header" || kind === "footer" ? "Site" : "AI")).slice(0, 60),
        isGlobal: kind === "section" && a.global === true,
        doc: { components: built.components, html: built.html, css: built.css, fonts: built.fonts },
      });
      if ((kind === "header" || kind === "footer") && a.useOnAllPages === true) {
        const site = await getSiteSettings(key.locationId);
        const list = kind === "header" ? "headers" : "footers";
        await saveSiteSettings(key.locationId, { ...site, [list]: [...site[list].filter((r) => r.mode !== "all"), { itemId: item.id, mode: "all", pages: [] }] });
      }
      return { templateId: item.id, name: item.name, kind, global: item.isGlobal, widgets: countNodes(nodes), warnings };
    },
  },
  {
    name: "update_template",
    title: "Update template",
    description:
      "Renames a saved template and/or replaces its widget tree. Global sections, headers and footers update on every live page that uses them, without republishing.",
    inputSchema: {
      type: "object",
      properties: { templateId: { type: "string" }, name: { type: "string" }, category: { type: "string" }, nodes: NODES_SCHEMA },
      required: ["templateId"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    run: async (a, key) => {
      const item = await readableItem(key, a.templateId);
      if (item.ownerType !== "location") throw new ToolError("This template is shared by the agency and can only be changed from the agency account.");
      let warnings: string[] = [];
      const patch: Parameters<typeof updateLibraryItem>[1] = {};
      if (typeof a.name === "string" && a.name.trim()) patch.name = a.name.trim().slice(0, 120);
      if (typeof a.category === "string") patch.category = a.category.slice(0, 60);
      if (a.nodes !== undefined) {
        const t = tree(a.nodes);
        if (!t.nodes.length) throw new ToolError("nodes is empty.");
        warnings = t.warnings;
        const built = buildTree(t.nodes);
        patch.doc = { components: built.components, html: built.html, css: built.css, fonts: built.fonts };
        patch.thumbnail = null; // the old snapshot no longer matches
      }
      await updateLibraryItem(item.id, patch);
      return { templateId: item.id, updated: Object.keys(patch), warnings };
    },
  },
];

function countNodes(nodes: { c?: unknown[] }[]): number {
  return nodes.reduce((n, x) => n + 1 + (Array.isArray(x.c) ? countNodes(x.c as { c?: unknown[] }[]) : 0), 0);
}

export const SERVER_INSTRUCTIONS = `PageForge is a visual page builder for HighLevel (GoHighLevel). These tools create and edit pages and templates in one sub-account.
Workflow: get_builder_guide → get_widget_reference for the widgets you need → create_page / create_template with a widget tree → the user reviews it in the PageForge editor → publish_page when they want it live.
Use brand kit colors ("global:primary") and fonts unless asked otherwise. Write real, specific copy, never lorem ipsum. Ask before publishing or unpublishing live pages.`;
