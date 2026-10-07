/**
 * Prebuilt sections and page templates, written as widget trees. A tree can be turned into
 * - editor markup (data-pf-widget + data-pf-settings, parsed into editable widgets), or
 * - rendered HTML + CSS (for template previews), using the same pure widget renderers as the editor.
 */
import { DASHBOARD, FUNNEL } from "./illustrations";
import { getWidget, type Settings, widgetCss, widgetHtml } from "./widgets";
import { inDays } from "./widgets/content";

export interface Node {
  type: string;
  s?: Settings;
  c?: Node[];
}

export const h = (type: string, s: Settings = {}, c?: Node[]): Node => ({ type, s, ...(c ? { c } : {}) });

const attrJson = (s: Settings) => JSON.stringify(s).replace(/&/g, "&amp;").replace(/'/g, "&#39;");

/** Markup the editor parses into widgets (settings travel in data-pf-settings). */
export function toEditorHtml(nodes: Node[]): string {
  return nodes
    .map((n) => `<div data-pf-widget="${n.type}" data-pf-settings='${attrJson(n.s ?? {})}'>${n.c ? toEditorHtml(n.c) : ""}</div>`)
    .join("");
}

/** Final HTML + CSS, as a published page would have it. */
export function toRendered(nodes: Node[], prefix = "t"): { html: string; css: string } {
  let i = 0;
  const css: string[] = [];
  const walk = (list: Node[]): string =>
    list
      .map((n) => {
        const def = getWidget(n.type);
        if (!def) return "";
        const s = { ...def.defaults(), ...n.s };
        const uid = `${prefix}${(i++).toString(36)}`;
        css.push(widgetCss(def, s, uid));
        return widgetHtml(def, s, uid, def.container ? walk(n.c ?? []) : undefined);
      })
      .join("");
  return { html: walk(nodes), css: css.join("") };
}

/* ── Small building blocks ── */

const eyebrow = (text: string, align = "left", color = "global:primary") =>
  h("heading", { html: text, tag: "p", align: { desktop: align }, color, typography: { size: { desktop: 13 }, weight: "700", letterSpacing: 1.6, transform: "uppercase" } });

const heading = (html: string, tag = "h2", align = "left", extra: Settings = {}) => h("heading", { html, tag, align: { desktop: align }, ...extra });

const lead = (text: string, align = "left", extra: Settings = {}) =>
  h("text", { html: `<p>${text}</p>`, align: { desktop: align }, typography: { size: { desktop: 19, mobile: 17 }, lineHeight: { desktop: 1.6 } }, color: "global:text", ...extra });

const button = (text: string, url = "#signup", extra: Settings = {}) => h("button", { text, link: { url }, size: "lg", ...extra });

const row = (children: Node[], extra: Settings = {}) =>
  h("container", { direction: { desktop: "row", mobile: "column" }, gap: { desktop: 48, mobile: 28 }, align: { desktop: "center" }, ...extra }, children);

const col = (children: Node[], extra: Settings = {}) => h("container", { gap: { desktop: 18 }, ...extra }, children);

const grid = (cols: [number, number, number], children: Node[], extra: Settings = {}) =>
  h("container", { layout: "grid", columns: { desktop: cols[0], tablet: cols[1], mobile: cols[2] }, gap: { desktop: 28 }, ...extra }, children);

const section = (children: Node[], extra: Settings = {}) => h("section", extra, children);

const SOFT = { background: { type: "color", color: "#f5f7ff" } };
const DARK = { background: { type: "color", color: "#0f172a" }, textColor: "#f8fafc" };
const BRAND = { background: { type: "color", color: "global:primary" }, textColor: "#ffffff" };
const center = (s: Settings = {}) => ({ align: { desktop: "center" }, ...s });

const centeredIntro = (eb: string, title: string, sub?: string) =>
  col([eyebrow(eb, "center"), heading(title, "h2", "center"), ...(sub ? [lead(sub, "center")] : [])], { gap: { desktop: 12 } });

/* ── Sections ── */

export const SECTIONS: Record<string, { label: string; icon: string; nodes: Node[] }> = {
  navbar: { label: "Header / Nav", icon: "menu", nodes: [h("navbar")] },

  heroSplit: {
    label: "Hero (split)",
    icon: "layout-grid",
    nodes: [
      section(
        [
          row([
            col(
              [
                eyebrow("New for 2026"),
                heading('Launch pages that <span class="gpb-gradient-text">actually convert</span>', "h1", "left", { _anim: "fade-up" }),
                lead("Build stunning, high-converting landing pages with advanced widgets, animations and pixel-perfect responsive control."),
                h("container", { direction: { desktop: "row" }, gap: { desktop: 12 }, wrap: true }, [button("Get started"), button("Learn more", "#features", { variant: "outline" })]),
                h("star-rating", { rating: 4.9, label: "4.9 from 2,300+ reviews" }),
              ],
              { gap: { desktop: 20 } },
            ),
            col([h("image", { src: DASHBOARD, alt: "Product dashboard preview", imgRadius: { desktop: 16 }, imgShadow: { preset: "lg" }, _anim: "zoom-in" })]),
          ]),
        ],
        { padding: { desktop: { top: 96, bottom: 96, left: 20, right: 20 }, mobile: { top: 56, bottom: 56, left: 16, right: 16 } } },
      ),
    ],
  },

  heroCentered: {
    label: "Hero (centered)",
    icon: "monitor",
    nodes: [
      section(
        [
          eyebrow("Free masterclass", "center", "global:secondary"),
          h("animated-headline", { before: "The growth system for", words: "Coaches\nAgencies\nCreators\nConsultants", tag: "h1", align: { desktop: "center" }, color: "#ffffff" }),
          lead("Discover the exact 3-step framework we used to add $1M in pipeline without paid ads.", "center", { color: "#cbd5e1" }),
          button("Save my free seat", "#signup", { align: { desktop: "center" }, bgColor: "global:secondary", borderColor: "global:secondary" }),
        ],
        { ...DARK, contentWidth: 820, gap: { desktop: 22 }, padding: { desktop: { top: 120, bottom: 120, left: 20, right: 20 }, mobile: { top: 72, bottom: 72, left: 16, right: 16 } } },
      ),
    ],
  },

  logos: {
    label: "Logo strip",
    icon: "badge-check",
    nodes: [
      section(
        [
          h("text", { html: "<p>Trusted by 2,000+ fast-growing teams</p>", align: { desktop: "center" }, color: "global:text", typography: { size: { desktop: 15 } } }),
          h("logo-marquee"),
        ],
        { padding: { desktop: { top: 40, bottom: 40, left: 20, right: 20 } } },
      ),
    ],
  },

  features: {
    label: "Features grid",
    icon: "sparkles",
    nodes: [
      section(
        [
          centeredIntro("Features", "Everything you need to grow", "Powerful building blocks designed for marketers, not developers."),
          grid(
            [3, 2, 1],
            [
              ["zap", "Lightning fast", "Pages load in milliseconds so you never lose a visitor."],
              ["target", "Built to convert", "Countdowns, popups and social proof that drive action."],
              ["refresh-cw", "CRM connected", "Leads flow into your CRM with tags and workflows."],
              ["smartphone", "Pixel-perfect responsive", "Fine-tune every element for desktop, tablet and mobile."],
              ["sparkles", "Scroll animations", "Bring sections to life with entrance and hover effects."],
              ["layout-grid", "Templates", "Start from proven, high-converting layouts."],
            ].map(([icon, title, text], i) => h("feature", { icon, title, text, _anim: "fade-up", _animDelay: (i % 3) * 120, _hover: "lift" })),
          ),
        ],
        { ...SOFT, gap: { desktop: 40 }, _cssId: "features" },
      ),
    ],
  },

  stats: {
    label: "Stats counters",
    icon: "chart-column",
    nodes: [
      section(
        [
          grid(
            [4, 2, 2],
            [
              ["2500", "+", "Happy customers"],
              ["98", "%", "Satisfaction rate"],
              ["4.9", "/5", "Average rating"],
              ["150", "+", "Countries"],
            ].map(([number, suffix, label]) => h("counter", { number, suffix, label, numberColor: "#ffffff", labelColor: "#e0e7ff" })),
          ),
        ],
        { ...BRAND, padding: { desktop: { top: 64, bottom: 64, left: 20, right: 20 } } },
      ),
    ],
  },

  tabs: {
    label: "Tabs + image",
    icon: "folder",
    nodes: [
      section([
        row([
          col([eyebrow("How it works"), heading("One platform, every step"), h("tabs", { style: "pills" })]),
          col([h("image", { src: FUNNEL, alt: "Funnel steps", imgRadius: { desktop: 16 }, imgShadow: { preset: "lg" } })]),
        ]),
      ]),
    ],
  },

  testimonials: {
    label: "Testimonials",
    icon: "quote",
    nodes: [section([centeredIntro("Testimonials", "Loved by thousands"), h("testimonial-carousel")], { gap: { desktop: 40 }, _cssId: "testimonials" })],
  },

  pricing: {
    label: "Pricing",
    icon: "badge-percent",
    nodes: [section([centeredIntro("Pricing", "Simple, transparent pricing"), h("pricing")], { ...SOFT, gap: { desktop: 32 }, _cssId: "pricing" })],
  },

  faq: {
    label: "FAQ",
    icon: "circle-help",
    nodes: [section([centeredIntro("FAQ", "Frequently asked questions"), h("accordion", { faqSchema: true })], { contentWidth: 800, gap: { desktop: 32 }, _cssId: "faq" })],
  },

  countdown: {
    label: "Countdown",
    icon: "timer",
    nodes: [
      section(
        [
          eyebrow("Limited time", "center", "global:secondary"),
          heading("Doors close soon", "h2", "center", { color: "#ffffff" }),
          lead("Lock in founding-member pricing before the timer hits zero.", "center", { color: "#cbd5e1" }),
          h("countdown", { date: inDays(7) }),
          button("Claim my spot", "#signup", { align: { desktop: "center" }, bgColor: "global:secondary", borderColor: "global:secondary" }),
        ],
        { ...DARK, contentWidth: 820, gap: { desktop: 22 } },
      ),
    ],
  },

  beforeAfter: {
    label: "Before / After",
    icon: "image",
    nodes: [
      section([
        row([
          col([
            eyebrow("Real results"),
            heading("See the transformation"),
            lead("Drag the slider to compare. Perfect for agencies, clinics, renovations and designers."),
            h("icon-list"),
          ]),
          col([h("before-after")]),
        ]),
      ]),
    ],
  },

  video: {
    label: "Video",
    icon: "circle-play",
    nodes: [section([centeredIntro("Watch", "See it in action (2 min)"), h("video", { shadow: { preset: "lg" }, radius: { desktop: 16 } })], { ...SOFT, contentWidth: 860, gap: { desktop: 28 } })],
  },

  lead: {
    label: "Lead capture",
    icon: "mail",
    nodes: [
      section(
        [
          row([
            col([
              eyebrow("Get started"),
              heading("Claim your free strategy session"),
              lead("Fill in the form and our team will reach out within 24 hours."),
              h("icon-list"),
            ]),
            col([h("form", { boxBackground: { type: "color", color: "#ffffff" }, boxShadow: { preset: "lg" }, boxRadius: { desktop: 16 }, boxPadding: { desktop: { top: 32, right: 32, bottom: 32, left: 32 }, mobile: { top: 22, right: 22, bottom: 22, left: 22 } } })]),
          ]),
        ],
        { ...SOFT, _cssId: "signup" },
      ),
    ],
  },

  booking: {
    label: "Booking calendar",
    icon: "calendar-check",
    nodes: [section([centeredIntro("Book a call", "Pick a time that works for you", "Choose a slot below. You'll get a confirmation by email and text."), h("calendar")], { contentWidth: 960, gap: { desktop: 28 }, _cssId: "book" })],
  },

  contact: {
    label: "Contact + map",
    icon: "map-pin",
    nodes: [
      section([
        row([
          col([
            eyebrow("Visit us"),
            heading("Get in touch"),
            lead("We'd love to hear from you. Call, email or drop by."),
            h("icon-list", {
              items: [
                { icon: "phone", text: "{{location.phone}}" },
                { icon: "mail", text: "{{location.email}}" },
                { icon: "map-pin", text: "{{location.address}}" },
              ],
            }),
          ]),
          col([h("map", { address: "{{location.address}}", radius: { desktop: 16 } })]),
        ]),
      ]),
    ],
  },

  offer: {
    label: "Product offer",
    icon: "shopping-bag",
    nodes: [
      section(
        [
          row([
            col([eyebrow("Special offer"), heading("Everything you need, one simple price"), lead("Join hundreds of clients who transformed their business in 12 weeks."), h("icon-list")]),
            col([h("product", { cardShadow: { preset: "lg" } })], { width: { desktop: { value: 42, unit: "%" }, mobile: { value: 100, unit: "%" } } }),
          ]),
        ],
        SOFT,
      ),
    ],
  },

  cta: {
    label: "Call to action",
    icon: "rocket",
    nodes: [
      section(
        [
          heading("Ready to build pages your clients will love?", "h2", "center", { color: "#ffffff" }),
          lead("Start free today. No credit card required.", "center", { color: "#e0e7ff" }),
          button("Start building now", "#signup", { align: { desktop: "center" }, variant: "solid", bgColor: "#ffffff", textColor: "global:primary", borderColor: "#ffffff", _hover: "grow" }),
        ],
        { ...BRAND, contentWidth: 820, gap: { desktop: 18 } },
      ),
    ],
  },

  footer: {
    label: "Footer",
    icon: "layers",
    nodes: [
      section(
        [
          row(
            [
              col([
                heading('Brand<span style="color:var(--gpb-primary)">.</span>', "p", "left", { color: "#ffffff", typography: { size: { desktop: 22 }, weight: "800", font: "heading" } }),
                h("text", { html: "<p>© 2026 Brand Inc. All rights reserved.</p>", color: "#94a3b8", typography: { size: { desktop: 14 } } }),
              ]),
              h("social-icons", { align: { desktop: "right", mobile: "left" }, shape: "circle" }),
            ],
            { justify: { desktop: "space-between" } },
          ),
        ],
        { ...DARK, tag: "footer", padding: { desktop: { top: 48, bottom: 48, left: 20, right: 20 } } },
      ),
    ],
  },

  exitPopup: {
    label: "Exit-intent popup",
    icon: "bell",
    nodes: [
      h("popup", { popupId: "exit-offer", exitIntent: true, frequency: "day" }, [
        eyebrow("Wait!", "center"),
        heading("Get 20% off today", "h2", "center"),
        lead("Join the list and we'll send your discount code instantly.", "center"),
        h("form", {
          fields: [
            { type: "text", label: "First name", map: "firstName", required: true },
            { type: "email", label: "Email", map: "email", required: true },
          ],
          submitText: "Send my code",
          tags: "exit-popup",
          note: "",
        }),
      ]),
    ],
  },
};

const pick = (...keys: (keyof typeof SECTIONS)[]) => keys.flatMap((k) => SECTIONS[k].nodes);

/* ── Page templates ── */

export interface Blueprint {
  id: string;
  name: string;
  category: string;
  description: string;
  nodes: Node[];
}

export const BLUEPRINTS: Blueprint[] = [
  { id: "blank", name: "Blank page", category: "Basic", description: "Start from scratch with an empty section.", nodes: [section([])] },
  {
    id: "saas",
    name: "SaaS / Product launch",
    category: "Business",
    description: "Sticky nav, hero, features, stats, tabs, testimonials, pricing toggle, FAQ and lead form.",
    nodes: pick("navbar", "heroSplit", "logos", "features", "stats", "tabs", "testimonials", "pricing", "faq", "lead", "footer"),
  },
  {
    id: "webinar",
    name: "Webinar / Masterclass",
    category: "Events",
    description: "Animated headline, countdown, video, registration form and FAQ.",
    nodes: pick("heroCentered", "countdown", "video", "lead", "faq", "footer"),
  },
  {
    id: "agency",
    name: "Local business / Agency",
    category: "Local business",
    description: "Before/after slider, counters, reviews, contact map, exit-intent popup and booking form.",
    nodes: pick("navbar", "heroSplit", "beforeAfter", "stats", "testimonials", "contact", "lead", "cta", "footer", "exitPopup"),
  },
  {
    id: "coach",
    name: "Coach / Consultant booking",
    category: "Services",
    description: "Hero, offer card, testimonials, FAQ and a HighLevel booking calendar.",
    nodes: pick("navbar", "heroCentered", "offer", "testimonials", "booking", "faq", "footer"),
  },
  {
    id: "optin",
    name: "Lead magnet opt-in",
    category: "Lead generation",
    description: "A focused one-screen opt-in with social proof and a thank-you redirect.",
    nodes: pick("lead", "logos", "footer"),
  },
];
