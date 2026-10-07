/**
 * Widget schema types. A widget is plain data (settings) + a schema (controls) + pure render functions.
 * Nothing here depends on the editor canvas, so the same definitions render on the server at publish time.
 */

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICES: Device[] = ["desktop", "tablet", "mobile"];

/** A per-device value. Tablet falls back to desktop, mobile to tablet. */
export type Responsive<T> = Partial<Record<Device, T>>;

export type Settings = Record<string, unknown>;

export interface Spacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  unit?: "px" | "%" | "em";
}

export interface Typography {
  /** "" = inherit, "heading" / "body" = theme fonts */
  font?: "" | "heading" | "body";
  size?: Responsive<number>;
  weight?: string;
  lineHeight?: Responsive<number>;
  letterSpacing?: number;
  transform?: "" | "uppercase" | "lowercase" | "capitalize";
  style?: "" | "italic";
}

export interface LinkValue {
  url?: string;
  newTab?: boolean;
  nofollow?: boolean;
}

export type Option = { value: string; label: string };

interface Base {
  key: string;
  label: string;
  help?: string;
  responsive?: boolean;
  /** Show this control only when the predicate holds for the current settings. */
  when?: (s: Settings) => boolean;
}

export type Control =
  | (Base & { type: "text"; placeholder?: string; multiline?: boolean })
  | (Base & { type: "select"; options: Option[] | "popups" })
  | (Base & { type: "buttons"; options: (Option & { icon?: string })[] })
  | (Base & { type: "toggle" })
  | (Base & { type: "number"; min?: number; max?: number; step?: number; unit?: string; slider?: boolean })
  | (Base & { type: "color" })
  | (Base & { type: "typography" })
  | (Base & { type: "spacing" })
  | (Base & { type: "link" })
  | (Base & { type: "code"; placeholder?: string })
  | (Base & { type: "repeater"; fields: Control[]; itemLabel: string; addLabel?: string; newItem: () => Settings });

export interface ControlGroup {
  label: string;
  controls: Control[];
  /** Collapsed by default in the panel. */
  closed?: boolean;
}

export interface WidgetDef {
  type: string;
  label: string;
  /** Inline SVG for the widget library tile. */
  icon: string;
  category: string;
  defaults: () => Settings;
  content: ControlGroup[];
  design: ControlGroup[];
  /** Inner markup (the wrapper element is added by the renderer). */
  render: (s: Settings) => string;
  /** Scoped styles. `&` in selectors is the widget's own wrapper. */
  css?: (s: Settings, css: CssBuilder) => void;
}

export interface CssBuilder {
  /** Plain declarations for one device (desktop = no media query). */
  rule(selector: string, decls: Decls, device?: Device): void;
  /** Declarations from a responsive value: called once per device that has a value. */
  responsive<T>(selector: string, value: Responsive<T> | undefined, toDecls: (v: T) => Decls): void;
}

export type Decls = Record<string, string | number | undefined | null | false>;

export function defineWidget(def: WidgetDef): WidgetDef {
  return def;
}
