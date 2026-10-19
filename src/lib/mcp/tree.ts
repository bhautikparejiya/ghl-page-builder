/**
 * Widget trees for AI tools: a simple JSON shape ({ type, settings, children }) that converts to and from
 * the editor's component data, plus the rendered HTML/CSS live pages serve. Everything here runs on the server.
 */
import { SECTIONS } from "../blueprints";
import type { FormConfig } from "../pages";
import { accordionAnswer } from "../widgets/accordion";
import { collectFonts } from "../widgets/css";
import { BRAND_PATHS, ICON_PATHS } from "../widgets/icon-data";
import { formConfig } from "../widgets/forms";
import { advancedGroups, componentType, getWidget, type Settings, widgetCss, widgetHtml, type WidgetDef, WIDGETS } from "../widgets";
import type { Control } from "../widgets/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** What AI tools send and receive. */
export interface WidgetNode {
  type: string;
  settings?: Settings;
  children?: WidgetNode[];
  /** type "global_section": a saved global section from the library. */
  libraryId?: string;
  /** Shorthand: a built-in section blueprint (see list_section_blueprints), e.g. { "blueprint": "heroSplit" }. */
  blueprint?: string;
}

export const GLOBAL_NODE = "global_section";
const GLOBAL_TYPE = "pf-global";
const MAX_NODES = 1500;

export class TreeError extends Error {}

/** Every setting a widget understands (content, design and the shared Advanced tab), by key. */
function controlMap(def: WidgetDef): Map<string, Control | null> {
  const map = new Map<string, Control | null>();
  // Keys some widgets keep without a control (ids, legacy fields) stay valid if they are in the defaults.
  Object.keys(def.defaults()).forEach((k) => map.set(k, null));
  [...def.content, ...def.design, ...advancedGroups(def)].forEach((g) => g.controls.forEach((c) => map.set(c.key, c)));
  return map;
}

const controlCache = new Map<string, Map<string, Control | null>>();
const controlsOf = (def: WidgetDef) => {
  let m = controlCache.get(def.type);
  if (!m) controlCache.set(def.type, (m = controlMap(def)));
  return m;
};

const validIcon = (v: unknown) => typeof v === "string" && (v === "" || (v.startsWith("brand:") ? v.slice(6) in BRAND_PATHS : v in ICON_PATHS));

/**
 * Why a value doesn't fit its control, or null. Checks fixed option lists (per device for responsive
 * controls) and icon names; other types are left to the renderers, which ignore malformed values.
 */
function invalidValue(c: Control, v: unknown): string | null {
  const values = (x: unknown): unknown[] => (c.responsive && x && typeof x === "object" && !Array.isArray(x) ? Object.values(x) : [x]);
  if ((c.type === "select" || c.type === "buttons") && Array.isArray(c.options)) {
    const allowed = c.options.map((o) => o.value);
    const bad = values(v).find((x) => !allowed.includes(String(x)));
    if (bad !== undefined) return `${JSON.stringify(bad)} is not one of ${allowed.map((a) => JSON.stringify(a)).join(", ")}${c.responsive ? " (per device: { \"desktop\": … })" : ""}`;
  }
  if (c.type === "icon" && !values(v).every(validIcon)) return `unknown icon ${JSON.stringify(v)} (use search_icons)`;
  if (c.type === "repeater") {
    if (!Array.isArray(v)) return "must be an array of items";
    for (const [i, item] of v.entries()) {
      if (!item || typeof item !== "object") return `item ${i} must be an object`;
      for (const f of c.fields) {
        const fv = (item as Settings)[f.key];
        const problem = fv === undefined || fv === "" ? null : invalidValue(f, fv);
        if (problem) return `item ${i} "${f.key}": ${problem}`;
      }
    }
  }
  return null;
}

/** Internal normalized node: settings already merged over the widget's defaults. */
interface Norm {
  type: string;
  s: Settings;
  c?: Norm[];
  libraryId?: string;
}

