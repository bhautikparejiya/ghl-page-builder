/**
 * HTML for widgets and prebuilt sections. Shared by the editor's block library (client)
 * and the starter templates (server). Interactive behaviour lives in /public/runtime.js,
 * styling in /public/runtime.css — markup only uses classes + data attributes.
 */

import { DASHBOARD, FUNNEL } from "./illustrations";

const img = (seed: string, w = 1200, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const avatar = (n: number) => `https://i.pravatar.cc/96?img=${n}`;

export function inDays(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  // Local "YYYY-MM-DDTHH:00" (what a datetime-local input expects)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

/* ───────────────────────── Widgets (small) ───────────────────────── */

export const W = {
  heading: `<h2>Your powerful headline goes here</h2>`,
  text: `<p>Write something compelling here. Double-click to edit the text, then use the Style panel on the right to change fonts, colors and spacing for each device.</p>`,
  button: `<a class="gpb-btn" href="#">Click here</a>`,
  buttonGroup: `<div class="gpb-btn-group"><a class="gpb-btn gpb-btn--lg" href="#">Get started</a><a class="gpb-btn gpb-btn--outline gpb-btn--lg" href="#">Learn more</a></div>`,
  image: `<img class="gpb-img-round" src="${img("gpb-image", 1000, 650)}" alt="Image description">`,
  iconList: `<ul class="gpb-icon-list"><li>Unlimited pages and funnels</li><li>Advanced widgets and animations</li><li>Leads sync straight into your CRM</li></ul>`,
  divider: `<hr class="gpb-divider">`,
  spacer: `<div class="gpb-spacer"></div>`,
  gradientHeading: `<h2>Make your headline <span class="gpb-gradient-text">stand out</span></h2>`,
  typing: `<h2 data-gpb="typing" data-words="Coaches|Agencies|Creators|Clinics">The page builder for <span class="gpb-typing-text">Coaches</span></h2>`,
  card: `<div class="gpb-card"><h3>Card title</h3><p>Use cards to group related content. Drop any widget inside.</p></div>`,

  tabs: `<div class="gpb-tabs" data-gpb="tabs">
  <div class="gpb-tabs-nav"><button class="gpb-tab-btn is-active" type="button">Overview</button><button class="gpb-tab-btn" type="button">Features</button><button class="gpb-tab-btn" type="button">Results</button></div>
  <div class="gpb-tab-panel is-active"><p>Overview content. Click a tab title to switch panels. To add a tab, duplicate a tab button and a panel in the Layers panel.</p></div>
  <div class="gpb-tab-panel"><p>Feature content goes here.</p></div>
  <div class="gpb-tab-panel"><p>Results content goes here.</p></div>
</div>`,

  accordion: (items: [string, string][] = [
    ["How long does setup take?", "Most customers publish their first page in under 15 minutes using our templates."],
    ["Do leads go into my CRM?", "Yes. Every form submission creates or updates a contact, applies your tags and can start a workflow."],
    ["Can I cancel anytime?", "Absolutely. There are no contracts — cancel with one click."],
  ]) =>
    `<div class="gpb-accordion" data-gpb="accordion" data-single="true">${items
      .map(
        ([q, a], i) =>
          `<div class="gpb-acc-item${i === 0 ? " is-open" : ""}"><button class="gpb-acc-head" type="button">${q}</button><div class="gpb-acc-body"><div class="gpb-acc-content"><p>${a}</p></div></div></div>`,
      )
      .join("")}</div>`,

  counter: (target = "2500", label = "Happy customers", suffix = "+") =>
    `<div class="gpb-counter" data-gpb="counter" data-target="${target}" data-duration="2000"><div class="gpb-counter-value"><span class="gpb-counter-num">${target}</span><span>${suffix}</span></div><div class="gpb-counter-label">${label}</div></div>`,

  countdown: () =>
    `<div class="gpb-countdown" data-gpb="countdown" data-date="${inDays(7)}" data-evergreen="0"><div class="gpb-cd-grid"><div class="gpb-cd-unit"><span class="gpb-cd-num gpb-cd-days">00</span><span class="gpb-cd-label">Days</span></div><div class="gpb-cd-unit"><span class="gpb-cd-num gpb-cd-hours">00</span><span class="gpb-cd-label">Hours</span></div><div class="gpb-cd-unit"><span class="gpb-cd-num gpb-cd-minutes">00</span><span class="gpb-cd-label">Minutes</span></div><div class="gpb-cd-unit"><span class="gpb-cd-num gpb-cd-seconds">00</span><span class="gpb-cd-label">Seconds</span></div></div><div class="gpb-cd-expired">This offer has expired.</div></div>`,

  beforeAfter: `<div class="gpb-ba" data-gpb="before-after" data-start="50"><img src="${img("modern", 1000, 600)}?grayscale" alt="Before"><div class="gpb-ba-after"><img src="${img("modern", 1000, 600)}" alt="After"></div><div class="gpb-ba-handle"></div><span class="gpb-ba-label gpb-ba-label--before">Before</span><span class="gpb-ba-label gpb-ba-label--after">After</span></div>`,

  progress: `<div><div class="gpb-progress" data-gpb="progress" data-value="92"><div class="gpb-progress-label"><span>Strategy</span><span>92%</span></div><div class="gpb-progress-track"><div class="gpb-progress-bar"></div></div></div><div class="gpb-progress" data-gpb="progress" data-value="80"><div class="gpb-progress-label"><span>Design</span><span>80%</span></div><div class="gpb-progress-track"><div class="gpb-progress-bar"></div></div></div><div class="gpb-progress" data-gpb="progress" data-value="68"><div class="gpb-progress-label"><span>Development</span><span>68%</span></div><div class="gpb-progress-track"><div class="gpb-progress-bar"></div></div></div></div>`,

  flipBox: `<div class="gpb-flip"><div class="gpb-flip-inner"><div class="gpb-flip-front"><div class="gpb-feature-icon">★</div><h3>Hover me</h3><p>Front side content</p></div><div class="gpb-flip-back"><h3>Surprise!</h3><p>Back side content with a call to action.</p><a class="gpb-btn gpb-btn--white" href="#">Learn more</a></div></div></div>`,

  marquee: `<div class="gpb-marquee" data-gpb="marquee"><div class="gpb-marquee-track"><span class="gpb-marquee-item">ACME</span><span class="gpb-marquee-item">Globex</span><span class="gpb-marquee-item">Initech</span><span class="gpb-marquee-item">Umbrella</span><span class="gpb-marquee-item">Hooli</span><span class="gpb-marquee-item">Stark Ind.</span><span class="gpb-marquee-item">Wayne Co.</span></div></div>`,

  testimonial: (n = 32, name = "Sarah Johnson", role = "Founder, Bloom Studio") =>
    `<div class="gpb-testimonial"><div class="gpb-stars">★★★★★</div><p class="gpb-testimonial-quote">“We rebuilt our entire funnel in an afternoon. Conversions are up 38% and our team finally loves editing pages.”</p><div class="gpb-author"><img src="${avatar(n)}" alt="${name}"><div><div class="gpb-author-name">${name}</div><div class="gpb-author-role">${role}</div></div></div></div>`,

  feature: (icon = "⚡", title = "Lightning fast", text = "Pages load in milliseconds so you never lose a visitor.") =>
    `<div class="gpb-feature" data-gpb-hover="lift"><div class="gpb-feature-icon">${icon}</div><h3>${title}</h3><p>${text}</p></div>`,

  form: (cta = "Get instant access") =>
    `<form class="gpb-form" data-gpb-form="new" data-tags="website-lead" data-success="Thanks! Check your inbox for the next steps."><div class="gpb-form-row"><div class="gpb-field"><label>First name</label><input name="firstName" type="text" placeholder="Jane" required></div><div class="gpb-field"><label>Last name</label><input name="lastName" type="text" placeholder="Doe"></div></div><div class="gpb-field"><label>Email</label><input name="email" type="email" placeholder="jane@company.com" required></div><div class="gpb-field"><label>Phone</label><input name="phone" type="tel" placeholder="+1 555 000 0000"></div><div class="gpb-hp" aria-hidden="true"><input name="_hp" type="text" tabindex="-1" autocomplete="off"></div><button class="gpb-btn gpb-btn--lg gpb-btn--block" type="submit">${cta}</button><div class="gpb-form-msg" role="status"></div><p class="gpb-form-note">We respect your privacy. Unsubscribe anytime.</p></form>`,


  video: `<div class="gpb-video"><iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`,
};

/** Popup (modal) with an embedded lead form. Opened by any element with data-gpb-open="<id>". */
export const popupModal = (id = "popup-offer", exitIntent = false) =>
  `<div class="gpb-modal" id="${id}" data-gpb="modal" data-auto-open="0" data-exit-intent="${exitIntent}" data-once="true"><div class="gpb-modal-box gpb-center"><button class="gpb-modal-close" type="button" aria-label="Close">×</button><span class="gpb-eyebrow">Wait!</span><h2>Get 20% off today</h2><p class="gpb-lead">Join the list and we'll send your discount code instantly.</p>${W.form("Send my code")}</div></div>`;

/** Trigger button + popup. */
export const popupWithForm = () => `<div><a class="gpb-btn" href="#" data-gpb-open="popup-offer">Open popup</a>${popupModal()}</div>`;

/* ───────────────────────── Prebuilt sections ───────────────────────── */

export const S = {
  navbar: `<nav class="gpb-nav" data-gpb="navbar" data-sticky="true"><a class="gpb-nav-brand" href="#">Brand<span style="color:var(--gpb-primary)">.</span></a><button class="gpb-nav-toggle" type="button" aria-label="Menu">☰</button><div class="gpb-nav-links"><a href="#features">Features</a><a href="#testimonials">Reviews</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><a class="gpb-btn" href="#signup">Get started</a></div></nav>`,

  heroSplit: `<section class="gpb-section"><div class="gpb-container"><div class="gpb-row gpb-row--center"><div class="gpb-col" data-gpb-anim="fade-up"><span class="gpb-eyebrow">New for 2026</span><h1>Launch pages that <span class="gpb-gradient-text">actually convert</span></h1><p class="gpb-lead">Build stunning, high-converting landing pages with advanced widgets, animations and pixel-perfect responsive control.</p>${W.buttonGroup}</div><div class="gpb-col" data-gpb-anim="zoom-in"><img class="gpb-img-round gpb-shadow" src="${DASHBOARD}" alt="Product dashboard preview"></div></div></div></section>`,

  heroCentered: `<section class="gpb-section gpb-section--dark gpb-center"><div class="gpb-container gpb-container--narrow"><span class="gpb-eyebrow">Free masterclass</span><h1 data-gpb="typing" data-words="Coaches|Agencies|Creators|Consultants">The growth system for <span class="gpb-typing-text">Coaches</span></h1><p class="gpb-lead">Discover the exact 3-step framework we used to add $1M in pipeline — without paid ads.</p><div class="gpb-btn-group"><a class="gpb-btn gpb-btn--lg" href="#signup">Save my free seat</a></div></div></section>`,

  logos: `<section class="gpb-section" style="padding-top:40px;padding-bottom:40px"><div class="gpb-container"><p class="gpb-center gpb-lead" style="font-size:.95rem">Trusted by 2,000+ fast-growing teams</p>${W.marquee}</div></section>`,

  features: `<section class="gpb-section gpb-section--soft" id="features"><div class="gpb-container"><div class="gpb-center" data-gpb-anim="fade-up"><span class="gpb-eyebrow">Features</span><h2>Everything you need to grow</h2><p class="gpb-lead">Powerful building blocks designed for marketers, not developers.</p></div><div class="gpb-spacer"></div><div class="gpb-grid" style="--gpb-cols:3"><div data-gpb-anim="fade-up">${W.feature("⚡", "Lightning fast", "Pages load in milliseconds so you never lose a visitor.")}</div><div data-gpb-anim="fade-up" data-gpb-delay="120">${W.feature("◎", "Built to convert", "Countdowns, popups and social proof that drive action.")}</div><div data-gpb-anim="fade-up" data-gpb-delay="240">${W.feature("⟳", "CRM connected", "Leads flow into your CRM with tags and workflows.")}</div><div data-gpb-anim="fade-up">${W.feature("▣", "Pixel-perfect responsive", "Fine-tune every element for desktop, tablet and mobile.")}</div><div data-gpb-anim="fade-up" data-gpb-delay="120">${W.feature("✦", "Scroll animations", "Bring sections to life with entrance and hover effects.")}</div><div data-gpb-anim="fade-up" data-gpb-delay="240">${W.feature("☰", "Templates", "Start from proven, high-converting layouts.")}</div></div></div></section>`,

  stats: `<section class="gpb-section gpb-section--brand"><div class="gpb-container"><div class="gpb-grid" style="--gpb-cols:4">${W.counter("2500", "Happy customers")}${W.counter("98", "Satisfaction rate", "%")}${W.counter("4.9", "Average rating", "/5")}${W.counter("150", "Countries", "+")}</div></div></section>`,

  testimonials: `<section class="gpb-section" id="testimonials"><div class="gpb-container"><div class="gpb-center"><span class="gpb-eyebrow">Testimonials</span><h2>Loved by thousands</h2></div><div class="gpb-spacer"></div><div class="gpb-carousel" data-gpb="carousel" data-per-view="3" data-autoplay="5000"><div class="gpb-car-track"><div class="gpb-car-slide">${W.testimonial(32, "Sarah Johnson", "Founder, Bloom Studio")}</div><div class="gpb-car-slide">${W.testimonial(12, "Marcus Lee", "CEO, Peak Fitness")}</div><div class="gpb-car-slide">${W.testimonial(47, "Priya Patel", "Agency Owner")}</div><div class="gpb-car-slide">${W.testimonial(15, "Daniel Kim", "Marketing Director")}</div><div class="gpb-car-slide">${W.testimonial(44, "Emma Wilson", "Coach")}</div></div><button class="gpb-car-prev" type="button" aria-label="Previous">‹</button><button class="gpb-car-next" type="button" aria-label="Next">›</button><div class="gpb-car-dots"></div></div></div></section>`,

  pricing: `<section class="gpb-section gpb-section--soft" id="pricing"><div class="gpb-container"><div class="gpb-center"><span class="gpb-eyebrow">Pricing</span><h2>Simple, transparent pricing</h2></div><div class="gpb-pricing" data-gpb="pricing"><div class="gpb-price-switch"><span>Monthly</span><label><input type="checkbox"><span class="gpb-switch-ui"></span></label><span>Yearly</span><span class="gpb-save-badge">Save 20%</span></div><div class="gpb-grid" style="--gpb-cols:3;align-items:stretch">${[
    ["Starter", "29", "23", ["1 website", "5 landing pages", "Email support"], false],
    ["Pro", "79", "63", ["5 websites", "Unlimited pages", "All widgets", "Priority support"], true],
    ["Agency", "199", "159", ["Unlimited websites", "White-label", "Team seats", "Dedicated manager"], false],
  ]
    .map(
      ([name, m, y, feats, featured]) =>
        `<div class="gpb-price-card${featured ? " is-featured" : ""}">${featured ? `<span class="gpb-price-badge">Most popular</span>` : ""}<div class="gpb-price-name">${name}</div><div class="gpb-price-amount"><span style="font-size:1.5rem;font-weight:700">$</span><span class="gpb-price" data-monthly="${m}" data-yearly="${y}">${m}</span><span class="gpb-price-period">/month</span></div><ul class="gpb-icon-list">${(feats as string[]).map((f) => `<li>${f}</li>`).join("")}</ul><a class="gpb-btn${featured ? "" : " gpb-btn--outline"} gpb-btn--block" href="#signup">Choose ${name}</a></div>`,
    )
    .join("")}</div></div></div></section>`,

  faq: `<section class="gpb-section" id="faq"><div class="gpb-container gpb-container--narrow"><div class="gpb-center"><span class="gpb-eyebrow">FAQ</span><h2>Frequently asked questions</h2></div><div class="gpb-spacer"></div>${W.accordion()}</div></section>`,

  tabsSection: `<section class="gpb-section"><div class="gpb-container"><div class="gpb-row gpb-row--center"><div class="gpb-col"><span class="gpb-eyebrow">How it works</span><h2>One platform, every step</h2>${W.tabs}</div><div class="gpb-col"><img class="gpb-img-round gpb-shadow" src="${FUNNEL}" alt="Funnel steps"></div></div></div></section>`,

  countdownSection: `<section class="gpb-section gpb-section--dark gpb-center"><div class="gpb-container gpb-container--narrow"><span class="gpb-eyebrow">Limited time</span><h2>Doors close soon</h2><p class="gpb-lead">Lock in founding-member pricing before the timer hits zero.</p>${W.countdown()}<div class="gpb-spacer"></div><a class="gpb-btn gpb-btn--lg gpb-btn--secondary" href="#signup">Claim my spot</a></div></section>`,

  beforeAfterSection: `<section class="gpb-section"><div class="gpb-container"><div class="gpb-row gpb-row--center"><div class="gpb-col"><span class="gpb-eyebrow">Real results</span><h2>See the transformation</h2><p class="gpb-lead">Drag the slider to compare. Perfect for agencies, clinics, renovations and designers.</p>${W.iconList}</div><div class="gpb-col">${W.beforeAfter}</div></div></div></section>`,

  videoSection: `<section class="gpb-section gpb-section--soft"><div class="gpb-container gpb-container--narrow gpb-center"><span class="gpb-eyebrow">Watch</span><h2>See it in action (2 min)</h2><div class="gpb-spacer" style="height:24px"></div><div class="gpb-shadow" style="border-radius:var(--gpb-radius)">${W.video}</div></div></section>`,

  leadForm: `<section class="gpb-section gpb-section--soft" id="signup"><div class="gpb-container"><div class="gpb-row gpb-row--center"><div class="gpb-col"><span class="gpb-eyebrow">Get started</span><h2>Claim your free strategy session</h2><p class="gpb-lead">Fill in the form and our team will reach out within 24 hours.</p>${W.iconList}</div><div class="gpb-col"><div class="gpb-card gpb-shadow" style="padding:36px">${W.form()}</div></div></div></div></section>`,

  cta: `<section class="gpb-section gpb-section--brand gpb-center"><div class="gpb-container gpb-container--narrow"><h2>Ready to build pages your clients will love?</h2><p class="gpb-lead">Start free today. No credit card required.</p><div class="gpb-btn-group" style="justify-content:center"><a class="gpb-btn gpb-btn--white gpb-btn--lg" href="#signup" data-gpb-hover="grow">Start building now</a></div></div></section>`,

  footer: `<footer class="gpb-section gpb-section--dark" style="padding-top:48px;padding-bottom:48px"><div class="gpb-container"><div class="gpb-row gpb-row--center"><div class="gpb-col"><div class="gpb-nav-brand" style="color:#fff">Brand<span style="color:var(--gpb-primary)">.</span></div><p style="opacity:.7;margin:8px 0 0">© 2026 Brand Inc. All rights reserved.</p></div><div class="gpb-col" style="text-align:right"><a href="#" style="color:#fff;margin-left:18px">Privacy</a><a href="#" style="color:#fff;margin-left:18px">Terms</a><a href="#" style="color:#fff;margin-left:18px">Contact</a></div></div></div></footer>`,
};
