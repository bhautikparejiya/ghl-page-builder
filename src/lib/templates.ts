import { BLUEPRINTS, toEditorHtml } from "./blueprints";
import type { Theme } from "./theme";

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string; // CSS gradient shown while the live preview loads
  /** Templates follow the sub-account's brand kit unless they set their own theme. */
  theme?: Theme;
  html: string;
  css: string;
}

const THUMBS: Record<string, string> = {
  blank: "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
  saas: "linear-gradient(135deg,#4f46e5,#06b6d4)",
  webinar: "linear-gradient(135deg,#0f172a,#7c3aed)",
  agency: "linear-gradient(135deg,#059669,#facc15)",
  coach: "linear-gradient(135deg,#be185d,#f59e0b)",
  optin: "linear-gradient(135deg,#0ea5e9,#22c55e)",
};

export const TEMPLATES: Template[] = BLUEPRINTS.map((b) => ({
  id: b.id,
  name: b.name,
  category: b.category,
  description: b.description,
  thumbnail: THUMBS[b.id] ?? THUMBS.blank,
  html: toEditorHtml(b.nodes),
  css: "",
}));
