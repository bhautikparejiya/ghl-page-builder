import { buttonCss, buttonHtml } from "./button";
import { color, px, typography } from "./css";
import { esc, safeSrc, safeUrl, textToHtml } from "./render";
import { boxControls, boxCss, icon, opts, str } from "./shared";
import { defineWidget, type LinkValue, type Responsive, type Typography } from "./types";

/** HighLevel calendar booking widget (by calendar picked from the sub-account, or a pasted id/URL). */
export const calendar = defineWidget({
  type: "calendar",
  label: "Booking calendar",
  icon: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>'),
  category: "HighLevel",
  keywords: "appointment schedule booking meeting calendly",
  defaults: () => ({ height: { desktop: 900, mobile: 1100 } }),
  content: [
    {
      label: "Calendar",
      controls: [
        { type: "select", key: "calendarId", label: "Calendar", options: "calendars", placeholder: "Choose a calendar…" },
        {
          type: "text",
          key: "url",
          label: "Or booking link",
          placeholder: "https://…/widget/booking/…",
          help: "Paste a booking link if the calendar isn't listed.",
          when: (s) => !s.calendarId,
        },
        { type: "number", key: "height", label: "Height", unit: "px", min: 300, max: 2000, responsive: true },
      ],
    },
  ],
  design: [{ label: "Frame", controls: boxControls("", { background: false }) }],
  render: (s) => {
    const id = str(s.calendarId).replace(/[^\w-]/g, "");
    const src = id ? `https://api.leadconnectorhq.com/widget/booking/${id}` : safeUrl(s.url);
    if (!src) return `<div class="pf-embed-empty">Choose a calendar in the Content tab.</div>`;
    return `<iframe class="pf-embed-frame" src="${esc(src)}" title="Book an appointment" loading="lazy" scrolling="no"></iframe>`;
  },
  css: (s, css) => {
    css.responsive(".pf-embed-frame", s.height as Responsive<number>, (v) => ({ height: px(v) }));
    boxCss(css, ".pf-embed-frame, .pf-embed-empty", s);
  },
});

/** A HighLevel form or survey embedded by id. */
export const ghlForm = defineWidget({
  type: "ghl-form",
  label: "HighLevel form",
  icon: icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/><circle cx="18" cy="18" r="3" fill="currentColor"/>'),
  category: "HighLevel",
  keywords: "survey quiz native form embed",
  defaults: () => ({ height: { desktop: 640 } }),
  content: [
    {
      label: "Form",
      controls: [
        { type: "buttons", key: "kind", label: "Type", options: opts(["form", "Form"], ["survey", "Survey"]) },
        { type: "text", key: "formId", label: "Form / survey ID or link", help: "From Sites → Forms (or Surveys) → Integrate." },
        { type: "number", key: "height", label: "Height", unit: "px", min: 200, max: 2400, responsive: true },
      ],
    },
  ],
  design: [{ label: "Frame", controls: boxControls("", { background: false }) }],
  render: (s) => {
    const raw = str(s.formId).trim();
    const fromUrl = raw.match(/\/widget\/(form|survey)\/([\w-]+)/);
    const kind = fromUrl ? fromUrl[1] : s.kind === "survey" ? "survey" : "form";
    const id = (fromUrl ? fromUrl[2] : raw).replace(/[^\w-]/g, "");
    if (!id) return `<div class="pf-embed-empty">Paste a form ID in the Content tab.</div>`;
    return `<iframe class="pf-embed-frame" src="https://api.leadconnectorhq.com/widget/${kind}/${id}" title="Form" loading="lazy"></iframe>`;
  },
  css: (s, css) => {
    css.responsive(".pf-embed-frame", s.height as Responsive<number>, (v) => ({ height: px(v) }));
    boxCss(css, ".pf-embed-frame, .pf-embed-empty", s);
  },
});

