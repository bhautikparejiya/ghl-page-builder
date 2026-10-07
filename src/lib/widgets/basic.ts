import { borderDecls, color, length, px, shadowValue, typography } from "./css";
import { esc, iconSvg, linkAttrs, safeSrc, sanitizeRich, textToHtml } from "./render";
import { ALIGN, ALIGN3, boxControls, boxCss, FLEX_ALIGN, HEADING_TAGS, icon, list, num, opts, str } from "./shared";
import { defineWidget, type Border, type Length, type LinkValue, type Responsive, type Shadow, type Typography } from "./types";

/* ── Text ── */

export const text = defineWidget({
  type: "text",
  label: "Text",
  icon: icon('<path d="M4 6h16M4 10h16M4 14h10M4 18h13"/>'),
  category: "Basic",
  keywords: "paragraph rich text editor copy",
  defaults: () => ({
    html: "<p>Write something compelling here. Double-click to edit the text right on the page, and use the Design tab to change fonts and colors for each device.</p>",
  }),
  inline: { selector: ".pf-text-body", key: "html" },
  content: [
    {
      label: "Text",
      controls: [
        { type: "richtext", key: "html", label: "Text" },
        { type: "buttons", key: "align", label: "Alignment", responsive: true, options: ALIGN },
        { type: "number", key: "columns", label: "Columns", min: 1, max: 4, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Text",
      controls: [
        { type: "color", key: "color", label: "Color" },
        { type: "color", key: "linkColor", label: "Link color" },
        { type: "typography", key: "typography", label: "Typography" },
        { type: "number", key: "paragraphGap", label: "Space between paragraphs", unit: "px", min: 0, max: 60 },
      ],
    },
  ],
  render: (s) => `<div class="pf-text-body">${sanitizeRich(s.html)}</div>`,
  css: (s, css) => {
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "text-align": v }));
    css.responsive(".pf-text-body", s.columns as Responsive<number>, (v) => ({ "column-count": v > 1 ? v : undefined, "column-gap": "32px" }));
    css.rule(".pf-text-body", { color: color(s.color) });
    css.rule(".pf-text-body a", { color: color(s.linkColor) });
    typography(css, ".pf-text-body", s.typography as Typography);
    if (typeof s.paragraphGap === "number") css.rule(".pf-text-body p", { margin: `0 0 ${s.paragraphGap}px` });
  },
});

/* ── Image ── */

export const image = defineWidget({
  type: "image",
  label: "Image",
  icon: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-8 8"/>'),
  category: "Basic",
  keywords: "picture photo graphic",
  defaults: () => ({ src: "https://picsum.photos/seed/pf-image/1000/650", alt: "" }),
  content: [
    {
      label: "Image",
      controls: [
        { type: "image", key: "src", label: "Image" },
        { type: "text", key: "alt", label: "Alt text", help: "Describes the image for screen readers and search engines." },
        { type: "link", key: "link", label: "Link" },
        { type: "text", key: "caption", label: "Caption" },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Size",
      controls: [
        { type: "length", key: "width", label: "Width", units: ["%", "px"], responsive: true },
        { type: "length", key: "height", label: "Height", units: ["px", "vh"], responsive: true },
        { type: "buttons", key: "fit", label: "Fit", options: opts(["cover", "Fill"], ["contain", "Fit"]), when: (s) => !!s.height },
        {
          type: "select",
          key: "hoverFx",
          label: "Hover effect",
          options: opts(["", "None"], ["zoom", "Zoom in"], ["grayscale", "Color on hover"], ["lift", "Lift"]),
        },
      ],
    },
    { label: "Frame", controls: boxControls("img", { background: false, padding: false }) },
  ],
  render: (s) => {
    const src = safeSrc(s.src);
    const img = `<img class="pf-img" src="${esc(src)}" alt="${esc(s.alt)}" loading="lazy">`;
    const link = s.link as LinkValue | undefined;
    const media = link?.url ? `<a class="pf-img-link"${linkAttrs(link)}>${img}</a>` : img;
    return `<figure class="pf-figure${s.hoverFx ? ` pf-img-fx-${esc(s.hoverFx)}` : ""}">${media}${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ""}</figure>`;
  },
  css: (s, css) => {
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "text-align": v }));
    css.responsive(".pf-img", s.width as Responsive<Length>, (v) => ({ width: length(v, "%") }));
    css.responsive(".pf-img", s.height as Responsive<Length>, (v) => ({ height: length(v), "object-fit": str(s.fit, "cover") }));
    css.rule(".pf-img", { ...borderDecls(s.imgBorder as Border), "box-shadow": shadowValue(s.imgShadow as Shadow) });
    css.responsive(".pf-img", s.imgRadius as Responsive<number>, (v) => ({ "border-radius": px(v) }));
  },
});