/**
 * Validates and normalizes a tree. Expands blueprints, wraps loose widgets at the top level into sections
 * (as the editor does), drops unknown setting keys and returns warnings for anything it changed.
 */
export function normalizeTree(input: unknown, opts: { topLevel: boolean } = { topLevel: true }): { nodes: Norm[]; warnings: string[] } {
  if (!Array.isArray(input)) throw new TreeError("`nodes` must be an array of widget nodes.");
  const warnings: string[] = [];
  let count = 0;

  const fromBlueprint = (id: string): WidgetNode[] => {
    const bp = (SECTIONS as Record<string, { nodes: { type: string; s?: Settings; c?: unknown[] }[] }>)[id];
    if (!bp) throw new TreeError(`Unknown blueprint "${id}". Call list_section_blueprints for valid ids.`);
    const conv = (n: { type: string; s?: Settings; c?: unknown[] }): WidgetNode => ({
      type: n.type,
      settings: n.s,
      children: n.c?.map((x) => conv(x as { type: string; s?: Settings; c?: unknown[] })),
    });
    return bp.nodes.map(conv);
  };

  const one = (raw: unknown, path: string, parentType: string): Norm[] => {
    if (!raw || typeof raw !== "object") throw new TreeError(`${path}: each node must be an object.`);
    const n = raw as WidgetNode;
    if (typeof n.blueprint === "string") return fromBlueprint(n.blueprint).flatMap((b, i) => one(b, `${path}.blueprint[${i}]`, parentType));
    if (++count > MAX_NODES) throw new TreeError(`Too many widgets (max ${MAX_NODES}).`);

    if (n.type === GLOBAL_NODE) {
      if (typeof n.libraryId !== "string" || !n.libraryId) throw new TreeError(`${path}: global_section needs a libraryId.`);
      if (parentType !== "wrapper") throw new TreeError(`${path}: global sections can only be placed at the top level of a page.`);
      return [{ type: GLOBAL_NODE, s: {}, libraryId: n.libraryId }];
    }

    const def = getWidget(n.type);
    if (!def) throw new TreeError(`${path}: unknown widget type "${n.type}". Call get_widget_reference for valid types.`);
    const parents = def.container?.parents;
    if (parents && !parents.includes(parentType === "wrapper" ? "wrapper" : componentType(parentType))) {
      throw new TreeError(`${path}: "${def.type}" can only be placed ${parents.includes("wrapper") ? "at the top level of the page" : `inside ${parents.join(", ")}`}.`);
    }
    if (parentType !== "wrapper") {
      const parentDef = getWidget(parentType);
      if (parentDef?.container?.rejects?.includes(componentType(def.type))) throw new TreeError(`${path}: "${def.type}" can't be placed inside "${parentType}".`);
    }

    const settings: Settings = {};
    const controls = controlsOf(def);
    const unknown: string[] = [];
    for (const [k, v] of Object.entries(n.settings ?? {})) {
      if (!controls.has(k)) {
        unknown.push(k);
        continue;
      }
      const c = controls.get(k);
      const problem = c ? invalidValue(c, v) : null;
      if (problem) warnings.push(`${path} (${def.type}): ignored "${k}": ${problem}.`);
      else settings[k] = v;
    }
    if (unknown.length) warnings.push(`${path} (${def.type}): ignored unknown settings ${unknown.map((k) => `"${k}"`).join(", ")}.`);

    const kids = Array.isArray(n.children) ? n.children : [];
    if (kids.length && !def.container) warnings.push(`${path} (${def.type}): this widget can't hold children; they were dropped.`);
    const s = { ...def.defaults(), ...settings };
    if (!def.container) return [{ type: def.type, s }];
    return [{ type: def.type, s, c: kids.flatMap((k, i) => one(k, `${path}.children[${i}]`, def.type)) }];
  };

  let nodes = (input as unknown[]).flatMap((n, i) => one(n, `nodes[${i}]`, opts.topLevel ? "wrapper" : "container"));

  if (opts.topLevel) {
    // Loose widgets at the top level go into sections, like dropping them on an empty page in the editor.
    const out: Norm[] = [];
    let loose: Norm[] = [];
    const flush = () => {
      if (!loose.length) return;
      const section = getWidget("section")!;
      out.push({ type: "section", s: section.defaults(), c: loose });
      warnings.push(`Wrapped ${loose.length} top-level widget(s) in a section.`);
      loose = [];
    };
    for (const n of nodes) {
      const def = getWidget(n.type);
      if (n.type === GLOBAL_NODE || n.type === "section" || def?.topLevel) {
        flush();
        out.push(n);
      } else loose.push(n);
    }
    flush();
    nodes = out;
  }
  return { nodes, warnings };
}