/** Reviews widget from HighLevel Reputation (or any review widget), embedded by URL or code. */
export const reviewsEmbed = defineWidget({
  type: "reviews-embed",
  label: "Reviews widget",
  icon: icon('<path d="M5 6h14v10H9l-4 3z"/><path d="m12 8 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>'),
  category: "HighLevel",
  keywords: "reputation google reviews embed",
  defaults: () => ({ height: { desktop: 520 } }),
  content: [
    {
      label: "Widget",
      controls: [
        { type: "text", key: "url", label: "Widget link", placeholder: "https://…", help: "From Reputation → Widgets → copy the widget link." },
        { type: "code", key: "code", label: "Or embed code", language: "html", when: (s) => !s.url },
        { type: "number", key: "height", label: "Height", unit: "px", min: 200, max: 2000, responsive: true, when: (s) => !!s.url },
      ],
    },
  ],
  design: [],
  render: (s) => {
    const url = safeUrl(s.url);
    if (url) return `<iframe class="pf-embed-frame" src="${esc(url)}" title="Reviews" loading="lazy"></iframe>`;
    // The page owner's own embed code, intentionally rendered as-is.
    return str(s.code) || `<div class="pf-embed-empty">Paste your reviews widget link in the Content tab.</div>`;
  },
  css: (s, css) => css.responsive(".pf-embed-frame", s.height as Responsive<number>, (v) => ({ height: px(v) })),
});

/** Product card with a buy button that links to a HighLevel payment link / order form. */
export const buyButton = defineWidget({
  type: "product",
  label: "Product",
  icon: icon('<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'),
  category: "HighLevel",
  keywords: "buy checkout payment order offer price",
  defaults: () => ({
    name: "Signature Coaching Program",
    price: "$497",
    comparePrice: "$997",
    description: "12 weeks of 1:1 coaching, templates and lifetime access to the community.",
    buttonText: "Buy now",
    link: { url: "#" },
    image: "https://picsum.photos/seed/pf-product/800/600",
    layout: "card",
  }),
  content: [
    {
      label: "Product",
      controls: [
        { type: "image", key: "image", label: "Image" },
        { type: "text", key: "name", label: "Name" },
        { type: "text", key: "price", label: "Price" },
        { type: "text", key: "comparePrice", label: "Compare-at price" },
        { type: "text", key: "description", label: "Description", multiline: true },
        { type: "text", key: "buttonText", label: "Button text" },
        { type: "link", key: "link", label: "Checkout link", help: "A HighLevel payment link, order form or funnel checkout step." },
        { type: "buttons", key: "layout", label: "Layout", options: opts(["card", "Card"], ["row", "Side by side"]) },
      ],
    },
  ],
  design: [
    { label: "Card", controls: boxControls("card") },
    {
      label: "Text",
      controls: [
        { type: "color", key: "nameColor", label: "Name color" },
        { type: "color", key: "priceColor", label: "Price color" },
        { type: "typography", key: "priceTypography", label: "Price typography" },
      ],
    },
    {
      label: "Button",
      controls: [
        { type: "color", key: "bgColor", label: "Background" },
        { type: "color", key: "textColor", label: "Text" },
        { type: "number", key: "radius", label: "Corner radius", unit: "px", min: 0, max: 60 },
      ],
    },
  ],
  render: (s) =>
    `<div class="pf-product${s.layout === "row" ? " pf-product--row" : ""}">${s.image ? `<img class="pf-product-img" src="${esc(safeSrc(s.image))}" alt="${esc(s.name)}" loading="lazy">` : ""}<div class="pf-product-body"><h3 class="pf-product-name">${esc(s.name)}</h3><div class="pf-product-price"><span>${esc(s.price)}</span>${s.comparePrice ? `<s>${esc(s.comparePrice)}</s>` : ""}</div><p>${textToHtml(s.description)}</p>${buttonHtml({ text: s.buttonText, link: s.link as LinkValue, size: "lg" }, "pf-btn--block")}</div></div>`,
  css: (s, css) => {
    boxCss(css, ".pf-product", s, "card");
    css.rule(".pf-product-name", { color: color(s.nameColor) });
    css.rule(".pf-product-price", { color: color(s.priceColor) });
    typography(css, ".pf-product-price span", s.priceTypography as Typography);
    buttonCss({ bgColor: s.bgColor, textColor: s.textColor, radius: s.radius }, css, ".pf-product-body", ".pf-btn");
  },
});
