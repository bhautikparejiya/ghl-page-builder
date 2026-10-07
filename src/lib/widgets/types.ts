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
  /** "" = inherit, "heading" / "body" = brand fonts, "family:Name" = a specific Google font */
  font?: string;
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

/** A length with a unit, e.g. { value: 50, unit: "%" }. */
export interface Length {
  value?: number;
  unit?: "px" | "%" | "vh" | "vw" | "em";
}

export interface Background {
  type?: "" | "color" | "gradient" | "image";
  color?: string;
  gradient?: { from?: string; to?: string; angle?: number };
  image?: { url?: string; size?: "cover" | "contain" | "auto"; position?: string; repeat?: boolean; fixed?: boolean };
  overlay?: { color?: string; opacity?: number };
}

export interface Border {
  style?: "" | "none" | "solid" | "dashed" | "dotted";
  width?: number;
  color?: string;
}

export interface Shadow {
  preset?: "" | "none" | "sm" | "md" | "lg" | "xl" | "custom";
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
}

export type Option = { value: string; label: string };

/**
 * Options loaded at runtime from the editor (popups on the page) or HighLevel
 * (workflows, custom fields, calendars, pipelines…).
 */
export type DynamicOptions = "popups" | "workflows" | "customFields" | "calendars" | "pipelines" | "stages" | "customValues";

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
  | (Base & { type: "richtext"; inline?: boolean })
  | (Base & { type: "select"; options: Option[] | DynamicOptions; placeholder?: string })
  | (Base & { type: "buttons"; options: (Option & { icon?: string })[] })
  | (Base & { type: "toggle" })
  | (Base & { type: "number"; min?: number; max?: number; step?: number; unit?: string; slider?: boolean })
  | (Base & { type: "length"; units?: NonNullable<Length["unit"]>[]; min?: number; max?: number })
  | (Base & { type: "color" })
  | (Base & { type: "typography" })
  | (Base & { type: "spacing" })
  | (Base & { type: "link" })
  | (Base & { type: "image" })
  | (Base & { type: "icon"; allowNone?: boolean })
  | (Base & { type: "background" })
  | (Base & { type: "border" })
  | (Base & { type: "shadow" })
  | (Base & { type: "datetime" })
  | (Base & { type: "code"; placeholder?: string; language?: "css" | "html" })
  | (Base & {
      type: "repeater";
      fields: Control[];
      itemLabel: string;
      addLabel?: string;
      newItem: () => Settings;
    });

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
  /** Extra words matched by the widget search. */
  keywords?: string;
  defaults: () => Settings;
  content: ControlGroup[];
  design: ControlGroup[];
  /** Inner markup (the wrapper element is added by the renderer). Containers render their children instead. */
  render: (s: Settings, ctx: RenderCtx) => string;
  /** Extra attributes / classes for the wrapper element. */
  wrapper?: (s: Settings, ctx: RenderCtx) => { attrs?: Record<string, string>; classes?: string[] };
  /** Scoped styles. `&` in selectors is the widget's own wrapper. */
  css?: (s: Settings, css: CssBuilder) => void;
  /** Container widgets hold other components (sections, containers, popups). */
  container?: {
    /** Element tag for the wrapper (defaults to div). */
    tag?: (s: Settings) => string;
    /** Component types that may not be dropped inside. */
    rejects?: string[];
    /** Only these parent types may hold this container ("wrapper" = page body). */
    parents?: string[];
    /** Static markup around the children, e.g. a popup's box. Must contain one element with data-pf-children. */
    inner?: { open: string; close: string };
  };
  /** May be placed directly on the page (not wrapped in a section), e.g. navbars and popups. */
  topLevel?: boolean;
  /** Text that can be edited directly on the canvas (double-click). */
  inline?: { selector: string; key: string; plain?: boolean };
  /** Skip the Advanced tab's spacing group (e.g. sections manage their own padding). */
  noAdvancedSpacing?: boolean;
}

export interface RenderCtx {
  /** Unique id of this widget instance (also used to scope its CSS). */
  uid: string;
}

export interface CssBuilder {
  /** Plain declarations for one device (desktop = no media query). */
  rule(selector: string, decls: Decls, device?: Device): void;
  /** Declarations from a responsive value: called once per device that has a value. */
  responsive<T>(selector: string, value: Responsive<T> | undefined, toDecls: (v: T) => Decls): void;
  /** Raw CSS appended as-is (already scoped by the caller). */
  raw(css: string): void;
}

export type Decls = Record<string, string | number | undefined | null | false>;

export function defineWidget(def: WidgetDef): WidgetDef {
  return def;
}
