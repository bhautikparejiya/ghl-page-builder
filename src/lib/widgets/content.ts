import { color, px, typography } from "./css";
import { buttonHtml } from "./button";
import { esc, iconSvg, linkAttrs, safeSrc, sanitizeRich, textToHtml } from "./render";
import { ALIGN3, boxControls, boxCss, FLEX_ALIGN, icon, list, num, opts, str } from "./shared";
import { type CssBuilder, defineWidget, type LinkValue, type Responsive, type Settings, type Typography } from "./types";

const stars = (n: number) => (n > 0 ? `<div class="gpb-stars" aria-label="${n} out of 5 stars">${"★".repeat(Math.round(Math.min(5, n)))}</div>` : "");

/* ── Tabs ── */

export const tabs = defineWidget({
  type: "tabs",
  label: "Tabs",
  icon: icon('<path d="M3 8h6V5h6v3h6v11H3z"/>'),
  category: "Widgets",
  keywords: "tabbed panels switcher",
  defaults: () => ({
    items: [
      { title: "Overview", html: "<p>Overview content. Edit each tab in the Content tab on the right.</p>" },
      { title: "Features", html: "<p>Feature content goes here.</p>" },
      { title: "Results", html: "<p>Results content goes here.</p>" },
    ],
    style: "underline",
  }),
  content: [
    {
      label: "Tabs",
      controls: [
        {
          type: "repeater",
          key: "items",
          label: "Tabs",
          itemLabel: "title",
          addLabel: "Add tab",
          newItem: () => ({ title: "New tab", html: "<p>Tab content.</p>" }),
          fields: [
            { type: "text", key: "title", label: "Title" },
            { type: "icon", key: "icon", label: "Icon", allowNone: true },
            { type: "richtext", key: "html", label: "Content" },
          ],
        },
        { type: "buttons", key: "orientation", label: "Layout", options: opts(["", "Horizontal"], ["vertical", "Vertical"]) },
        { type: "buttons", key: "align", label: "Tab alignment", options: ALIGN3, when: (s) => s.orientation !== "vertical" },
      ],
    },
  ],
  design: [
    {
      label: "Tab titles",
      controls: [
        { type: "buttons", key: "style", label: "Style", options: opts(["underline", "Underline"], ["pills", "Pills"], ["boxed", "Boxed"]) },
        { type: "color", key: "titleColor", label: "Color" },
        { type: "color", key: "activeColor", label: "Active color" },
        { type: "typography", key: "titleTypography", label: "Typography" },
      ],
    },
    {
      label: "Content",
      controls: [
        { type: "color", key: "contentColor", label: "Text color" },
        { type: "typography", key: "contentTypography", label: "Typography" },
        ...boxControls("panel"),
      ],
    },
  ],
  render: (s) => {
    const items = list<{ title?: string; icon?: string; html?: string }>(s.items);
    const nav = items
      .map((it, i) => `<button class="gpb-tab-btn${i === 0 ? " is-active" : ""}" type="button">${it.icon ? iconSvg(it.icon) : ""}<span>${esc(it.title)}</span></button>`)
      .join("");
    const panels = items.map((it, i) => `<div class="gpb-tab-panel${i === 0 ? " is-active" : ""}">${sanitizeRich(it.html)}</div>`).join("");
    const cls = ["gpb-tabs", `pf-tabs--${esc(str(s.style, "underline"))}`, s.orientation === "vertical" && "pf-tabs--vertical"].filter(Boolean).join(" ");
    return `<div class="${cls}" data-gpb="tabs"><div class="gpb-tabs-nav">${nav}</div><div class="pf-tab-panels">${panels}</div></div>`;
  },
  css: (s, css) => {
    if (s.align && s.orientation !== "vertical") css.rule(".gpb-tabs-nav", { "justify-content": FLEX_ALIGN[str(s.align)] });
    css.rule(".gpb-tab-btn", { color: color(s.titleColor) });
    css.rule(".gpb-tab-btn.is-active", { color: color(s.activeColor), "border-bottom-color": color(s.activeColor) });
    if (s.activeColor && s.style !== "underline") css.rule(".gpb-tab-btn.is-active", { background: color(s.activeColor), color: "#fff" });
    typography(css, ".gpb-tab-btn", s.titleTypography as Typography);
    css.rule(".gpb-tab-panel", { color: color(s.contentColor) });
    typography(css, ".gpb-tab-panel", s.contentTypography as Typography);
    boxCss(css, ".pf-tab-panels", s, "panel");
  },
});

