import type { Component, Editor } from "grapesjs";
import { SECTIONS, toEditorHtml } from "@/lib/blueprints";
import { componentType, WIDGETS } from "@/lib/widgets";
import { iconSvg } from "@/lib/widgets/render";
import { icon } from "@/lib/widgets/shared";
import { isWidget, SETTINGS_PROP, widgetBlock } from "./widgetComponents";

export interface GpbPluginOptions {
  getWorkflows: () => { id: string; name: string }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type TraitDef = Record<string, any>;

const opt = (id: string, label: string) => ({ id, label });

/**
 * "Advanced" settings for elements of pages built before schema widgets (classic elements).
 * Schema widgets have these in their own Advanced tab.
 */
const GLOBAL_TRAITS: TraitDef[] = [
  {
    type: "select",
    name: "data-gpb-anim",
    label: "Entrance animation",
    options: [
      opt("", "None"),
      opt("fade-up", "Fade up"),
      opt("fade-down", "Fade down"),
      opt("slide-left", "Slide in from right"),
      opt("slide-right", "Slide in from left"),
      opt("zoom-in", "Zoom in"),
      opt("flip-up", "Flip up"),
    ],
  },
  { type: "number", name: "data-gpb-delay", label: "Animation delay (ms)", min: 0, step: 50, placeholder: "0" },
  {
    type: "select",
    name: "data-gpb-hover",
    label: "Hover effect",
    options: [opt("", "None"), opt("lift", "Lift"), opt("grow", "Grow"), opt("glow", "Glow"), opt("tilt", "Tilt")],
  },
  {
    type: "select",
    name: "data-gpb-hide",
    label: "Hide on device",
    options: [opt("", "Always visible"), opt("desktop", "Hide on desktop"), opt("tablet", "Hide on tablet"), opt("mobile", "Hide on mobile")],
  },
  { type: "text", name: "data-gpb-open", label: "On click: open popup (id)", placeholder: "popup-offer" },
];
const GLOBAL_NAMES = GLOBAL_TRAITS.map((t) => t.name as string);

const checkbox = (name: string, label: string): TraitDef => ({ type: "checkbox", name, label, valueTrue: "true", valueFalse: "false" });

/** Library tile icon from the icon set. */
const tile = (name: string) => `<span class="gpb-tile-icon">${iconSvg(name)}</span>`;

export default function gpbPlugin(editor: Editor, opts: GpbPluginOptions) {
  const dc = editor.DomComponents;
  const tm = editor.TraitManager;

  /* ── Classic elements (pages built before schema widgets) ── */

  tm.addType("datetime", {
    createInput() {
      const el = document.createElement("input");
      el.type = "datetime-local";
      el.style.width = "100%";
      return el;
    },
    onEvent({ elInput, component, trait }: any) {
      component.addAttributes({ [trait.getName()]: (elInput as HTMLInputElement).value });
    },
    onUpdate({ elInput, component, trait }: any) {
      (elInput as HTMLInputElement).value = component.getAttributes()[trait.getName()] || "";
    },
  } as any);

  const widget = (type: string, gpb: string, traits: TraitDef[], extend?: string) =>
    dc.addType(type, {
      ...(extend ? { extend } : {}),
      isComponent: (el: HTMLElement) => !!el?.getAttribute && el.getAttribute("data-gpb") === gpb,
      model: { defaults: { name: type.replace("gpb-", "").replace(/-/g, " "), traits: ["id", ...traits] } },
    } as any);

  widget("gpb-tabs", "tabs", []);
  widget("gpb-accordion", "accordion", [checkbox("data-single", "Only one item open at a time")]);
  widget("gpb-counter", "counter", [
    { type: "text", name: "data-target", label: "Number (e.g. 2500 or 4.9)" },
    { type: "number", name: "data-duration", label: "Duration (ms)", min: 200, step: 100 },
  ]);
  widget("gpb-countdown", "countdown", [
    { type: "datetime", name: "data-date", label: "Ends at (local time)" },
    { type: "number", name: "data-evergreen", label: "Evergreen: minutes per visitor (0 = off)", min: 0 },
    { type: "text", name: "data-expired-redirect", label: "Redirect URL when expired" },
  ]);
  widget("gpb-before-after", "before-after", [{ type: "number", name: "data-start", label: "Start position (%)", min: 0, max: 100 }]);
  widget("gpb-carousel", "carousel", [
    { type: "select", name: "data-per-view", label: "Slides per view (desktop)", options: ["1", "2", "3", "4"].map((n) => opt(n, n)) },
    { type: "number", name: "data-autoplay", label: "Autoplay every (ms, 0 = off)", min: 0, step: 500 },
  ]);
  widget("gpb-pricing", "pricing", []);
  widget("gpb-progress", "progress", [{ type: "number", name: "data-value", label: "Value (%)", min: 0, max: 100 }]);
  widget("gpb-typing", "typing", [{ type: "text", name: "data-words", label: "Rotating words (separate with |)" }], "text");
  widget("gpb-modal", "modal", [
    { type: "number", name: "data-auto-open", label: "Auto-open after (seconds, 0 = off)", min: 0 },
    checkbox("data-exit-intent", "Open on exit intent (desktop)"),
    checkbox("data-once", "Auto-open only once per session"),
  ]);
  widget("gpb-navbar", "navbar", [checkbox("data-sticky", "Sticky on scroll")]);
  widget("gpb-marquee", "marquee", []);

  dc.addType("gpb-price", {
    extend: "text",
    isComponent: (el: HTMLElement) => !!el?.hasAttribute && el.hasAttribute("data-monthly"),
    model: {
      defaults: {
        name: "price",
        traits: [
          { type: "text", name: "data-monthly", label: "Monthly price" },
          { type: "text", name: "data-yearly", label: "Yearly price" },
        ],
      },
    },
  } as any);

  /* Classic lead form connected to HighLevel */
  const workflowOptions = () => [opt("", "— Don't add to a workflow —"), ...opts.getWorkflows().map((w) => opt(w.id, w.name))];
  dc.addType("gpb-form", {
    extend: "form",
    isComponent: (el: HTMLElement) => el?.tagName === "FORM" && el.hasAttribute("data-gpb-form"),
    model: {
      defaults: {
        name: "lead form",
        traits: [
          { type: "text", name: "data-tags", label: "Tags to add (comma separated)" },
          { type: "select", name: "data-workflow", label: "Add contact to workflow", options: workflowOptions() },
          { type: "text", name: "data-success", label: "Success message" },
          { type: "text", name: "data-redirect", label: "Redirect URL after submit (optional)" },
        ],
      },
      init(this: Component) {
        const id = this.getAttributes()["data-gpb-form"];
        if (!id || id === "new") this.addAttributes({ "data-gpb-form": `form-${Math.random().toString(36).slice(2, 8)}` });
      },
    },
  } as any);

  /* Add "Advanced" traits to classic elements when selected */
  editor.on("component:selected", (c: Component) => {
    // Schema widgets have their own Advanced tab.
    if (!c || c.get("type") === "wrapper" || c.get("type") === "textnode" || isWidget(c)) return;
    let changed = false;
    if (c.is("gpb-form")) {
      const t = c.getTrait("data-workflow");
      if (t) t.set("options", workflowOptions());
    }
    for (const def of GLOBAL_TRAITS) {
      if (!c.getTrait(def.name)) {
        c.addTrait(def as any);
        changed = true;
      }
    }
    if (changed) {
      // Re-select so the trait panel renders the newly added fields.
      setTimeout(() => {
        if (editor.getSelected() === c) {
          editor.select(undefined as any);
          editor.select(c);
        }
      }, 0);
    }
  });

  /* ── Widget library ── */
  const bm = editor.BlockManager;
  const L = "Layout";

  const ROW = { direction: { desktop: "row", mobile: "column" }, gap: { desktop: 32, mobile: 20 } };
  const columns = (id: string, label: string, widths: (number | null)[], media: string) =>
    bm.add(id, {
      label,
      category: L,
      media,
      content: {
        type: componentType("container"),
        [SETTINGS_PROP]: ROW,
        components: widths.map((w) => ({
          type: componentType("container"),
          [SETTINGS_PROP]: w ? { width: { desktop: { value: w, unit: "%" }, mobile: { value: 100, unit: "%" } } } : {},
        })),
      } as any,
    });

  bm.add("pf-section", widgetBlock("section", L));
  bm.add("pf-container", widgetBlock("container", L));
  columns("pf-cols-2", "2 Columns", [null, null], icon('<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>'));
  columns(
    "pf-cols-3",
    "3 Columns",
    [null, null, null],
    icon('<rect x="2" y="5" width="6" height="14" rx="1"/><rect x="9" y="5" width="6" height="14" rx="1"/><rect x="16" y="5" width="6" height="14" rx="1"/>'),
  );
  columns(
    "pf-cols-4",
    "4 Columns",
    [null, null, null, null],
    icon('<rect x="2" y="5" width="4" height="14" rx="1"/><rect x="7.3" y="5" width="4" height="14" rx="1"/><rect x="12.6" y="5" width="4" height="14" rx="1"/><rect x="18" y="5" width="4" height="14" rx="1"/>'),
  );
  columns("pf-cols-1-2", "1/3 + 2/3", [32, null], icon('<rect x="3" y="5" width="6" height="14" rx="1"/><rect x="11" y="5" width="10" height="14" rx="1"/>'));
  columns("pf-cols-2-1", "2/3 + 1/3", [null, 32], icon('<rect x="3" y="5" width="10" height="14" rx="1"/><rect x="15" y="5" width="6" height="14" rx="1"/>'));
  bm.add(
    "pf-card",
    widgetBlock("container", L, {
      label: "Card",
      media: icon('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>'),
      settings: {
        background: { type: "color", color: "global:background" },
        border: { style: "solid", width: 1, color: "#e5e7eb" },
        radius: { desktop: 16 },
        shadow: { preset: "sm" },
        padding: { desktop: { top: 28, right: 28, bottom: 28, left: 28 } },
      },
      components: [
        { type: componentType("heading"), [SETTINGS_PROP]: { html: "Card title", tag: "h3" } },
        { type: componentType("text"), [SETTINGS_PROP]: { html: "<p>Use cards to group related content. Drop any widget inside.</p>" } },
      ],
    }),
  );

  // Every other widget, in its own category.
  for (const def of WIDGETS) {
    if (def.type === "section" || def.type === "container") continue;
    bm.add(componentType(def.type), widgetBlock(def.type, def.category === "Layout" ? L : def.category));
  }
  // A ready-made button pair.
  bm.add(
    "pf-buttons",
    widgetBlock("container", "Basic", {
      label: "Button group",
      media: icon('<rect x="2" y="9" width="9" height="6" rx="3"/><rect x="13" y="9" width="9" height="6" rx="3"/>'),
      settings: { direction: { desktop: "row" }, gap: { desktop: 12 }, wrap: true },
      components: [
        { type: componentType("button"), [SETTINGS_PROP]: { text: "Get started", link: { url: "#" }, size: "lg", variant: "solid" } },
        { type: componentType("button"), [SETTINGS_PROP]: { text: "Learn more", link: { url: "#" }, size: "lg", variant: "outline" } },
      ],
    }),
  );

  for (const [id, sec] of Object.entries(SECTIONS)) {
    bm.add(`pf-s-${id}`, { label: sec.label, category: "Sections", media: tile(sec.icon), content: toEditorHtml(sec.nodes) });
  }
}

export { GLOBAL_NAMES };
