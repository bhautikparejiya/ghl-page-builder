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

const card = (children: Node[], extra: Settings = {}) =>
  h(
    "container",
    {
      gap: { desktop: 16 },
      background: { type: "color", color: "global:background" },
      border: { style: "solid", width: 1, color: "#e5e7eb" },
      radius: { desktop: 16 },
      shadow: { preset: "sm" },
      padding: { desktop: { top: 28, right: 28, bottom: 28, left: 28 } },
      _hover: "lift",
      ...extra,
    },
    children,
  );

const SOFT = { background: { type: "color", color: "#f5f7ff" } };
const DARK = { background: { type: "color", color: "#0f172a" }, textColor: "#f8fafc" };
const BRAND = { background: { type: "color", color: "global:primary" }, textColor: "#ffffff" };
const center = (s: Settings = {}) => ({ align: { desktop: "center" }, ...s });

const centeredIntro = (eb: string, title: string, sub?: string) =>
  col([eyebrow(eb, "center"), heading(title, "h2", "center"), ...(sub ? [lead(sub, "center")] : [])], { gap: { desktop: 12 } });

/* ── Sections ── */

/* ── Footer building blocks (also used by the site-footer starter) ── */

const smallText = (html: string, color = "#94a3b8", align = "left") =>
  h("text", { html: `<p>${html}</p>`, color, align: { desktop: align }, typography: { size: { desktop: 14 } } });

const footerColumn = (title: string, items: { text: string; url?: string; icon?: string }[]) =>
  col(
    [
      heading(title, "p", "left", { color: "#ffffff", typography: { size: { desktop: 15 }, weight: "700" } }),
      h("icon-list", {
        icon: "chevron-right",
        iconColor: "#64748b",
        textColor: "#cbd5e1",
        gap: { desktop: 8 },
        typography: { size: { desktop: 14 } },
        items: items.map((i) => ({ text: i.text, ...(i.icon ? { icon: i.icon } : {}), ...(i.url ? { link: { url: i.url } } : {}) })),
      }),
    ],
    { gap: { desktop: 12 } },
  );

const COLUMNS_FOOTER: Node[] = [
        section(
          [
            grid(
              [4, 2, 1],
              [
                col([
                  heading('Brand<span style="color:var(--gpb-primary)">.</span>', "p", "left", { color: "#ffffff", typography: { size: { desktop: 22 }, weight: "800", font: "heading" } }),
                  smallText("We help growing businesses turn visitors into customers."),
                  h("social-icons", { shape: "circle" }),
                ]),
                footerColumn("Company", [{ text: "About", url: "#" }, { text: "Services", url: "#" }, { text: "Careers", url: "#" }]),
                footerColumn("Resources", [{ text: "Blog", url: "#" }, { text: "FAQ", url: "#faq" }, { text: "Privacy policy", url: "#" }]),
                footerColumn("Contact", [
                  { text: "{{location.phone}}", icon: "phone" },
                  { text: "{{location.email}}", icon: "mail" },
                  { text: "{{location.address}}", icon: "map-pin" },
                ]),
              ],
              { gap: { desktop: 40, mobile: 28 } },
            ),
            h("divider", { color: "#1e293b", gap: { desktop: 8 } }),
            smallText("© 2026 {{location.name}}. All rights reserved.", "#64748b", "center"),
          ],
          { ...DARK, tag: "footer", gap: { desktop: 28 }, padding: { desktop: { top: 64, bottom: 32, left: 20, right: 20 } } },
        ),
      ];

/** Picker / AI categories, in display order. */
export const SECTION_CATEGORIES = [
  "Header",
  "Hero",
  "Features",
  "About",
  "Social proof",
  "Pricing",
  "Call to action",
  "Forms & booking",
  "Media",
  "FAQ",
  "Urgency",
  "Contact",
  "Footer",
  "Popups",
] as const;

export type SectionCategory = (typeof SECTION_CATEGORIES)[number];

export interface SectionBlueprint {
  label: string;
  icon: string;
  category: SectionCategory;
  description: string;
  nodes: Node[];
}

