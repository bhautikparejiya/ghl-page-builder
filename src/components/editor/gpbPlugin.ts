import type { Component, Editor } from "grapesjs";
import { popupWithForm, S, W } from "@/lib/sections";

export interface GpbPluginOptions {
  getWorkflows: () => { id: string; name: string }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type TraitDef = Record<string, any>;

const opt = (id: string, label: string) => ({ id, label });

/** Elementor-style "Advanced" settings available on every element. */
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

/* Small stroke icons for the block library */
const ico = (d: string) =>
  `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  section: ico('<rect x="3" y="5" width="18" height="14" rx="2"/>'),
  col2: ico('<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>'),
  col3: ico('<rect x="2" y="5" width="6" height="14" rx="1"/><rect x="9" y="5" width="6" height="14" rx="1"/><rect x="16" y="5" width="6" height="14" rx="1"/>'),
  col4: ico('<rect x="2" y="5" width="4" height="14" rx="1"/><rect x="7.3" y="5" width="4" height="14" rx="1"/><rect x="12.6" y="5" width="4" height="14" rx="1"/><rect x="18" y="5" width="4" height="14" rx="1"/>'),
  colWide: ico('<rect x="3" y="5" width="6" height="14" rx="1"/><rect x="11" y="5" width="10" height="14" rx="1"/>'),
  card: ico('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>'),
  heading: ico('<path d="M6 4v16M18 4v16M6 12h12"/>'),
  text: ico('<path d="M4 6h16M4 10h16M4 14h10M4 18h13"/>'),
  button: ico('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/>'),
  image: ico('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-8 8"/>'),
  video: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>'),
  list: ico('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'),
  divider: ico('<path d="M3 12h18"/>'),
  spacer: ico('<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>'),
  gradient: ico('<path d="M4 18 10 6l6 12M6.5 13h7"/><path d="M18 6v12"/>'),
  typing: ico('<path d="M4 7V5h12v2M10 5v14M7 19h6M18 10v9"/>'),
  tabs: ico('<path d="M3 8h6V5h6v3h6v11H3z"/>'),
  accordion: ico('<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="9" rx="1"/><path d="M15 6.5h3"/>'),
  counter: ico('<path d="M4 17V7l3 3M10 7h4l-4 10h4M17 7h3v10"/>'),
  countdown: ico('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
  beforeAfter: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18"/><path d="m9 12-2 0M15 12h2"/>'),
  carousel: ico('<rect x="6" y="5" width="12" height="14" rx="2"/><path d="M3 8v8M21 8v8"/>'),
  testimonial: ico('<path d="M5 6h14v10H9l-4 3z"/><path d="M9 10h6"/>'),
  feature: ico('<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
  pricing: ico('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v10M14.5 9H11a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H9.5"/>'),
  progress: ico('<rect x="3" y="6" width="18" height="4" rx="2"/><rect x="3" y="14" width="18" height="4" rx="2"/><path d="M3 8h12M3 16h7"/>'),
  flip: ico('<rect x="4" y="4" width="11" height="14" rx="2"/><path d="M18 7v12a2 2 0 0 1-2 2H8"/>'),
  marquee: ico('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
  nav: ico('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M6 6.5h4M14 6.5h1M17 6.5h1"/>'),
  form: ico('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>'),
  popup: ico('<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  hero: ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 9h7M6 12h5M6 15h3"/><rect x="15" y="9" width="3" height="6"/>'),
  footer: ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18"/>'),
  faq: ico('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01"/>'),
  cta: ico('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m11 10 4 2-4 2z"/>'),
};

export default function gpbPlugin(editor: Editor, opts: GpbPluginOptions) {
  const dc = editor.DomComponents;
  const tm = editor.TraitManager;

  /* ── Custom trait: date/time picker ── */
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

  /* ── Widget component types (detected by data-gpb="...") ── */
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

  /* ── Lead form connected to HighLevel ── */
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

  /* ── Add "Advanced" traits to every selected element ── */
  editor.on("component:selected", (c: Component) => {
    if (!c || c.get("type") === "wrapper" || c.get("type") === "textnode") return;
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

  /* ── Block library ── */
  const bm = editor.BlockManager;
  const add = (id: string, label: string, category: string, media: string, content: string | object) =>
    bm.add(id, { label, category, media, content: content as any });

  const L = "Layout";
  add("gpb-section", "Section", L, I.section, `<section class="gpb-section"><div class="gpb-container"></div></section>`);
  add("gpb-2col", "2 Columns", L, I.col2, `<div class="gpb-row"><div class="gpb-col"></div><div class="gpb-col"></div></div>`);
  add("gpb-3col", "3 Columns", L, I.col3, `<div class="gpb-row"><div class="gpb-col"></div><div class="gpb-col"></div><div class="gpb-col"></div></div>`);
  add("gpb-4col", "4 Columns", L, I.col4, `<div class="gpb-row"><div class="gpb-col"></div><div class="gpb-col"></div><div class="gpb-col"></div><div class="gpb-col"></div></div>`);
  add("gpb-col-wide", "1/3 + 2/3", L, I.colWide, `<div class="gpb-row"><div class="gpb-col"></div><div class="gpb-col" style="flex-grow:2"></div></div>`);
  add("gpb-card", "Card", L, I.card, W.card);

  const B = "Basic";
  add("gpb-heading", "Heading", B, I.heading, W.heading);
  add("gpb-text", "Text", B, I.text, W.text);
  add("gpb-button", "Button", B, I.button, W.button);
  add("gpb-buttons", "Button group", B, I.button, W.buttonGroup);
  add("gpb-image", "Image", B, I.image, { type: "image", src: "https://picsum.photos/seed/gpb-new/1000/650", attributes: { class: "gpb-img-round", alt: "" }, activate: true });
  add("gpb-video", "Video", B, I.video, W.video);
  add("gpb-icon-list", "Icon list", B, I.list, W.iconList);
  add("gpb-divider", "Divider", B, I.divider, W.divider);
  add("gpb-spacer", "Spacer", B, I.spacer, W.spacer);
  add("gpb-gradient", "Gradient heading", B, I.gradient, W.gradientHeading);

  const X = "Widgets";
  add("gpb-w-tabs", "Tabs", X, I.tabs, W.tabs);
  add("gpb-w-accordion", "Accordion", X, I.accordion, W.accordion());
  add("gpb-w-counter", "Counter", X, I.counter, W.counter());
  add("gpb-w-countdown", "Countdown", X, I.countdown, W.countdown());
  add("gpb-w-ba", "Before / After", X, I.beforeAfter, W.beforeAfter);
  add("gpb-w-carousel", "Carousel", X, I.carousel, S.testimonials.replace(/^<section[^>]*><div class="gpb-container">[\s\S]*?(<div class="gpb-carousel")/, "$1").replace(/<\/div><\/section>$/, ""));
  add("gpb-w-testimonial", "Testimonial", X, I.testimonial, W.testimonial());
  add("gpb-w-feature", "Feature box", X, I.feature, W.feature());
  add("gpb-w-pricing", "Pricing table", X, I.pricing, S.pricing.replace(/^<section[^>]*><div class="gpb-container">/, "").replace(/<\/div><\/section>$/, ""));
  add("gpb-w-progress", "Progress bars", X, I.progress, W.progress);
  add("gpb-w-typing", "Typing headline", X, I.typing, W.typing);
  add("gpb-w-flip", "Flip box", X, I.flip, W.flipBox);
  add("gpb-w-marquee", "Logo marquee", X, I.marquee, W.marquee);
  add("gpb-w-nav", "Navbar", X, I.nav, S.navbar);

  const F = "Forms & Popups";
  add("gpb-f-form", "Lead form", F, I.form, W.form());
  add("gpb-f-popup", "Popup + button", F, I.popup, popupWithForm());

  const P = "Sections";
  const sections: [string, string, string, string][] = [
    ["navbar", "Header / Nav", I.nav, S.navbar],
    ["hero-split", "Hero (split)", I.hero, S.heroSplit],
    ["hero-center", "Hero (centered)", I.hero, S.heroCentered],
    ["logos", "Logo strip", I.marquee, S.logos],
    ["features", "Features grid", I.feature, S.features],
    ["stats", "Stats counters", I.counter, S.stats],
    ["tabs", "Tabs + image", I.tabs, S.tabsSection],
    ["testimonials", "Testimonials", I.testimonial, S.testimonials],
    ["pricing", "Pricing", I.pricing, S.pricing],
    ["faq", "FAQ", I.faq, S.faq],
    ["countdown", "Countdown", I.countdown, S.countdownSection],
    ["before-after", "Before / After", I.beforeAfter, S.beforeAfterSection],
    ["video", "Video", I.video, S.videoSection],
    ["lead", "Lead capture", I.form, S.leadForm],
    ["cta", "Call to action", I.cta, S.cta],
    ["footer", "Footer", I.footer, S.footer],
  ];
  for (const [id, label, media, html] of sections) add(`gpb-s-${id}`, label, P, media, html);
}

export { GLOBAL_NAMES };