/* ── Counter ── */

export const counter = defineWidget({
  type: "counter",
  label: "Counter",
  icon: icon('<path d="M4 17V7l3 3M10 7h4l-4 10h4M17 7h3v10"/>'),
  category: "Widgets",
  keywords: "number stat statistic animated",
  defaults: () => ({ number: "2500", suffix: "+", label: "Happy customers", duration: 2000 }),
  content: [
    {
      label: "Counter",
      controls: [
        { type: "text", key: "number", label: "Number", placeholder: "2500 or 4.9" },
        { type: "text", key: "prefix", label: "Prefix", placeholder: "$" },
        { type: "text", key: "suffix", label: "Suffix", placeholder: "+" },
        { type: "text", key: "label", label: "Label" },
        { type: "number", key: "duration", label: "Animation", unit: "ms", min: 200, max: 10000, step: 100 },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Number",
      controls: [
        { type: "color", key: "numberColor", label: "Color" },
        { type: "typography", key: "numberTypography", label: "Typography" },
      ],
    },
    {
      label: "Label",
      controls: [
        { type: "color", key: "labelColor", label: "Color" },
        { type: "typography", key: "labelTypography", label: "Typography" },
      ],
    },
  ],
  render: (s) => {
    const n = str(s.number).replace(/[^\d.]/g, "") || "0";
    return `<div class="gpb-counter" data-gpb="counter" data-target="${esc(n)}" data-duration="${num(s.duration, 2000)}"><div class="gpb-counter-value">${s.prefix ? `<span>${esc(s.prefix)}</span>` : ""}<span class="gpb-counter-num">${esc(n)}</span>${s.suffix ? `<span>${esc(s.suffix)}</span>` : ""}</div>${s.label ? `<div class="gpb-counter-label">${esc(s.label)}</div>` : ""}</div>`;
  },
  css: (s, css) => {
    css.responsive(".gpb-counter", s.align as Responsive<string>, (v) => ({ "text-align": v }));
    css.rule(".gpb-counter-value", { color: color(s.numberColor) });
    typography(css, ".gpb-counter-value", s.numberTypography as Typography);
    css.rule(".gpb-counter-label", { color: color(s.labelColor) });
    typography(css, ".gpb-counter-label", s.labelTypography as Typography);
  },
});

/* ── Countdown ── */

export const countdown = defineWidget({
  type: "countdown",
  label: "Countdown",
  icon: icon('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
  category: "Widgets",
  keywords: "timer deadline urgency scarcity evergreen",
  defaults: () => ({ mode: "date", date: inDays(7), minutes: 30, showDays: true, showHours: true, showMinutes: true, showSeconds: true, expired: "message", message: "This offer has expired." }),
  content: [
    {
      label: "Timer",
      controls: [
        { type: "buttons", key: "mode", label: "Type", options: opts(["date", "Fixed date"], ["evergreen", "Evergreen"]) },
        { type: "datetime", key: "date", label: "Ends at", help: "In the visitor's local time.", when: (s) => s.mode !== "evergreen" },
        { type: "number", key: "minutes", label: "Minutes per visitor", min: 1, when: (s) => s.mode === "evergreen", help: "Each visitor gets their own deadline, remembered on their device." },
        { type: "toggle", key: "showDays", label: "Show days" },
        { type: "toggle", key: "showHours", label: "Show hours" },
        { type: "toggle", key: "showMinutes", label: "Show minutes" },
        { type: "toggle", key: "showSeconds", label: "Show seconds" },
      ],
    },
    {
      label: "When it ends",
      controls: [
        { type: "buttons", key: "expired", label: "Action", options: opts(["message", "Message"], ["hide", "Hide"], ["redirect", "Redirect"]) },
        { type: "text", key: "message", label: "Message", when: (s) => s.expired !== "hide" && s.expired !== "redirect" },
        { type: "text", key: "redirect", label: "Redirect to", placeholder: "https://…", when: (s) => s.expired === "redirect" },
      ],
    },
    {
      label: "Labels",
      closed: true,
      controls: [
        { type: "text", key: "labelDays", label: "Days", placeholder: "Days" },
        { type: "text", key: "labelHours", label: "Hours", placeholder: "Hours" },
        { type: "text", key: "labelMinutes", label: "Minutes", placeholder: "Minutes" },
        { type: "text", key: "labelSeconds", label: "Seconds", placeholder: "Seconds" },
      ],
    },
  ],
  design: [
    {
      label: "Boxes",
      controls: [
        { type: "color", key: "boxColor", label: "Background" },
        { type: "color", key: "numberColor", label: "Number color" },
        { type: "color", key: "labelColor", label: "Label color" },
        { type: "typography", key: "numberTypography", label: "Number typography" },
        { type: "number", key: "radius", label: "Corner radius", unit: "px", min: 0, max: 60 },
        { type: "number", key: "gap", label: "Gap", unit: "px", min: 0, max: 60 },
      ],
    },
  ],
  render: (s) => {
    const unit = (show: unknown, cls: string, label: unknown, def: string) =>
      show === false ? "" : `<div class="gpb-cd-unit"><span class="gpb-cd-num ${cls}">00</span><span class="gpb-cd-label">${esc(str(label) || def)}</span></div>`;
    const evergreen = s.mode === "evergreen" ? num(s.minutes, 30) : 0;
    const attrs = [
      `data-date="${esc(s.date)}"`,
      `data-evergreen="${evergreen}"`,
      s.expired === "redirect" && s.redirect ? `data-expired-redirect="${esc(s.redirect)}"` : "",
      s.expired === "hide" ? `data-expired-hide="true"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<div class="gpb-countdown" data-gpb="countdown" ${attrs}><div class="gpb-cd-grid">${unit(s.showDays, "gpb-cd-days", s.labelDays, "Days")}${unit(s.showHours, "gpb-cd-hours", s.labelHours, "Hours")}${unit(s.showMinutes, "gpb-cd-minutes", s.labelMinutes, "Minutes")}${unit(s.showSeconds, "gpb-cd-seconds", s.labelSeconds, "Seconds")}</div><div class="gpb-cd-expired">${esc(s.message)}</div></div>`;
  },
  css: (s, css) => {
    css.rule(".gpb-cd-unit", { background: color(s.boxColor), "border-radius": px(s.radius) });
    css.rule(".gpb-cd-num", { color: color(s.numberColor) });
    css.rule(".gpb-cd-label", { color: color(s.labelColor) });
    css.rule(".gpb-cd-grid", { gap: px(s.gap) });
    typography(css, ".gpb-cd-num", s.numberTypography as Typography);
  },
});

/** Local "YYYY-MM-DDTHH:00" N days from now (what a datetime-local input expects). */
export function inDays(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

/* ── Progress bars ── */

export const progress = defineWidget({
  type: "progress",
  label: "Progress bars",
  icon: icon('<rect x="3" y="6" width="18" height="4" rx="2"/><rect x="3" y="14" width="18" height="4" rx="2"/><path d="M3 8h12M3 16h7"/>'),
  category: "Widgets",
  keywords: "skills bars percentage",
  defaults: () => ({ items: [{ label: "Strategy", value: 92 }, { label: "Design", value: 80 }, { label: "Development", value: 68 }], showValue: true }),
  content: [
    {
      label: "Bars",
      controls: [
        {
          type: "repeater",
          key: "items",
          label: "Bars",
          itemLabel: "label",
          addLabel: "Add bar",
          newItem: () => ({ label: "New skill", value: 75 }),
          fields: [
            { type: "text", key: "label", label: "Label" },
            { type: "number", key: "value", label: "Value", unit: "%", min: 0, max: 100, slider: true },
          ],
        },
        { type: "toggle", key: "showValue", label: "Show percentage" },
      ],
    },
  ],
  design: [
    {
      label: "Bars",
      controls: [
        { type: "color", key: "barColor", label: "Bar color", help: "Empty = brand gradient." },
        { type: "color", key: "trackColor", label: "Track color" },
        { type: "number", key: "height", label: "Height", unit: "px", min: 2, max: 40, slider: true },
        { type: "color", key: "labelColor", label: "Label color" },
        { type: "typography", key: "labelTypography", label: "Label typography" },
      ],
    },
  ],
  render: (s) =>
    list<{ label?: string; value?: number }>(s.items)
      .map((it) => {
        const v = Math.max(0, Math.min(100, num(it.value, 0)));
        return `<div class="gpb-progress" data-gpb="progress" data-value="${v}"><div class="gpb-progress-label"><span>${esc(it.label)}</span>${s.showValue !== false ? `<span>${v}%</span>` : ""}</div><div class="gpb-progress-track"><div class="gpb-progress-bar"></div></div></div>`;
      })
      .join(""),
  css: (s, css) => {
    css.rule(".gpb-progress-bar", { background: color(s.barColor) });
    css.rule(".gpb-progress-track", { background: color(s.trackColor), height: px(s.height) });
    css.rule(".gpb-progress-label", { color: color(s.labelColor) });
    typography(css, ".gpb-progress-label", s.labelTypography as Typography);
  },
});

/* ── Testimonials ── */

type Review = { quote?: string; name?: string; role?: string; avatar?: string; rating?: number };

const reviewFields = [
  { type: "text" as const, key: "quote", label: "Quote", multiline: true },
  { type: "text" as const, key: "name", label: "Name" },
  { type: "text" as const, key: "role", label: "Title / company" },
  { type: "image" as const, key: "avatar", label: "Photo" },
  { type: "number" as const, key: "rating", label: "Stars (0 = hide)", min: 0, max: 5 },
];

const reviewCard = (r: Review) =>
  `<div class="gpb-testimonial">${stars(num(r.rating, 0))}<p class="gpb-testimonial-quote">${textToHtml(r.quote)}</p><div class="gpb-author">${r.avatar ? `<img src="${esc(safeSrc(r.avatar))}" alt="${esc(r.name)}" loading="lazy">` : ""}<div><div class="gpb-author-name">${esc(r.name)}</div>${r.role ? `<div class="gpb-author-role">${esc(r.role)}</div>` : ""}</div></div></div>`;

const reviewDesign = [
  { label: "Card", controls: boxControls("card") },
  {
    label: "Text",
    controls: [
      { type: "color" as const, key: "quoteColor", label: "Quote color" },
      { type: "typography" as const, key: "quoteTypography", label: "Quote typography" },
      { type: "color" as const, key: "nameColor", label: "Name color" },
      { type: "color" as const, key: "starColor", label: "Star color" },
    ],
  },
];

const reviewCss = (s: Settings, css: CssBuilder) => {
  boxCss(css, ".gpb-testimonial", s, "card");
  css.rule(".gpb-testimonial-quote", { color: color(s.quoteColor) });
  typography(css, ".gpb-testimonial-quote", s.quoteTypography as Typography);
  css.rule(".gpb-author-name", { color: color(s.nameColor) });
  css.rule(".gpb-stars", { color: color(s.starColor) });
};

const sampleReviews = (): Review[] => [
  { quote: "We rebuilt our entire funnel in an afternoon. Conversions are up 38% and our team finally loves editing pages.", name: "Sarah Johnson", role: "Founder, Bloom Studio", avatar: "https://i.pravatar.cc/96?img=32", rating: 5 },
  { quote: "The countdown and popup widgets alone paid for this in the first week.", name: "Marcus Lee", role: "CEO, Peak Fitness", avatar: "https://i.pravatar.cc/96?img=12", rating: 5 },
  { quote: "Leads land in our CRM with the right tags every time. It just works.", name: "Priya Patel", role: "Agency Owner", avatar: "https://i.pravatar.cc/96?img=47", rating: 5 },
  { quote: "Our clients can finally make edits without breaking the design.", name: "Daniel Kim", role: "Marketing Director", avatar: "https://i.pravatar.cc/96?img=15", rating: 5 },
];

export const testimonial = defineWidget({
  type: "testimonial",
  label: "Testimonial",
  icon: icon('<path d="M5 6h14v10H9l-4 3z"/><path d="M9 10h6"/>'),
  category: "Widgets",
  keywords: "review quote social proof",
  defaults: () => ({ ...sampleReviews()[0] }),
  content: [{ label: "Testimonial", controls: reviewFields }],
  design: reviewDesign,
  render: (s) => reviewCard(s as Review),
  css: reviewCss,
});

export const testimonialCarousel = defineWidget({
  type: "testimonial-carousel",
  label: "Testimonial slider",
  icon: icon('<rect x="6" y="5" width="12" height="14" rx="2"/><path d="M3 8v8M21 8v8"/>'),
  category: "Widgets",
  keywords: "carousel slider reviews testimonials",
  defaults: () => ({ items: sampleReviews(), perView: { desktop: 3, tablet: 2, mobile: 1 }, autoplay: 5000, arrows: true, dots: true }),
  content: [
    {
      label: "Slides",
      controls: [
        {
          type: "repeater",
          key: "items",
          label: "Slides",
          itemLabel: "name",
          addLabel: "Add testimonial",
          newItem: () => ({ quote: "What your customer said.", name: "Customer name", rating: 5 }),
          fields: reviewFields,
        },
      ],
    },
    {
      label: "Slider",
      controls: [
        { type: "number", key: "perView", label: "Slides per view", min: 1, max: 6, responsive: true },
        { type: "number", key: "autoplay", label: "Autoplay every", unit: "ms", min: 0, step: 500, help: "0 = off" },
        { type: "toggle", key: "arrows", label: "Show arrows" },
        { type: "toggle", key: "dots", label: "Show dots" },
      ],
    },
  ],
  design: reviewDesign,
  render: (s) =>
    `<div class="gpb-carousel" data-gpb="carousel" data-autoplay="${num(s.autoplay, 0)}"><div class="gpb-car-track">${list<Review>(s.items)
      .map((r) => `<div class="gpb-car-slide">${reviewCard(r)}</div>`)
      .join("")}</div>${s.arrows !== false ? `<button class="gpb-car-prev" type="button" aria-label="Previous">‹</button><button class="gpb-car-next" type="button" aria-label="Next">›</button>` : ""}${s.dots !== false ? `<div class="gpb-car-dots"></div>` : ""}</div>`,
  css: (s, css) => {
    css.responsive(".gpb-carousel", s.perView as Responsive<number>, (v) => ({ "--gpb-pv": Math.max(1, Math.min(6, v)) }));
    reviewCss(s, css);
  },
});

/* ── Feature box ── */

export const featureBox = defineWidget({
  type: "feature",
  label: "Feature box",
  icon: icon('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>'),
  category: "Widgets",
  keywords: "icon box service benefit card",
  defaults: () => ({ icon: "zap", title: "Lightning fast", text: "Pages load in milliseconds so you never lose a visitor." }),
  inline: { selector: ".pf-feature-title", key: "title", plain: true },
  content: [
    {
      label: "Feature",
      controls: [
        { type: "icon", key: "icon", label: "Icon", allowNone: true },
        { type: "image", key: "image", label: "Image (instead of icon)" },
        { type: "text", key: "title", label: "Title" },
        { type: "text", key: "text", label: "Description", multiline: true },
        { type: "link", key: "link", label: "Link" },
        { type: "text", key: "linkText", label: "Link text", placeholder: "Learn more", when: (s) => !!(s.link as LinkValue)?.url },
        { type: "buttons", key: "layout", label: "Icon position", options: opts(["top", "Top"], ["left", "Left"]) },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true, when: (s) => s.layout !== "left" },
      ],
    },
  ],
  design: [
    { label: "Box", controls: boxControls("box") },
    {
      label: "Icon",
      controls: [
        { type: "color", key: "iconColor", label: "Color" },
        { type: "color", key: "iconBg", label: "Background" },
        { type: "number", key: "iconSize", label: "Size", unit: "px", min: 12, max: 120, slider: true },
      ],
    },
    {
      label: "Text",
      controls: [
        { type: "color", key: "titleColor", label: "Title color" },
        { type: "typography", key: "titleTypography", label: "Title typography" },
        { type: "color", key: "textColor", label: "Description color" },
      ],
    },
  ],
  render: (s) => {
    const media = s.image
      ? `<img class="pf-feature-img" src="${esc(safeSrc(s.image))}" alt="" loading="lazy">`
      : s.icon
        ? `<div class="gpb-feature-icon">${iconSvg(s.icon)}</div>`
        : "";
    const link = s.link as LinkValue | undefined;
    const more = link?.url ? `<a class="pf-feature-link"${linkAttrs(link)}>${esc(str(s.linkText) || "Learn more")} →</a>` : "";
    return `<div class="gpb-feature pf-feature${s.layout === "left" ? " pf-feature--left" : ""}">${media}<div class="pf-feature-body"><h3 class="pf-feature-title">${esc(s.title)}</h3><p>${textToHtml(s.text)}</p>${more}</div></div>`;
  },
  css: (s, css) => {
    if (s.layout !== "left") {
      css.responsive(".pf-feature", s.align as Responsive<string>, (v) => ({ "text-align": v, "align-items": FLEX_ALIGN[v] }));
    }
    boxCss(css, ".pf-feature", s, "box");
    css.rule(".gpb-feature-icon", { color: color(s.iconColor), background: color(s.iconBg), "font-size": px(s.iconSize) });
    css.rule(".pf-feature-title", { color: color(s.titleColor) });
    typography(css, ".pf-feature-title", s.titleTypography as Typography);
    css.rule(".pf-feature p", { color: color(s.textColor) });
  },
});

/* ── Pricing table ── */

type Plan = {
  name?: string;
  description?: string;
  monthly?: string;
  yearly?: string;
  period?: string;
  features?: string;
  buttonText?: string;
  link?: LinkValue;
  featured?: boolean;
  badge?: string;
};

export const pricing = defineWidget({
  type: "pricing",
  label: "Pricing table",
  icon: icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v10M14.5 9H11a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H9.5"/>'),
  category: "Widgets",
  keywords: "plans prices packages monthly yearly",
  defaults: () => ({
    toggle: true,
    currency: "$",
    saveText: "Save 20%",
    plans: [
      { name: "Starter", monthly: "29", yearly: "23", period: "/month", features: "1 website\n5 landing pages\nEmail support", buttonText: "Choose Starter", link: { url: "#signup" } },
      { name: "Pro", monthly: "79", yearly: "63", period: "/month", features: "5 websites\nUnlimited pages\nAll widgets\nPriority support", buttonText: "Choose Pro", link: { url: "#signup" }, featured: true, badge: "Most popular" },
      { name: "Agency", monthly: "199", yearly: "159", period: "/month", features: "Unlimited websites\nWhite-label\nTeam seats\nDedicated manager", buttonText: "Choose Agency", link: { url: "#signup" } },
    ],
  }),
  content: [
    {
      label: "Plans",
      controls: [
        {
          type: "repeater",
          key: "plans",
          label: "Plans",
          itemLabel: "name",
          addLabel: "Add plan",
          newItem: () => ({ name: "New plan", monthly: "49", yearly: "39", period: "/month", features: "Feature one\nFeature two", buttonText: "Get started", link: { url: "#" } }),
          fields: [
            { type: "text", key: "name", label: "Name" },
            { type: "text", key: "description", label: "Description" },
            { type: "text", key: "monthly", label: "Price" },
            { type: "text", key: "yearly", label: "Yearly price (per month)" },
            { type: "text", key: "period", label: "Period", placeholder: "/month" },
            { type: "text", key: "features", label: "Features", multiline: true, help: "One per line." },
            { type: "text", key: "buttonText", label: "Button text" },
            { type: "link", key: "link", label: "Button link" },
            { type: "toggle", key: "featured", label: "Highlight this plan" },
            { type: "text", key: "badge", label: "Badge", placeholder: "Most popular" },
          ],
        },
      ],
    },
    {
      label: "Options",
      controls: [
        { type: "text", key: "currency", label: "Currency symbol" },
        { type: "toggle", key: "toggle", label: "Monthly / yearly switch" },
        { type: "text", key: "saveText", label: "Yearly badge", when: (s) => !!s.toggle },
        { type: "number", key: "columns", label: "Columns", min: 1, max: 4, responsive: true, help: "Default: one per plan (max 3), one column on mobile." },
      ],
    },
  ],
  design: [
    { label: "Cards", controls: [...boxControls("card"), { type: "color", key: "accent", label: "Highlight color" }] },
    {
      label: "Price",
      controls: [
        { type: "color", key: "priceColor", label: "Color" },
        { type: "typography", key: "priceTypography", label: "Typography" },
      ],
    },
  ],
  render: (s) => {
    const plans = list<Plan>(s.plans);
    const cur = esc(s.currency);
    const cards = plans
      .map((p) => {
        const feats = str(p.features)
          .split(/\r?\n/)
          .map((f) => f.trim())
          .filter(Boolean)
          .map((f) => `<li>${iconSvg("circle-check", "pf-li-icon")}<span>${esc(f)}</span></li>`)
          .join("");
        const price = s.toggle
          ? `<span class="gpb-price" data-monthly="${esc(p.monthly)}" data-yearly="${esc(p.yearly || p.monthly)}">${esc(p.monthly)}</span>`
          : `<span class="gpb-price">${esc(p.monthly)}</span>`;
        return `<div class="gpb-price-card${p.featured ? " is-featured" : ""}">${p.badge ? `<span class="gpb-price-badge">${esc(p.badge)}</span>` : ""}<div class="gpb-price-name">${esc(p.name)}</div>${p.description ? `<p class="pf-price-desc">${esc(p.description)}</p>` : ""}<div class="gpb-price-amount"><span class="pf-price-cur">${cur}</span>${price}<span class="gpb-price-period">${esc(p.period)}</span></div><ul class="pf-icon-list">${feats}</ul>${buttonHtml({ text: p.buttonText, link: p.link, variant: p.featured ? "solid" : "outline" }, "pf-btn--block")}</div>`;
      })
      .join("");
    const sw = s.toggle
      ? `<div class="gpb-price-switch"><span>Monthly</span><label><input type="checkbox" aria-label="Show yearly prices"><span class="gpb-switch-ui"></span></label><span>Yearly</span>${s.saveText ? `<span class="gpb-save-badge">${esc(s.saveText)}</span>` : ""}</div>`
      : "";
    return `<div class="gpb-pricing" data-gpb="pricing">${sw}<div class="pf-price-grid" style="--pf-plans:${Math.min(3, Math.max(1, plans.length))}">${cards}</div></div>`;
  },
  css: (s, css) => {
    css.responsive(".pf-price-grid", s.columns as Responsive<number>, (v) => ({ "grid-template-columns": `repeat(${Math.max(1, Math.min(4, v))}, minmax(0, 1fr))` }));
    boxCss(css, ".gpb-price-card", s, "card");
    if (s.accent) {
      css.rule(".gpb-price-card.is-featured", { "border-color": color(s.accent) });
      css.rule(".gpb-price-badge", { background: color(s.accent) });
    }
    css.rule(".gpb-price-amount", { color: color(s.priceColor) });
    typography(css, ".gpb-price", s.priceTypography as Typography);
  },
});

/* ── Flip box ── */

export const flipBox = defineWidget({
  type: "flip-box",
  label: "Flip box",
  icon: icon('<rect x="4" y="4" width="11" height="14" rx="2"/><path d="M18 7v12a2 2 0 0 1-2 2H8"/>'),
  category: "Widgets",
  keywords: "card hover reveal",
  defaults: () => ({ frontIcon: "sparkles", frontTitle: "Hover me", frontText: "Front side content", backTitle: "Surprise!", backText: "Back side content with a call to action.", buttonText: "Learn more", link: { url: "#" }, height: { desktop: 280 } }),
  content: [
    {
      label: "Front",
      controls: [
        { type: "icon", key: "frontIcon", label: "Icon", allowNone: true },
        { type: "text", key: "frontTitle", label: "Title" },
        { type: "text", key: "frontText", label: "Text", multiline: true },
      ],
    },
    {
      label: "Back",
      controls: [
        { type: "text", key: "backTitle", label: "Title" },
        { type: "text", key: "backText", label: "Text", multiline: true },
        { type: "text", key: "buttonText", label: "Button text" },
        { type: "link", key: "link", label: "Button link" },
      ],
    },
    {
      label: "Box",
      controls: [
        { type: "number", key: "height", label: "Height", unit: "px", min: 120, max: 800, responsive: true },
        { type: "buttons", key: "direction", label: "Flip", options: opts(["", "Sideways"], ["vertical", "Up"]) },
      ],
    },
  ],
  design: [
    {
      label: "Colors",
      controls: [
        { type: "background", key: "frontBg", label: "Front background" },
        { type: "color", key: "frontColor", label: "Front text" },
        { type: "background", key: "backBg", label: "Back background" },
        { type: "color", key: "backColor", label: "Back text" },
      ],
    },
  ],
  render: (s) =>
    `<div class="gpb-flip${s.direction === "vertical" ? " pf-flip--vertical" : ""}"><div class="gpb-flip-inner"><div class="gpb-flip-front">${s.frontIcon ? `<div class="gpb-feature-icon">${iconSvg(s.frontIcon)}</div>` : ""}<h3>${esc(s.frontTitle)}</h3><p>${textToHtml(s.frontText)}</p></div><div class="gpb-flip-back"><h3>${esc(s.backTitle)}</h3><p>${textToHtml(s.backText)}</p>${s.buttonText ? buttonHtml({ text: s.buttonText, link: s.link, variant: "solid" }, "pf-btn--white") : ""}</div></div></div>`,
  css: (s, css) => {
    css.responsive(".gpb-flip", s.height as Responsive<number>, (v) => ({ "min-height": px(v) }));
    boxCss(css, ".gpb-flip-front", { background: s.frontBg }, "");
    css.rule(".gpb-flip-front", { color: color(s.frontColor) });
    boxCss(css, ".gpb-flip-back", { background: s.backBg }, "");
    css.rule(".gpb-flip-back", { color: color(s.backColor) });
  },
});

/* ── Before / after ── */

export const beforeAfter = defineWidget({
  type: "before-after",
  label: "Before / After",
  icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18"/>'),
  category: "Widgets",
  keywords: "comparison slider image compare",
  defaults: () => ({
    before: "https://picsum.photos/seed/modern/1000/600?grayscale",
    after: "https://picsum.photos/seed/modern/1000/600",
    beforeLabel: "Before",
    afterLabel: "After",
    start: 50,
  }),
  content: [
    {
      label: "Images",
      controls: [
        { type: "image", key: "before", label: "Before image" },
        { type: "image", key: "after", label: "After image" },
        { type: "text", key: "beforeLabel", label: "Before label" },
        { type: "text", key: "afterLabel", label: "After label" },
        { type: "number", key: "start", label: "Start position", unit: "%", min: 0, max: 100, slider: true },
      ],
    },
  ],
  design: [{ label: "Frame", controls: boxControls("", { background: false, padding: false }) }],
  render: (s) =>
    `<div class="gpb-ba" data-gpb="before-after" data-start="${num(s.start, 50)}"><img src="${esc(safeSrc(s.before))}" alt="${esc(s.beforeLabel)}"><div class="gpb-ba-after"><img src="${esc(safeSrc(s.after))}" alt="${esc(s.afterLabel)}"></div><div class="gpb-ba-handle"></div>${s.beforeLabel ? `<span class="gpb-ba-label gpb-ba-label--before">${esc(s.beforeLabel)}</span>` : ""}${s.afterLabel ? `<span class="gpb-ba-label gpb-ba-label--after">${esc(s.afterLabel)}</span>` : ""}</div>`,
  css: (s, css) => boxCss(css, ".gpb-ba", s),
});

/* ── Logo marquee ── */

export const logoMarquee = defineWidget({
  type: "logo-marquee",
  label: "Logo marquee",
  icon: icon('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
  category: "Widgets",
  keywords: "logos clients brands ticker scrolling",
  defaults: () => ({
    items: ["ACME", "Globex", "Initech", "Umbrella", "Hooli", "Stark Ind.", "Wayne Co."].map((text) => ({ text })),
    speed: 30,
    grayscale: true,
  }),
  content: [
    {
      label: "Logos",
      controls: [
        {
          type: "repeater",
          key: "items",
          label: "Logos",
          itemLabel: "text",
          addLabel: "Add logo",
          newItem: () => ({ text: "Brand" }),
          fields: [
            { type: "image", key: "image", label: "Logo image" },
            { type: "text", key: "text", label: "Name (shown if no image)" },
          ],
        },
        { type: "number", key: "speed", label: "Loop duration", unit: "sec", min: 5, max: 120 },
        { type: "toggle", key: "grayscale", label: "Grayscale until hover" },
      ],
    },
  ],
  design: [
    {
      label: "Logos",
      controls: [
        { type: "number", key: "height", label: "Logo height", unit: "px", min: 16, max: 120, slider: true },
        { type: "number", key: "gap", label: "Gap", unit: "px", min: 8, max: 160 },
        { type: "color", key: "textColor", label: "Text color" },
        { type: "typography", key: "typography", label: "Text typography" },
      ],
    },
  ],
  render: (s) =>
    `<div class="gpb-marquee${s.grayscale ? " pf-marquee--gray" : ""}" data-gpb="marquee" style="--gpb-speed:${num(s.speed, 30)}s"><div class="gpb-marquee-track">${list<{ image?: string; text?: string }>(s.items)
      .map((it) => (it.image ? `<img class="gpb-marquee-item" src="${esc(safeSrc(it.image))}" alt="${esc(it.text)}">` : `<span class="gpb-marquee-item">${esc(it.text)}</span>`))
      .join("")}</div></div>`,
  css: (s, css) => {
    css.rule(".gpb-marquee img", { height: px(s.height) });
    css.rule(".gpb-marquee-track", { gap: px(s.gap) });
    css.rule(".gpb-marquee-item", { color: color(s.textColor) });
    typography(css, "span.gpb-marquee-item", s.typography as Typography);
  },
});