const newUid = () => Math.random().toString(36).slice(2, 9);

export interface Built {
  /** Editor component JSON for the page body. */
  components: any[];
  html: string;
  css: string;
  fonts: string[];
}

/** Editor component JSON + rendered HTML/CSS from a normalized tree. */
export function buildTree(nodes: Norm[]): Built {
  const css: string[] = [];
  const fonts = new Set<string>();
  const walk = (list: Norm[]): { comps: any[]; html: string } => {
    const comps: any[] = [];
    let html = "";
    for (const n of list) {
      if (n.type === GLOBAL_NODE) {
        const id = String(n.libraryId).replace(/[^\w-]/g, "");
        comps.push({ type: GLOBAL_TYPE, pfGlobalId: id });
        html += `<div data-pf-global="${id}"></div>`;
        continue;
      }
      const def = getWidget(n.type)!;
      const uid = newUid();
      css.push(widgetCss(def, n.s, uid));
      collectFonts(n.s, fonts);
      const comp: any = { type: componentType(def.type), pfSettings: n.s, pfId: uid };
      if (def.container) {
        const inner = walk(n.c ?? []);
        comp.components = inner.comps;
        html += widgetHtml(def, n.s, uid, inner.html);
      } else html += widgetHtml(def, n.s, uid);
      comps.push(comp);
    }
    return { comps, html };
  };
  const r = walk(nodes);
  return { components: r.comps, html: r.html, css: css.join(""), fonts: [...fonts] };
}

/** Project data the editor loads (same shape the editor saves, minus styles it regenerates). */
export const projectDataFor = (components: any[]) => ({ pages: [{ component: { type: "wrapper", components } }], styles: [] });

/** Body components of saved editor project data (both the editor's own shape and projectDataFor's). */
export function bodyComponents(projectData: any): any[] | string | null {
  const page = projectData?.pages?.[0];
  const wrapper = page?.frames?.[0]?.component ?? page?.component;
  return wrapper?.components ?? null;
}

/** Settings stored in the old "editor markup" form (<div data-pf-widget data-pf-settings='…'>). */
function parseEditorHtml(html: string): WidgetNode[] | null {
  let i = 0;
  const OPEN = /^<div data-pf-widget="([\w-]+)" data-pf-settings='([^']*)'>/;
  const unesc = (s: string) => s.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const list = (): WidgetNode[] => {
    const out: WidgetNode[] = [];
    for (;;) {
      const m = OPEN.exec(html.slice(i));
      if (!m) return out;
      i += m[0].length;
      let settings: Settings = {};
      try {
        settings = JSON.parse(unesc(m[2]));
      } catch {
        /* keep defaults */
      }
      const children = list();
      if (!html.startsWith("</div>", i)) throw new Error("bad markup");
      i += 6;
      out.push({ type: m[1], settings, ...(children.length ? { children } : {}) });
    }
  };
  try {
    const nodes = list();
    return i === html.trim().length ? nodes : null;
  } catch {
    return null;
  }
}

/**
 * Widget tree of a page or template, for AI tools to read. Only settings that differ from the widget's
 * defaults are returned, to stay compact. Pages made from a built-in template and not yet opened in the
 * editor store widget markup instead of component JSON; that is parsed too.
 */
