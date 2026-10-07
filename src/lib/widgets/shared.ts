import { background, borderDecls, color, px, shadowValue, spacingDecls } from "./css";
import type { Background, Border, Control, CssBuilder, Option, Responsive, Settings, Shadow, Spacing } from "./types";

/** Stroke icon (24×24 grid) for widget tiles and panel buttons. */
export const icon = (paths: string, size = 30) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const alignIcon = (lines: [number, number][]) =>
  icon(lines.map(([x1, x2], i) => `<path d="M${x1} ${6 + i * 4}h${x2 - x1}"/>`).join(""), 16);

export const ALIGN = [
  { value: "left", label: "Left", icon: alignIcon([[4, 20], [4, 14], [4, 18], [4, 12]]) },
  { value: "center", label: "Center", icon: alignIcon([[4, 20], [7, 17], [5, 19], [8, 16]]) },
  { value: "right", label: "Right", icon: alignIcon([[4, 20], [10, 20], [6, 20], [12, 20]]) },
  { value: "justify", label: "Justify", icon: alignIcon([[4, 20], [4, 20], [4, 20], [4, 20]]) },
];
export const ALIGN3 = ALIGN.slice(0, 3);

/** text-align value → flex alignment, for widgets laid out with flexbox. */
export const FLEX_ALIGN: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end", justify: "stretch", stretch: "stretch" };

export const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export const HEADING_TAGS = opts(["h1", "H1"], ["h2", "H2"], ["h3", "H3"], ["h4", "H4"], ["h5", "H5"], ["h6", "H6"], ["p", "P"], ["div", "DIV"]);

export const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
export const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
export const list = <T = Settings>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Standard "box" styling controls (background, border, radius, shadow, padding), keyed with a prefix
 * so a widget can have several boxes (e.g. card + icon).
 */
export function boxControls(prefix = "", o: { padding?: boolean; background?: boolean } = {}): Control[] {
  const k = (name: string) => (prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name);
  return [
    ...(o.background === false ? [] : [{ type: "background" as const, key: k("background"), label: "Background" }]),
    { type: "border", key: k("border"), label: "Border" },
    { type: "number", key: k("radius"), label: "Corner radius", unit: "px", min: 0, max: 80, slider: true, responsive: true },
    { type: "shadow", key: k("shadow"), label: "Shadow" },
    ...(o.padding === false ? [] : [{ type: "spacing" as const, key: k("padding"), label: "Padding", responsive: true }]),
  ];
}

export function boxCss(css: CssBuilder, selector: string, s: Settings, prefix = "") {
  const g = (name: string) => s[prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name];
  const bg = g("background") as Background | undefined;
  background(css, selector, bg);
  if (bg?.type === "image" && bg.overlay?.color) css.rule(selector, { position: "relative" });
  css.rule(selector, { ...borderDecls(g("border") as Border), "box-shadow": shadowValue(g("shadow") as Shadow) });
  css.responsive(selector, g("radius") as Responsive<number>, (v) => ({ "border-radius": px(v), overflow: v ? "hidden" : undefined }));
  css.responsive(selector, g("padding") as Responsive<Spacing>, (v) => spacingDecls("padding", v));
}

/** Color + hover color pair for text/icons. */
export function colorRule(css: CssBuilder, selector: string, s: Settings, key: string, prop = "color") {
  css.rule(selector, { [prop]: color(s[key]) });
}