/** Ready-made sections, built only from widgets so people (and AI tools) can edit every part. */
export const SECTIONS: Record<string, SectionBlueprint> = {
  navbar: { label: "Header / Nav", icon: "menu", category: "Header", description: "Sticky navbar with logo, links and a call-to-action button.", nodes: [h("navbar")] },

  heroSplit: {
    label: "Hero (split)",
    icon: "layout-grid",
    category: "Hero",
    description: "Headline, text and buttons beside a product image.",
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
    category: "Hero",
    description: "Dark, centered hero with a rotating animated headline.",
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
    category: "Social proof",
    description: "A scrolling strip of customer or partner logos.",
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
    category: "Features",
    description: "Six feature boxes with icons in a responsive grid.",
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
    category: "Social proof",
    description: "Four animated number counters on a brand-color band.",
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
    category: "Features",
    description: "Tabbed content next to an image.",
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
    category: "Social proof",
    description: "Testimonial slider with photos and star ratings.",
    nodes: [section([centeredIntro("Testimonials", "Loved by thousands"), h("testimonial-carousel")], { gap: { desktop: 40 }, _cssId: "testimonials" })],
  },

  pricing: {
    label: "Pricing",
    icon: "badge-percent",
    category: "Pricing",
    description: "Pricing table with a monthly / yearly toggle.",
    nodes: [section([centeredIntro("Pricing", "Simple, transparent pricing"), h("pricing")], { ...SOFT, gap: { desktop: 32 }, _cssId: "pricing" })],
  },

  faq: {
    label: "FAQ",
    icon: "circle-help",
    category: "FAQ",
    description: "Accordion of questions with FAQ structured data for search engines.",
    nodes: [section([centeredIntro("FAQ", "Frequently asked questions"), h("accordion", { faqSchema: true })], { contentWidth: 800, gap: { desktop: 32 }, _cssId: "faq" })],
  },

  countdown: {
    label: "Countdown",
    icon: "timer",
    category: "Urgency",
    description: "Countdown timer with a headline and a button.",
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
    category: "Media",
    description: "Before / after comparison slider with a checklist.",
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
    category: "Media",
    description: "Centered video with a short intro.",
    nodes: [section([centeredIntro("Watch", "See it in action (2 min)"), h("video", { shadow: { preset: "lg" }, radius: { desktop: 16 } })], { ...SOFT, contentWidth: 860, gap: { desktop: 28 } })],
  },

  lead: {
    label: "Lead capture",
    icon: "mail",
    category: "Forms & booking",
    description: "Lead form card beside a headline and checklist.",
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
    category: "Forms & booking",
    description: "HighLevel booking calendar with an intro.",
    nodes: [section([centeredIntro("Book a call", "Pick a time that works for you", "Choose a slot below. You'll get a confirmation by email and text."), h("calendar")], { contentWidth: 960, gap: { desktop: 28 }, _cssId: "book" })],
  },

  contact: {
    label: "Contact + map",
    icon: "map-pin",
    category: "Contact",
    description: "Phone, email and address with a map, filled from the sub-account.",
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
    category: "Pricing",
    description: "A product card with buy button beside the offer details.",
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
    category: "Call to action",
    description: "Centered headline and button on a brand-color band.",
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
    category: "Footer",
    description: "Dark footer with brand, copyright and social icons.",
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

  heroImage: {
    label: "Hero (background image)",
    icon: "image",
    category: "Hero",
    description: "Full-width photo with a dark overlay, headline and two buttons.",
    nodes: [
      section(
        [
          eyebrow("Award-winning service", "center", "#ffffff"),
          heading("Your headline goes right here", "h1", "center", { color: "#ffffff", _anim: "fade-up" }),
          lead("One or two sentences that tell visitors exactly what you do and why it matters to them.", "center", { color: "#e2e8f0" }),
          h("container", { direction: { desktop: "row" }, justify: { desktop: "center" }, gap: { desktop: 12 }, wrap: true }, [
            button("Book a free call"),
            button("See our work", "#features", { variant: "outline", textColor: "#ffffff", borderColor: "#ffffff" }),
          ]),
        ],
        {
          background: { type: "image", image: { url: "https://picsum.photos/seed/pf-hero/1600/900", size: "cover", position: "center center" }, overlay: { color: "#0f172a", opacity: 0.65 } },
          contentWidth: 860,
          minHeight: { desktop: { value: 80, unit: "vh" }, mobile: { value: 70, unit: "vh" } },
          vAlign: "center",
          gap: { desktop: 22 },
        },
      ),
    ],
  },

  heroForm: {
    label: "Hero with form",
    icon: "mail",
    category: "Hero",
    description: "Headline and benefits on the left, a lead form on the right. Ideal for opt-in pages.",
    nodes: [
      section(
        [
          row([
            col([
              eyebrow("Free guide", "left", "global:secondary"),
              heading("Get the 7-step plan to double your leads", "h1", "left", { color: "#ffffff" }),
              lead("Download the exact playbook we use with our clients. It takes 10 minutes to read.", "left", { color: "#cbd5e1" }),
              h("icon-list", {
                iconColor: "global:secondary",
                textColor: "#e2e8f0",
                items: [{ text: "Proven step-by-step checklist" }, { text: "Real examples from local businesses" }, { text: "Free templates you can copy" }],
              }),
            ]),
            col(
              [
                h("form", {
                  fields: [
                    { type: "text", label: "First name", map: "firstName", placeholder: "Jane", required: true },
                    { type: "email", label: "Email", map: "email", placeholder: "jane@company.com", required: true },
                  ],
                  submitText: "Send me the guide",
                  tags: "lead-magnet",
                  fullWidthButton: true,
                  // The section's text is white; the form card is white.
                  labelColor: "#334155",
                  boxBackground: { type: "color", color: "#ffffff" },
                  boxShadow: { preset: "xl" },
                  boxRadius: { desktop: 16 },
                  boxPadding: { desktop: { top: 32, right: 32, bottom: 32, left: 32 }, mobile: { top: 22, right: 22, bottom: 22, left: 22 } },
                }),
              ],
              { width: { desktop: { value: 42, unit: "%" }, mobile: { value: 100, unit: "%" } } },
            ),
          ]),
        ],
        { ...DARK, _cssId: "signup", padding: { desktop: { top: 96, bottom: 96, left: 20, right: 20 }, mobile: { top: 56, bottom: 56, left: 16, right: 16 } } },
      ),
    ],
  },

  featuresAlternating: {
    label: "Features (alternating)",
    icon: "layers",
    category: "Features",
    description: "Image and text rows that swap sides, for explaining features in depth.",
    nodes: [
      section(
        [
          centeredIntro("How it helps", "Built around the way you work"),
          ...[
            ["pf-feat-1", "Capture every lead", "Forms, popups and booking calendars send contacts straight to your CRM with the right tags.", false],
            ["pf-feat-2", "Follow up automatically", "Trigger workflows the moment someone signs up, so no lead goes cold.", true],
            ["pf-feat-3", "See what converts", "Run A/B tests on any section and keep the version that wins.", false],
          ].map(([seed, title, text, flip]) => {
            const image = col([h("image", { src: `https://picsum.photos/seed/${seed}/900/650`, alt: String(title), imgRadius: { desktop: 16 }, imgShadow: { preset: "md" } })]);
            const copy = col([heading(String(title), "h3"), lead(String(text)), h("button", { text: "Learn more →", link: { url: "#signup" }, variant: "ghost" })]);
            return row(flip ? [copy, image] : [image, copy]);
          }),
        ],
        { gap: { desktop: 72, mobile: 48 }, _cssId: "features" },
      ),
    ],
  },

  services: {
    label: "Services cards",
    icon: "briefcase",
    category: "Features",
    description: "Three service cards with an icon, short text and a link.",
    nodes: [
      section(
        [
          centeredIntro("Services", "What we can do for you", "Pick a service to see how it works and what it costs."),
          grid(
            [3, 1, 1],
            [
              ["megaphone", "Marketing", "Campaigns that bring qualified leads to your door every month."],
              ["palette", "Branding & design", "A look that makes you the obvious choice in your market."],
              ["code", "Websites & funnels", "Fast pages that turn visitors into booked calls."],
            ].map(([icon, title, text]) =>
              card([
                h("icon", { icon, size: { desktop: 26 }, color: "global:primary", shape: "circle", bgColor: "#eef2ff", pad: 14 }),
                heading(title, "h3", "left", { typography: { size: { desktop: 22 } } }),
                h("text", { html: `<p>${text}</p>`, color: "global:text" }),
                h("button", { text: "Learn more →", link: { url: "#" }, variant: "ghost" }),
              ]),
            ),
          ),
        ],
        { ...SOFT, gap: { desktop: 40 }, _cssId: "services" },
      ),
    ],
  },

  steps: {
    label: "Process steps",
    icon: "list-checks",
    category: "Features",
    description: "Three numbered steps that explain how working with you goes.",
    nodes: [
      section(
        [
          centeredIntro("How it works", "Three simple steps"),
          grid(
            [3, 1, 1],
            [
              ["1", "Book a call", "Pick a time that suits you. It's free and there's no obligation."],
              ["2", "Get your plan", "We map out exactly what to do, with clear prices and timelines."],
              ["3", "See results", "We get to work and keep you updated every step of the way."],
            ].map(([n, title, text], i) =>
              col(
                [
                  heading(n, "p", "center", {
                    color: "#ffffff",
                    typography: { size: { desktop: 22 }, weight: "800" },
                    _padding: { desktop: { top: 12, right: 0, bottom: 12, left: 0 } },
                    _customCss: "& { width: 56px; height: 56px; margin: 0 auto; border-radius: 50%; background: var(--gpb-primary); }",
                  }),
                  heading(title, "h3", "center", { typography: { size: { desktop: 21 } } }),
                  h("text", { html: `<p>${text}</p>`, align: { desktop: "center" }, color: "global:text" }),
                ],
                { gap: { desktop: 14 }, _anim: "fade-up", _animDelay: i * 120 },
              ),
            ),
          ),
          button("Get started", "#signup", { align: { desktop: "center" } }),
        ],
        { gap: { desktop: 44 } },
      ),
    ],
  },

  about: {
    label: "About us",
    icon: "users",
    category: "About",
    description: "Photo beside your story, with three key numbers.",
    nodes: [
      section([
        row([
          col([h("image", { src: "https://picsum.photos/seed/pf-about/900/1000", alt: "Our team at work", imgRadius: { desktop: 16 }, imgShadow: { preset: "md" } })]),
          col([
            eyebrow("About us"),
            heading("A local team that treats your business like our own"),
            lead("Since 2014 we've helped more than 500 businesses grow. We keep things simple, honest and focused on results you can measure."),
            grid(
              [3, 3, 3],
              [
                ["10", "+", "Years"],
                ["500", "+", "Clients"],
                ["4.9", "/5", "Rating"],
              ].map(([number, suffix, label]) => h("counter", { number, suffix, label, align: { desktop: "left" } })),
              { gap: { desktop: 16 } },
            ),
            button("Meet the team", "#team", { variant: "outline" }),
          ]),
        ]),
      ]),
    ],
  },

  team: {
    label: "Team",
    icon: "contact",
    category: "About",
    description: "Four team members with photo, name and role.",
    nodes: [
      section(
        [
          centeredIntro("Our team", "The people behind the work"),
          grid(
            [4, 2, 1],
            [
              ["Alex Morgan", "Founder & CEO", 11],
              ["Jamie Chen", "Head of Strategy", 44],
              ["Riley Brooks", "Lead Designer", 5],
              ["Sam Patel", "Client Success", 68],
            ].map(([name, role, img]) =>
              col(
                [
                  h("image", { src: `https://i.pravatar.cc/400?img=${img}`, alt: String(name), imgRadius: { desktop: 16 } }),
                  heading(String(name), "h3", "center", { typography: { size: { desktop: 19 } } }),
                  h("text", { html: `<p>${role}</p>`, align: { desktop: "center" }, color: "global:primary", typography: { size: { desktop: 14 }, weight: "600" } }),
                  h("social-icons", { align: { desktop: "center" }, shape: "", colors: "custom", iconColor: "#94a3b8", size: 16, items: [{ network: "x", url: "https://x.com" }, { network: "mail", url: "mailto:hello@example.com" }] }),
                ],
                { gap: { desktop: 10 } },
              ),
            ),
          ),
        ],
        { gap: { desktop: 40 }, _cssId: "team" },
      ),
    ],
  },

  testimonialGrid: {
    label: "Testimonials grid",
    icon: "message-square",
    category: "Social proof",
    description: "Three review cards side by side, with an overall rating.",
    nodes: [
      section(
        [
          centeredIntro("Reviews", "What our clients say"),
          h("star-rating", { rating: 4.9, label: "4.9 average from 300+ reviews", align: { desktop: "center" } }),
          grid(
            [3, 1, 1],
            [
              { quote: "They rebuilt our website in two weeks and our phone hasn't stopped ringing since.", name: "Sarah Johnson", role: "Owner, Bloom Studio", avatar: "https://i.pravatar.cc/96?img=32", rating: 5 },
              { quote: "Clear pricing, fast replies and real results. Exactly what we needed.", name: "Marcus Lee", role: "CEO, Peak Fitness", avatar: "https://i.pravatar.cc/96?img=12", rating: 5 },
              { quote: "Our booking rate doubled in the first month. Highly recommended.", name: "Priya Patel", role: "Clinic Manager", avatar: "https://i.pravatar.cc/96?img=47", rating: 5 },
            ].map((r) => h("testimonial", r)),
          ),
        ],
        { ...SOFT, gap: { desktop: 28 }, _cssId: "testimonials" },
      ),
    ],
  },

  pricingCards: {
    label: "Pricing cards",
    icon: "credit-card",
    category: "Pricing",
    description: "Three plan cards made of headings, lists and buttons, so every detail is editable.",
    nodes: [
      section(
        [
          centeredIntro("Pricing", "Plans for every stage"),
          grid(
            [3, 1, 1],
            [
              ["Starter", "$29", "For getting started", ["1 website", "5 landing pages", "Email support"], false],
              ["Growth", "$79", "Most popular", ["5 websites", "Unlimited pages", "Priority support", "A/B testing"], true],
              ["Agency", "$199", "For teams", ["Unlimited websites", "White-label", "Team seats", "Dedicated manager"], false],
            ].map(([name, price, tagline, items, featured]) =>
              card(
                [
                  heading(String(name), "h3", "left", { typography: { size: { desktop: 20 } }, ...(featured ? { color: "#ffffff" } : {}) }),
                  h("text", { html: `<p>${tagline}</p>`, color: featured ? "#c7d2fe" : "global:text", typography: { size: { desktop: 14 } } }),
                  heading(String(price), "p", "left", { typography: { size: { desktop: 44 }, weight: "800", lineHeight: { desktop: 1 } }, ...(featured ? { color: "#ffffff" } : {}) }),
                  h("text", { html: "<p>per month</p>", color: featured ? "#c7d2fe" : "global:text", typography: { size: { desktop: 14 } }, _margin: { desktop: { top: -8 } } }),
                  h("icon-list", { items: (items as string[]).map((text) => ({ text })), ...(featured ? { iconColor: "#ffffff", textColor: "#e0e7ff" } : {}) }),
                  button(`Choose ${name}`, "#signup", {
                    align: { desktop: "stretch" },
                    ...(featured ? { bgColor: "#ffffff", textColor: "global:primary", borderColor: "#ffffff" } : { variant: "outline" }),
                  }),
                ],
                featured ? { background: { type: "color", color: "global:primary" }, shadow: { preset: "xl" }, border: { style: "none" } } : {},
              ),
            ),
            { align: { desktop: "center" } },
          ),
        ],
        { ...SOFT, gap: { desktop: 40 }, _cssId: "pricing" },
      ),
    ],
  },

  ctaSplit: {
    label: "Call to action (split)",
    icon: "arrow-right",
    category: "Call to action",
    description: "Headline on the left and a button on the right, in a rounded banner.",
    nodes: [
      section([
        row(
          [
            col([heading("Ready to grow your business?", "h2", "left", { color: "#ffffff" }), lead("Book a free 20-minute strategy call today.", "left", { color: "#e0e7ff" })], { gap: { desktop: 8 } }),
            button("Book my call", "#book", { bgColor: "#ffffff", textColor: "global:primary", borderColor: "#ffffff", _hover: "grow" }),
          ],
          {
            justify: { desktop: "space-between" },
            background: { type: "gradient", gradient: { from: "global:primary", to: "global:secondary", angle: 120 } },
            radius: { desktop: 20 },
            padding: { desktop: { top: 48, right: 48, bottom: 48, left: 48 }, mobile: { top: 32, right: 24, bottom: 32, left: 24 } },
          },
        ),
      ]),
    ],
  },

  newsletter: {
    label: "Newsletter signup",
    icon: "send",
    category: "Forms & booking",
    description: "A compact email signup with one field.",
    nodes: [
      section(
        [
          heading("Get tips in your inbox", "h2", "center"),
          lead("One short email a week with ideas you can use right away. No spam.", "center"),
          h("form", {
            fields: [{ type: "email", label: "Email", map: "email", placeholder: "you@company.com", required: true }],
            submitText: "Subscribe",
            tags: "newsletter",
            successMessage: "You're in! Check your inbox.",
            note: "Unsubscribe anytime.",
            fullWidthButton: true,
          }),
        ],
        { ...SOFT, contentWidth: 560, gap: { desktop: 16 } },
      ),
    ],
  },

  gallery: {
    label: "Image gallery",
    icon: "layout-grid",
    category: "Media",
    description: "A grid of six images with a heading. Replace them with your own photos.",
    nodes: [
      section(
        [
          centeredIntro("Gallery", "Recent work"),
          grid(
            [3, 2, 1],
            [1, 2, 3, 4, 5, 6].map((n) =>
              h("image", { src: `https://picsum.photos/seed/pf-gallery-${n}/800/600`, alt: `Project ${n}`, imgRadius: { desktop: 12 }, hoverFx: "zoom", width: { desktop: { value: 100, unit: "%" } }, height: { desktop: { value: 240, unit: "px" } }, fit: "cover" }),
            ),
            { gap: { desktop: 16 } },
          ),
        ],
        { gap: { desktop: 36 }, _cssId: "gallery" },
      ),
    ],
  },

  faqSplit: {
    label: "FAQ (two columns)",
    icon: "circle-help",
    category: "FAQ",
    description: "Intro and contact button on the left, questions on the right.",
    nodes: [
      section(
        [
          row(
            [
              col(
                [eyebrow("FAQ"), heading("Questions? We've got answers."), lead("Can't find what you're looking for? Our team replies within a few hours."), button("Contact us", "#contact", { variant: "outline" })],
                { width: { desktop: { value: 38, unit: "%" }, mobile: { value: 100, unit: "%" } } },
              ),
              col([h("accordion", { faqSchema: true })]),
            ],
            { align: { desktop: "flex-start" } },
          ),
        ],
        { _cssId: "faq" },
      ),
    ],
  },

  footerColumns: {
    label: "Footer (columns)",
    icon: "layers",
    category: "Footer",
    description: "About, links and contact columns, with a copyright row.",
    nodes: COLUMNS_FOOTER,
  },

  exitPopup: {
    label: "Exit-intent popup",
    icon: "bell",
    category: "Popups",
    description: "Discount popup that opens when visitors try to leave.",
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

/* ── Site parts: starter headers and footers ── */

export const SITE_PARTS: Record<"header" | "footer", { id: string; label: string; description: string; nodes: Node[] }[]> = {
  header: [
    { id: "simple", label: "Simple navbar", description: "Logo, menu and a call-to-action button. Sticky on scroll.", nodes: [h("navbar")] },
    {
      id: "topbar",
      label: "Navbar with contact bar",
      description: "A slim bar with your phone and email above the navbar.",
      nodes: [
        section(
          [
            row(
              [
                h("icon-list", {
                  layout: "inline",
                  iconColor: "global:secondary",
                  textColor: "#e2e8f0",
                  typography: { size: { desktop: 13 } },
                  items: [
                    { icon: "phone", text: "{{location.phone}}" },
                    { icon: "mail", text: "{{location.email}}" },
                  ],
                }),
                h("social-icons", { shape: "", colors: "custom", iconColor: "#e2e8f0", size: 14, align: { desktop: "right", mobile: "left" } }),
              ],
              { justify: { desktop: "space-between" }, gap: { desktop: 16, mobile: 8 } },
            ),
          ],
          { ...DARK, padding: { desktop: { top: 8, bottom: 8, left: 20, right: 20 } }, _hideMobile: true },
        ),
        h("navbar"),
      ],
    },
    { id: "blank", label: "Blank", description: "Start from an empty section.", nodes: [section([])] },
  ],
  footer: [
    { id: "simple", label: "Simple footer", description: "Brand, copyright and social icons.", nodes: SECTIONS.footer.nodes },
    {
      id: "columns",
      label: "Footer with columns",
      description: "About, links and contact columns, with a copyright row.",
      nodes: COLUMNS_FOOTER,
    },
    { id: "blank", label: "Blank", description: "Start from an empty section.", nodes: [section([], { tag: "footer" })] },
  ],
};

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