export function readTree(components: any[] | string | null, fallbackHtml = ""): WidgetNode[] {
  if (typeof components === "string" || components == null) {
    return (parseEditorHtml(typeof components === "string" ? components : fallbackHtml) ?? []).map(compact);
  }
  const walk = (list: any[]): WidgetNode[] =>
    list.flatMap((c: any): WidgetNode[] => {
      if (!c || typeof c !== "object") return [];
      if (c.type === GLOBAL_TYPE) return [{ type: GLOBAL_NODE, libraryId: String(c.pfGlobalId) }];
      const def = getWidget(typeof c.type === "string" && c.type.startsWith("pf-") ? c.type.slice(3) : "");
      if (!def) return []; // site-part previews and anything else that isn't a widget
      const node: WidgetNode = { type: def.type, settings: (c.pfSettings as Settings) ?? {} };
      if (def.container && Array.isArray(c.components) && c.components.length) node.children = walk(c.components);
      return [compact(node)];
    });
  return walk(components);
}

/** JSON with sorted object keys (the database doesn't keep key order). */
const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(v);

/** Drops settings equal to the widget's defaults. */
function compact(n: WidgetNode): WidgetNode {
  const def = getWidget(n.type);
  if (!def) return n;
  const d = def.defaults();
  const settings: Settings = {};
  for (const [k, v] of Object.entries(n.settings ?? {})) if (stable(d[k]) !== stable(v)) settings[k] = v;
  return { type: n.type, ...(Object.keys(settings).length ? { settings } : {}), ...(n.children ? { children: n.children.map(compact) } : {}) };
}

/**
 * What publishing needs besides HTML/CSS, from saved editor components: form settings (kept on the server),
 * FAQ structured data and Google fonts. Mirrors what the editor sends when it publishes.
 */
export function publishExtras(components: any[] | string | null): { forms: Record<string, FormConfig>; jsonLd?: string; fonts: string[] } {
  const forms: Record<string, FormConfig> = {};
  const fonts = new Set<string>();
  const faqs: unknown[] = [];
  const visit = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const c of list as any[]) {
      if (!c || typeof c !== "object") continue;
      const s = (c.pfSettings ?? {}) as Settings;
      if (c.pfSettings) collectFonts(s, fonts);
      if (c.type === "pf-form" && c.pfId) forms[`pf-${c.pfId}`] = formConfig(s);
      if (c.type === "pf-accordion" && s.faqSchema && Array.isArray(s.items)) {
        for (const it of s.items as { title?: string; html?: string; body?: string }[]) {
          if (!it?.title) continue;
          faqs.push({
            "@type": "Question",
            name: String(it.title),
            acceptedAnswer: { "@type": "Answer", text: accordionAnswer(it).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() },
          });
        }
      }
      visit(c.components);
    }
  };
  visit(components);
  return {
    forms,
    fonts: [...fonts],
    jsonLd: faqs.length ? JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs }) : undefined,
  };
}

/* ── Reference for AI tools ── */

const optionValues = (c: Control) =>
  "options" in c ? (typeof c.options === "string" ? `dynamic:${c.options}` : c.options.map((o) => o.value)) : undefined;

function describeControl(c: Control): Record<string, unknown> {
  const out: Record<string, unknown> = { key: c.key, type: c.type, label: c.label };
  if (c.responsive) out.responsive = true;
  if (c.help) out.help = c.help;
  const opts = optionValues(c);
  if (opts) out.options = opts;
  if (c.type === "number") Object.assign(out, { min: c.min, max: c.max, unit: c.unit });
  if (c.type === "repeater") {
    out.itemFields = c.fields.map(describeControl);
    out.itemExample = c.newItem();
  }
  return out;
}

/** Short list of every widget. */
export function widgetSummary() {
  return WIDGETS.map((w) => ({
    type: w.type,
    label: w.label,
    category: w.category,
    ...(w.container ? { container: true } : {}),
    ...(w.type === "section" ? { placement: "top level only; holds containers and widgets" } : {}),
    ...(w.topLevel && w.type !== "section" ? { placement: "top level (outside sections) or inside containers" } : {}),
    ...(w.keywords ? { keywords: w.keywords } : {}),
  }));
}

