import { advancedAttrs, advancedClasses, advancedCss } from "./advanced";
import { createCssBuilder } from "./css";
import type { LinkValue, Settings, WidgetDef } from "./types";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML content and attribute values. */
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** Plain text → escaped HTML, keeping line breaks. */
export const textToHtml = (v: unknown) => esc(v).replace(/\r?\n/g, "<br>");

/** Plain text → paragraphs (blank line = new paragraph). */
export const textToParagraphs = (v: unknown) =>
  String(v ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${textToHtml(p)}</p>`)
    .join("");

/** Only allow URL schemes that are safe to put in href. */
export function safeUrl(url: unknown): string {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:|sms:|#|\/|\?)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ""; // javascript:, data:, …
  return `https://${u}`;
}

export function linkAttrs(link: LinkValue | undefined): string {
  const href = safeUrl(link?.url);
  if (!href) return ' href="#"';
  const rel = [link?.newTab && "noopener", link?.nofollow && "nofollow"].filter(Boolean).join(" ");
  return ` href="${esc(href)}"${link?.newTab ? ' target="_blank"' : ""}${rel ? ` rel="${rel}"` : ""}`;
}

/** Class that scopes a widget instance's generated CSS. */
export const scopeClass = (uid: string) => `pf-w-${uid}`;

export function widgetCss(def: WidgetDef, s: Settings, uid: string): string {
  const scope = `.${scopeClass(uid)}`;
  const css = createCssBuilder(scope);
  def.css?.(s, css);
  advancedCss(s, css);
  const custom = typeof s._customCss === "string" ? s._customCss.replace(/&/g, scope) : "";
  // Never allow generated CSS to close the <style> element it is placed in.
  return (css.toString() + custom).replace(/<\//g, "");
}

export function wrapperAttrs(def: WidgetDef, s: Settings, uid: string): Record<string, string> {
  return {
    class: ["pf-widget", `pf-${def.type}`, scopeClass(uid), ...advancedClasses(s)].join(" "),
    "data-pf-widget": def.type,
    ...advancedAttrs(s),
  };
}

export function widgetHtml(def: WidgetDef, s: Settings, uid: string): string {
  const attrs = Object.entries(wrapperAttrs(def, s, uid))
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
  return `<div${attrs}>${def.render(s)}</div>`;
}
