import { createCssBuilder, CORE_COLORS, colorVar, typography } from "./widgets/css";
import type { Typography } from "./widgets/types";
import { DEFAULT_THEME, type Theme } from "./theme";

export interface KitColor {
  id: string;
  label: string;
  value: string;
}

export type TextStyleKey = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body";

export interface BrandKit {
  /** Always contains the core colors (primary, secondary, text, background) first, then custom ones. */
  colors: KitColor[];
  fonts: { heading: string; body: string };
  /** Typography presets applied to headings and body text on every page. */
  text: Partial<Record<TextStyleKey, Typography>>;
  /** Default corner radius (px) for buttons, cards and inputs. */
  radius: number;
  /** Default content width (px) of sections. */
  contentWidth: number;
  logoUrl?: string;
  updatedAt?: number;
}

export const TEXT_STYLES: { key: TextStyleKey; label: string }[] = [
  { key: "h1", label: "Heading 1" },
  { key: "h2", label: "Heading 2" },
  { key: "h3", label: "Heading 3" },
  { key: "h4", label: "Heading 4" },
  { key: "h5", label: "Heading 5" },
  { key: "h6", label: "Heading 6" },
  { key: "body", label: "Body text" },
];

export function kitFromTheme(t: Theme): BrandKit {
  return {
    colors: [
      { id: "primary", label: "Primary", value: t.primary },
      { id: "secondary", label: "Accent", value: t.secondary },
      { id: "text", label: "Text", value: t.text },
      { id: "background", label: "Background", value: t.background },
    ],
    fonts: { heading: t.headingFont, body: t.bodyFont },
    text: {},
    radius: t.radius,
    contentWidth: 1140,
  };
}

export const DEFAULT_KIT: BrandKit = kitFromTheme(DEFAULT_THEME);

const HEX = /^#[0-9a-f]{3,8}$/i;
const safeFont = (f: unknown, d: string) => (typeof f === "string" && /^[\w\s-]{1,60}$/.test(f) ? f : d);

/** Validates and fills a kit coming from the client or the database. */
export function normalizeKit(input: Partial<BrandKit> | null | undefined): BrandKit {
  const k = input ?? {};
  const byId = new Map((Array.isArray(k.colors) ? k.colors : []).map((c) => [String(c.id), c]));
  const colors: KitColor[] = CORE_COLORS.map((core) => {
    const c = byId.get(core.id);
    const fallback = DEFAULT_KIT.colors.find((d) => d.id === core.id)!.value;
    return { id: core.id, label: core.label, value: c && HEX.test(String(c.value)) ? String(c.value) : fallback };
  });
  for (const c of Array.isArray(k.colors) ? k.colors : []) {
    const id = String(c.id).replace(/[^\w-]/g, "").slice(0, 40);
    if (!id || CORE_COLORS.some((core) => core.id === id) || !HEX.test(String(c.value))) continue;
    colors.push({ id, label: String(c.label || id).slice(0, 40), value: String(c.value) });
  }
  return {
    colors: colors.slice(0, 40),
    fonts: { heading: safeFont(k.fonts?.heading, DEFAULT_KIT.fonts.heading), body: safeFont(k.fonts?.body, DEFAULT_KIT.fonts.body) },
    text: typeof k.text === "object" && k.text ? k.text : {},
    radius: typeof k.radius === "number" ? Math.max(0, Math.min(60, k.radius)) : DEFAULT_KIT.radius,
    contentWidth: typeof k.contentWidth === "number" ? Math.max(480, Math.min(1920, k.contentWidth)) : DEFAULT_KIT.contentWidth,
    logoUrl: typeof k.logoUrl === "string" && /^https?:\/\//.test(k.logoUrl) ? k.logoUrl : undefined,
    updatedAt: k.updatedAt,
  };
}

/** CSS variables and text presets for a page root (".gpb-root" on live pages, "body.gpb-root" in the editor). */
export function kitCss(kit: BrandKit, selector = ".gpb-root"): string {
  const vars = [
    ...kit.colors.map((c) => `${colorVar(c.id)}:${c.value}`),
    `--gpb-radius:${kit.radius}px`,
    `--pf-content:${kit.contentWidth}px`,
    `--gpb-font-heading:'${kit.fonts.heading}',sans-serif`,
    `--gpb-font-body:'${kit.fonts.body}',sans-serif`,
  ].join(";");
  const css = createCssBuilder(selector);
  for (const { key } of TEXT_STYLES) {
    const t = kit.text[key];
    if (!t) continue;
    // Headings are styled as elements; body applies to the root so everything inherits it.
    typography(css, key === "body" ? "&" : `& ${key}`, t as Typography);
  }
  return `${selector}{${vars}}${css.toString()}`;
}

/**
 * Page-level theme override. New pages follow the brand kit (useKit: true); pages created before brand kits
 * (no flag) keep their own colors, fonts and radius until switched over.
 */
export function effectiveKit(kit: BrandKit, theme: Theme | undefined): BrandKit {
  if (!theme || theme.useKit) return kit;
  const own = kitFromTheme(theme);
  return { ...kit, colors: [...own.colors, ...kit.colors.slice(4)], fonts: own.fonts, radius: own.radius };
}