/** Full settings schema of some widgets. */
export function widgetDetails(types: string[]) {
  return types.map((t) => {
    const def = getWidget(t);
    if (!def) return { type: t, error: "unknown widget type" };
    return {
      type: def.type,
      label: def.label,
      container: !!def.container,
      defaults: def.defaults(),
      content: def.content.map((g) => ({ group: g.label, controls: g.controls.map(describeControl) })),
      design: def.design.map((g) => ({ group: g.label, controls: g.controls.map(describeControl) })),
      advanced: advancedGroups(def).map((g) => ({ group: g.label, controls: g.controls.map(describeControl) })),
    };
  });
}

export const VALUE_FORMATS = `Setting value formats:
- responsive (controls marked responsive): { "desktop": v, "tablet": v, "mobile": v }. Tablet falls back to desktop, mobile to tablet, so set desktop and override only what changes.
- color: "#0f172a", "rgba(0,0,0,.5)" or a brand kit color "global:primary" | "global:secondary" | "global:text" | "global:background" (or "global:<custom id>" from get_brand_kit). Prefer brand kit colors so pages follow the brand.
- richtext: limited HTML (<p>, <strong>, <em>, <a href>, <br>, <ul>/<ol>/<li>, <span class="gpb-gradient-text"> for gradient-highlighted words in headings).
- typography: { "font": "" | "heading" | "body" | "family:Inter", "size": responsive px number, "weight": "400".."900", "lineHeight": responsive number, "letterSpacing": px number, "transform": "" | "uppercase" | "lowercase" | "capitalize", "style": "" | "italic" }.
- spacing: { "top", "right", "bottom", "left": numbers, "unit": "px" | "%" | "em" } (usually responsive).
- length: { "value": number, "unit": "px" | "%" | "vh" | "vw" | "em" }.
- link: { "url": "https://…" | "#section-id" | "#popup-id", "newTab": bool, "nofollow": bool }.
- image: an https URL string.
- icon: an icon name such as "check", "star", "arrow-right", "phone", "mail" (Lucide names), or brand icons like "brand:facebook".
- background: { "type": "" | "color" | "gradient" | "image", "color", "gradient": { "from", "to", "angle" }, "image": { "url", "size": "cover" | "contain" | "auto", "position", "repeat", "fixed" }, "overlay": { "color", "opacity" 0..1 } }.
- border: { "style": "" | "none" | "solid" | "dashed" | "dotted", "width": px, "color" }.
- shadow: { "preset": "" | "none" | "sm" | "md" | "lg" | "xl" | "custom", "x", "y", "blur", "spread", "color" }.
- repeater: an array of items shaped like itemExample.
- datetime: ISO date-time string.
Location tokens such as {{location.name}}, {{location.phone}}, {{location.email}}, {{location.address}} and {{custom_values.<key>}} are filled in on live pages.`;

export const STRUCTURE_GUIDE = `Page structure (like Elementor):
- A page is a list of top-level nodes: "section" (full-width band), "navbar" and "popup", or { "type": "global_section", "libraryId": "…" } for a saved global section.
- Sections hold "container" nodes (flex or grid boxes) and widgets. Containers can nest. Leaf widgets (heading, text, button, image…) have no children.
- Lay out columns with a container: settings { "direction": { "desktop": "row", "mobile": "column" }, "gap": { "desktop": 32 } }, or a grid: { "layout": "grid", "columns": { "desktop": 3, "tablet": 2, "mobile": 1 } }.
- Shortcut: { "blueprint": "<id>" } inserts a ready-made section (list_section_blueprints) that you can then customise by reading the page back.
- Only include settings you want to change; everything else uses the widget's defaults and the brand kit.
- Forms collect leads into HighLevel contacts. Popups open from links/buttons with link.url "#<popupId>".`;