/* ── Video ── */

/** YouTube / Vimeo page URL → embed URL. Other URLs are treated as video files. */
export function videoEmbed(url: string, o: { autoplay?: boolean; muted?: boolean; loop?: boolean; controls?: boolean; start?: number }) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  const q = new URLSearchParams();
  if (yt) {
    q.set("rel", "0");
    if (o.autoplay) q.set("autoplay", "1");
    if (o.muted || o.autoplay) q.set("mute", "1");
    if (o.loop) {
      q.set("loop", "1");
      q.set("playlist", yt[1]);
    }
    if (o.controls === false) q.set("controls", "0");
    if (o.start) q.set("start", String(o.start));
    return { kind: "iframe" as const, src: `https://www.youtube-nocookie.com/embed/${yt[1]}?${q}` };
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    if (o.autoplay) q.set("autoplay", "1");
    if (o.muted || o.autoplay) q.set("muted", "1");
    if (o.loop) q.set("loop", "1");
    if (o.controls === false) q.set("controls", "0");
    return { kind: "iframe" as const, src: `https://player.vimeo.com/video/${vm[1]}?${q}${o.start ? `#t=${o.start}s` : ""}` };
  }
  return { kind: "file" as const, src: safeSrc(url) };
}

export const video = defineWidget({
  type: "video",
  label: "Video",
  icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>'),
  category: "Basic",
  keywords: "youtube vimeo mp4 embed player",
  defaults: () => ({ url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", ratio: "16/9", controls: true }),
  content: [
    {
      label: "Video",
      controls: [
        { type: "text", key: "url", label: "Video URL", placeholder: "YouTube, Vimeo or .mp4 link" },
        { type: "select", key: "ratio", label: "Aspect ratio", options: opts(["16/9", "16:9"], ["4/3", "4:3"], ["1/1", "1:1"], ["9/16", "9:16 (vertical)"], ["21/9", "21:9"]) },
        { type: "toggle", key: "autoplay", label: "Autoplay (starts muted)" },
        { type: "toggle", key: "muted", label: "Muted" },
        { type: "toggle", key: "loop", label: "Loop" },
        { type: "toggle", key: "controls", label: "Show player controls" },
        { type: "number", key: "start", label: "Start at", unit: "sec", min: 0 },
        { type: "image", key: "poster", label: "Cover image (video files)" },
      ],
    },
  ],
  design: [{ label: "Frame", controls: boxControls("", { background: false, padding: false }) }],
  render: (s) => {
    const o = { autoplay: !!s.autoplay, muted: !!s.muted, loop: !!s.loop, controls: s.controls !== false, start: num(s.start, 0) };
    const v = videoEmbed(str(s.url), o);
    const ratio = /^\d+\/\d+$/.test(str(s.ratio)) ? str(s.ratio) : "16/9";
    const inner =
      v.kind === "iframe"
        ? `<iframe src="${esc(v.src)}" title="Video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
        : `<video src="${esc(v.src)}"${s.poster ? ` poster="${esc(safeSrc(s.poster))}"` : ""}${o.controls ? " controls" : ""}${o.autoplay ? " autoplay" : ""}${o.muted || o.autoplay ? " muted" : ""}${o.loop ? " loop" : ""} playsinline preload="metadata"></video>`;
    return `<div class="pf-video" style="aspect-ratio:${ratio}">${inner}</div>`;
  },
  css: (s, css) => boxCss(css, ".pf-video", s),
});

/* ── Icon ── */

export const iconWidget = defineWidget({
  type: "icon",
  label: "Icon",
  icon: icon('<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
  category: "Basic",
  keywords: "symbol glyph",
  defaults: () => ({ icon: "rocket", size: { desktop: 40 } }),
  content: [
    {
      label: "Icon",
      controls: [
        { type: "icon", key: "icon", label: "Icon" },
        { type: "link", key: "link", label: "Link" },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Icon",
      controls: [
        { type: "number", key: "size", label: "Size", unit: "px", min: 8, max: 200, slider: true, responsive: true },
        { type: "color", key: "color", label: "Color" },
        { type: "color", key: "hoverColor", label: "Color on hover" },
        { type: "buttons", key: "shape", label: "Background", options: opts(["", "None"], ["circle", "Circle"], ["square", "Square"]) },
        { type: "color", key: "bgColor", label: "Background color", when: (s) => !!s.shape },
        { type: "number", key: "pad", label: "Background padding", unit: "px", min: 0, max: 80, when: (s) => !!s.shape },
      ],
    },
  ],
  render: (s) => {
    const inner = `<span class="pf-icon-box${s.shape ? ` pf-icon-box--${esc(s.shape)}` : ""}">${iconSvg(s.icon)}</span>`;
    const link = s.link as LinkValue | undefined;
    return link?.url ? `<a class="pf-icon-link"${linkAttrs(link)}>${inner}</a>` : inner;
  },
  css: (s, css) => {
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "text-align": v }));
    css.responsive(".pf-icon-box", s.size as Responsive<number>, (v) => ({ "font-size": px(v) }));
    css.rule(".pf-icon-box", { color: color(s.color), background: s.shape ? (color(s.bgColor) ?? "var(--gpb-soft)") : undefined, padding: s.shape ? px(num(s.pad, 16)) : undefined });
    css.rule(".pf-icon-box:hover", { color: color(s.hoverColor) });
  },
});

/* ── Icon list ── */

export const iconList = defineWidget({
  type: "icon-list",
  label: "Icon list",
  icon: icon('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'),
  category: "Basic",
  keywords: "bullets checklist features list",
  defaults: () => ({
    icon: "circle-check",
    items: [{ text: "Unlimited pages and funnels" }, { text: "Advanced widgets and animations" }, { text: "Leads sync straight into your CRM" }],
  }),
  content: [
    {
      label: "Items",
      controls: [
        {
          type: "repeater",
          key: "items",
          label: "Items",
          itemLabel: "text",
          addLabel: "Add item",
          newItem: () => ({ text: "New item" }),
          fields: [
            { type: "text", key: "text", label: "Text" },
            { type: "icon", key: "icon", label: "Icon (overrides default)", allowNone: true },
            { type: "link", key: "link", label: "Link" },
          ],
        },
        { type: "icon", key: "icon", label: "Default icon" },
        { type: "buttons", key: "layout", label: "Layout", options: opts(["", "Stacked"], ["inline", "Inline"]) },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Icon",
      controls: [
        { type: "color", key: "iconColor", label: "Color" },
        { type: "number", key: "iconSize", label: "Size", unit: "px", min: 8, max: 64, slider: true },
      ],
    },
    {
      label: "Text",
      controls: [
        { type: "color", key: "textColor", label: "Color" },
        { type: "typography", key: "typography", label: "Typography" },
        { type: "number", key: "gap", label: "Space between items", unit: "px", min: 0, max: 60, responsive: true },
      ],
    },
  ],
  render: (s) =>
    `<ul class="pf-icon-list${s.layout === "inline" ? " pf-icon-list--inline" : ""}">${list<{ text?: string; icon?: string; link?: LinkValue }>(s.items)
      .map((it) => {
        const inner = `${iconSvg(it.icon || s.icon, "pf-li-icon")}<span>${esc(it.text)}</span>`;
        return `<li>${it.link?.url ? `<a${linkAttrs(it.link)}>${inner}</a>` : inner}</li>`;
      })
      .join("")}</ul>`,
  css: (s, css) => {
    css.responsive(".pf-icon-list", s.align as Responsive<string>, (v) =>
      s.layout === "inline" ? { "justify-content": FLEX_ALIGN[v] } : { "align-items": FLEX_ALIGN[v] },
    );
    css.rule(".pf-li-icon", { color: color(s.iconColor), "font-size": px(s.iconSize) });
    css.rule(".pf-icon-list li", { color: color(s.textColor) });
    typography(css, ".pf-icon-list li", s.typography as Typography);
    css.responsive(".pf-icon-list", s.gap as Responsive<number>, (v) => ({ gap: px(v) }));
  },
});

/* ── Social icons ── */

const NETWORKS = opts(
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["x", "X (Twitter)"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["whatsapp", "WhatsApp"],
  ["pinterest", "Pinterest"],
  ["threads", "Threads"],
  ["telegram", "Telegram"],
  ["discord", "Discord"],
  ["github", "GitHub"],
  ["google", "Google"],
  ["yelp", "Yelp"],
  ["vimeo", "Vimeo"],
  ["mail", "Email"],
  ["phone", "Phone"],
  ["globe", "Website"],
);
const BRAND_COLORS: Record<string, string> = {
  facebook: "#1877f2",
  instagram: "#e4405f",
  x: "#000000",
  youtube: "#ff0000",
  tiktok: "#000000",
  whatsapp: "#25d366",
  pinterest: "#bd081c",
  threads: "#000000",
  telegram: "#26a5e4",
  discord: "#5865f2",
  github: "#181717",
  google: "#4285f4",
  yelp: "#d32323",
  vimeo: "#1ab7ea",
};

export const socialIcons = defineWidget({
  type: "social-icons",
  label: "Social icons",
  icon: icon('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>'),
  category: "Basic",
  keywords: "facebook instagram follow links",
  defaults: () => ({
    items: [
      { network: "facebook", url: "https://facebook.com" },
      { network: "instagram", url: "https://instagram.com" },
      { network: "youtube", url: "https://youtube.com" },
    ],
    shape: "circle",
    colors: "brand",
  }),
  content: [
    {
      label: "Links",
      controls: [
        {
          type: "repeater",
          key: "items",
          label: "Links",
          itemLabel: "network",
          addLabel: "Add link",
          newItem: () => ({ network: "x", url: "" }),
          fields: [
            { type: "select", key: "network", label: "Network", options: NETWORKS },
            { type: "text", key: "url", label: "URL", placeholder: "https://…" },
          ],
        },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Icons",
      controls: [
        { type: "buttons", key: "shape", label: "Shape", options: opts(["", "None"], ["circle", "Circle"], ["rounded", "Rounded"], ["square", "Square"]) },
        { type: "buttons", key: "colors", label: "Colors", options: opts(["brand", "Brand"], ["custom", "Custom"]) },
        { type: "color", key: "iconColor", label: "Icon color", when: (s) => s.colors === "custom" },
        { type: "color", key: "bgColor", label: "Background", when: (s) => s.colors === "custom" && !!s.shape },
        { type: "number", key: "size", label: "Size", unit: "px", min: 10, max: 64, slider: true },
        { type: "number", key: "gap", label: "Spacing", unit: "px", min: 0, max: 40 },
      ],
    },
  ],
  render: (s) =>
    `<div class="pf-social${s.shape ? ` pf-social--${esc(s.shape)}` : ""}">${list<{ network?: string; url?: string }>(s.items)
      .map((it) => {
        const n = str(it.network);
        const isBrand = !!BRAND_COLORS[n];
        const label = NETWORKS.find((x) => x.value === n)?.label ?? n;
        const href = n === "mail" && it.url && !it.url.startsWith("mailto:") ? `mailto:${it.url}` : n === "phone" && it.url && !it.url.startsWith("tel:") ? `tel:${it.url}` : it.url;
        const style = s.colors !== "custom" && isBrand ? ` style="--pf-brand:${BRAND_COLORS[n]}"` : "";
        return `<a class="pf-social-link"${linkAttrs({ url: href, newTab: true })} aria-label="${esc(label)}"${style}>${iconSvg(isBrand ? `brand:${n}` : n)}</a>`;
      })
      .join("")}</div>`,
  css: (s, css) => {
    css.responsive(".pf-social", s.align as Responsive<string>, (v) => ({ "justify-content": FLEX_ALIGN[v] }));
    css.rule(".pf-social", { "font-size": px(s.size), gap: px(s.gap) });
    if (s.colors === "custom") {
      css.rule(".pf-social-link", { "--pf-brand": color(s.bgColor) ?? "var(--gpb-primary)", color: color(s.iconColor) });
    }
  },
});

/* ── Map ── */

export const map = defineWidget({
  type: "map",
  label: "Map",
  icon: icon('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  category: "Basic",
  keywords: "google maps location address directions",
  defaults: () => ({ address: "Times Square, New York", zoom: 14, height: { desktop: 380 } }),
  content: [
    {
      label: "Map",
      controls: [
        { type: "text", key: "address", label: "Address or place", help: "You can also use {{location.address}} to show this sub-account's address." },
        { type: "number", key: "zoom", label: "Zoom", min: 1, max: 20, slider: true },
        { type: "number", key: "height", label: "Height", unit: "px", min: 120, max: 1000, responsive: true },
      ],
    },
  ],
  design: [{ label: "Frame", controls: boxControls("", { background: false, padding: false }) }],
  render: (s) =>
    `<div class="pf-map"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(str(s.address))}&amp;z=${num(s.zoom, 14)}&amp;output=embed"></iframe></div>`,
  css: (s, css) => {
    css.responsive(".pf-map", s.height as Responsive<number>, (v) => ({ height: px(v) }));
    boxCss(css, ".pf-map", s);
  },
});

/* ── HTML ── */

export const html = defineWidget({
  type: "html",
  label: "HTML",
  icon: icon('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  category: "Basic",
  keywords: "code embed script custom iframe",
  defaults: () => ({ code: '<div style="padding:24px;border:1px dashed #94a3b8;text-align:center">Your custom HTML</div>' }),
  content: [
    {
      label: "HTML",
      controls: [
        {
          type: "code",
          key: "code",
          label: "HTML code",
          language: "html",
          help: "Scripts run on the live page, not in the editor. Third-party embeds (calendars, chat widgets…) go here.",
        },
      ],
    },
  ],
  design: [],
  // The page owner's own code, intentionally rendered as-is.
  render: (s) => str(s.code),
});

/* ── Animated headline ── */

export const animatedHeadline = defineWidget({
  type: "animated-headline",
  label: "Animated headline",
  icon: icon('<path d="M4 7V5h12v2M10 5v14M7 19h6M18 10v9"/>'),
  category: "Widgets",
  keywords: "typing rotating words typewriter",
  defaults: () => ({ before: "The page builder for", words: "Coaches\nAgencies\nCreators\nClinics", after: "", tag: "h2" }),
  content: [
    {
      label: "Headline",
      controls: [
        { type: "text", key: "before", label: "Before text" },
        { type: "text", key: "words", label: "Rotating words", multiline: true, help: "One per line." },
        { type: "text", key: "after", label: "After text" },
        { type: "select", key: "tag", label: "HTML tag", options: HEADING_TAGS },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Text",
      controls: [
        { type: "color", key: "color", label: "Color" },
        { type: "typography", key: "typography", label: "Typography" },
        { type: "color", key: "wordColor", label: "Rotating word color" },
      ],
    },
  ],
  render: (s) => {
    const words = str(s.words)
      .split(/\r?\n|\|/)
      .map((w) => w.trim())
      .filter(Boolean);
    const tag = HEADING_TAGS.some((t) => t.value === s.tag) ? str(s.tag) : "h2";
    return `<${tag} class="pf-anim-headline" data-gpb="typing" data-words="${esc(words.join("|"))}">${textToHtml(s.before)} <span class="gpb-typing-text">${esc(words[0] ?? "")}</span> ${textToHtml(s.after)}</${tag}>`;
  },
  css: (s, css) => {
    css.responsive("&", s.align as Responsive<string>, (v) => ({ "text-align": v }));
    css.rule(".pf-anim-headline", { color: color(s.color) });
    css.rule(".gpb-typing-text, .gpb-typing-text::after", { color: color(s.wordColor) });
    typography(css, ".pf-anim-headline", s.typography as Typography);
  },
});

/* ── Star rating ── */

export const starRating = defineWidget({
  type: "star-rating",
  label: "Star rating",
  icon: icon('<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
  category: "Widgets",
  keywords: "stars review score",
  defaults: () => ({ rating: 4.9, label: "4.9 from 2,300+ reviews" }),
  content: [
    {
      label: "Rating",
      controls: [
        { type: "number", key: "rating", label: "Rating (out of 5)", min: 0, max: 5, step: 0.1 },
        { type: "text", key: "label", label: "Label" },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, responsive: true },
      ],
    },
  ],
  design: [
    {
      label: "Stars",
      controls: [
        { type: "number", key: "size", label: "Size", unit: "px", min: 10, max: 64, slider: true },
        { type: "color", key: "color", label: "Star color" },
        { type: "color", key: "emptyColor", label: "Empty star color" },
        { type: "color", key: "labelColor", label: "Label color" },
      ],
    },
  ],
  render: (s) => {
    const r = Math.max(0, Math.min(5, num(s.rating, 5)));
    return `<div class="pf-rating" role="img" aria-label="${r} out of 5 stars"><span class="pf-stars"><span class="pf-stars-fill" style="width:${(r / 5) * 100}%">★★★★★</span>★★★★★</span>${s.label ? `<span class="pf-rating-label">${esc(s.label)}</span>` : ""}</div>`;
  },
  css: (s, css) => {
    css.responsive(".pf-rating", s.align as Responsive<string>, (v) => ({ "justify-content": FLEX_ALIGN[v] }));
    css.rule(".pf-stars", { "font-size": px(s.size), color: color(s.emptyColor) });
    css.rule(".pf-stars-fill", { color: color(s.color) });
    css.rule(".pf-rating-label", { color: color(s.labelColor) });
  },
});
