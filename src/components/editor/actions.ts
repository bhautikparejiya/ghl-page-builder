import type { Component, Editor } from "grapesjs";
import { componentType, getWidget, type Settings, type WidgetDef } from "@/lib/widgets";
import { advancedGroups } from "@/lib/widgets/advanced";
import type { Control } from "@/lib/widgets/types";
import { collectWidgetCss, getSettings, SETTINGS_PROP, UID_PROP, widgetOf } from "./widgetComponents";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Keys of a widget's Design and Advanced settings (what "copy style" copies). */
function styleKeys(def: WidgetDef): Set<string> {
  const keys = new Set<string>();
  const add = (c: Control) => keys.add(c.key);
  def.design.forEach((g) => g.controls.forEach(add));
  advancedGroups(def)
    .flatMap((g) => g.controls)
    .filter((c) => !["_cssId", "_openPopup", "_abTest", "_abVariant", "_condFrom", "_condTo", "_condParam", "_condVisitor"].includes(c.key))
    .forEach(add);
  return keys;
}

let styleClipboard: { type: string; style: Settings } | null = null;

export function copyStyle(c: Component | null | undefined): boolean {
  const def = widgetOf(c);
  if (!c || !def) return false;
  const s = getSettings(c);
  const style: Settings = {};
  styleKeys(def).forEach((k) => {
    if (s[k] !== undefined) style[k] = s[k];
  });
  styleClipboard = { type: def.type, style };
  return true;
}

export const canPasteStyle = (c: Component | null | undefined) => !!styleClipboard && widgetOf(c)?.type === styleClipboard.type;

export function pasteStyle(c: Component | null | undefined): boolean {
  const def = widgetOf(c);
  if (!c || !def || !styleClipboard || styleClipboard.type !== def.type) return false;
  const next = { ...getSettings(c) };
  styleKeys(def).forEach((k) => delete next[k]);
  c.set(SETTINGS_PROP, { ...next, ...structuredClone(styleClipboard.style) });
  return true;
}

export function resetStyle(c: Component | null | undefined): boolean {
  const def = widgetOf(c);
  if (!c || !def) return false;
  const next = { ...getSettings(c) };
  styleKeys(def).forEach((k) => delete next[k]);
  c.set(SETTINGS_PROP, next);
  return true;
}

/** Backbone's add() returns one model for one input and an array for an array. */
export const firstAdded = (added: unknown): Component | undefined => (Array.isArray(added) ? added[0] : (added as Component | undefined));

export function duplicate(editor: Editor, c: Component | null | undefined) {
  if (!c || c.get("type") === "wrapper") return;
  const parent = c.parent();
  if (!parent) return;
  const copy = firstAdded(parent.components().add(c.clone(), { at: c.index() + 1 }));
  if (copy) editor.select(copy);
}

/** The top-level component (direct child of the page) that contains `c`. */
export function topLevelOf(c: Component | null | undefined): Component | null {
  let cur = c ?? null;
  while (cur && cur.parent() && cur.parent()!.get("type") !== "wrapper") cur = cur.parent()!;
  return cur && cur.parent() ? cur : null;
}

/**
 * Inserts a widget where the user is working: inside the selected container, after the selected widget,
 * or in the last section of the page.
 */
export function insertWidget(editor: Editor, type: string, settings?: Settings): Component | null {
  const def = getWidget(type);
  if (!def) return null;
  const content = { type: componentType(type), ...(settings ? { [SETTINGS_PROP]: { ...def.defaults(), ...settings } } : {}) };
  const wrapper = editor.getWrapper()!;
  const sel = editor.getSelected();
  let added: Component[] = [];
  if (def.type === "section" || def.topLevel) {
    const top = topLevelOf(sel);
    added = [firstAdded(wrapper.components().add(content, { at: top ? top.index() + 1 : undefined }))!];
  } else if (sel && widgetOf(sel)?.container) {
    added = sel.append(content) as unknown as Component[];
  } else if (sel && sel.parent() && sel.parent()!.get("type") !== "wrapper") {
    added = [firstAdded(sel.parent()!.components().add(content, { at: sel.index() + 1 }))!];
  } else {
    const sections = wrapper.components().filter((x: Component) => x.get(SETTINGS_PROP) !== undefined && x.get("type") === componentType("section"));
    const last = sections[sections.length - 1] as Component | undefined;
    added = last
      ? (last.append(content) as unknown as Component[])
      : (wrapper.append({ type: componentType("section"), components: [content] }) as unknown as Component[]);
  }
  const c = added[0];
  if (c) {
    editor.select(c);
    c.view?.el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }
  return c ?? null;
}

/** Inserts top-level content (a section blueprint or saved section) after `after`, or at the end of the page. */
export function insertSection(editor: Editor, content: any, after?: Component | null): Component | null {
  const wrapper = editor.getWrapper()!;
  const at = after ? after.index() + 1 : undefined;
  const c = firstAdded(wrapper.components().add(content, { at }));
  if (c) {
    editor.select(c);
    setTimeout(() => c.view?.el?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
  }
  return c ?? null;
}

/** Component JSON without per-instance ids, so every insert gets fresh CSS scopes. */
export function stripIds(json: any): any {
  if (Array.isArray(json)) return json.map(stripIds);
  if (!json || typeof json !== "object") return json;
  const out: any = {};
  for (const [k, v] of Object.entries(json)) {
    if (k === UID_PROP) continue;
    if (k === "attributes" && v && typeof v === "object") {
      const { id, ...rest } = v as Record<string, unknown>;
      void id;
      out[k] = rest;
    } else out[k] = k === "components" ? stripIds(v) : v;
  }
  return out;
}

/** Everything needed to store a component (or the whole page) in the library and render it on live pages. */
export function serialize(editor: Editor, root: Component | "page") {
  const comps = root === "page" ? (editor.getWrapper()!.components().toArray() as Component[]) : [root];
  // JSON round-trip turns nested component collections into plain data first.
  const components = stripIds(JSON.parse(JSON.stringify(comps)));
  const html = comps.map((c) => c.toHTML()).join("");
  const widgetCss: string[] = [];
  const fonts = new Set<string>();
  for (const c of comps) {
    const r = collectWidgetCss(editor, c);
    widgetCss.push(r.css);
    r.fonts.forEach((f) => fonts.add(f));
  }
  const classicCss = comps.map((c) => editor.getCss({ component: c } as any) ?? "").join("");
  return { components, html, css: classicCss + widgetCss.join(""), fonts: [...fonts] };
}

/** Small JPEG snapshot of a canvas element for library thumbnails (best effort). */
export async function snapshot(el: HTMLElement | undefined | null): Promise<string | undefined> {
  if (!el) return undefined;
  try {
    const { toJpeg } = await import("html-to-image");
    const width = Math.min(1240, el.scrollWidth || 1240);
    const scale = 420 / width;
    return await toJpeg(el, {
      quality: 0.72,
      pixelRatio: scale,
      backgroundColor: "#ffffff",
      cacheBust: true,
      // Cross-origin font stylesheets (Google Fonts) can't be read; thumbnails use fallback fonts.
      skipFonts: true,
      height: Math.min(el.scrollHeight, 1600),
      // Cross-origin images that block CORS are skipped instead of failing the snapshot.
      imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      filter: (n) => !(n instanceof HTMLElement && n.classList?.contains("gjs-badge")),
    });
  } catch {
    return undefined;
  }
}
