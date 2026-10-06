import { popupModal, S } from "./sections";
import { DEFAULT_THEME, Theme } from "./theme";

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // CSS gradient used as a lightweight preview
  theme: Theme;
  html: string;
  css: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank page",
    description: "Start from scratch with an empty canvas.",
    thumbnail: "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
    theme: DEFAULT_THEME,
    html: `<section class="gpb-section"><div class="gpb-container"></div></section>`,
    css: "",
  },
  {
    id: "saas",
    name: "SaaS / Product launch",
    description: "Sticky nav, hero, features, stats, tabs, testimonials carousel, pricing toggle, FAQ and lead form.",
    thumbnail: "linear-gradient(135deg,#4f46e5,#06b6d4)",
    theme: DEFAULT_THEME,
    html: [S.navbar, S.heroSplit, S.logos, S.features, S.stats, S.tabsSection, S.testimonials, S.pricing, S.faq, S.leadForm, S.footer].join(
      "",
    ),
    css: "",
  },
  {
    id: "webinar",
    name: "Webinar / Masterclass",
    description: "Typing headline, countdown timer, video, registration form and FAQ.",
    thumbnail: "linear-gradient(135deg,#0f172a,#7c3aed)",
    theme: { ...DEFAULT_THEME, primary: "#7c3aed", secondary: "#f43f5e", headingFont: "Montserrat" },
    html: [S.heroCentered, S.countdownSection, S.videoSection, S.leadForm, S.faq, S.footer].join(""),
    css: "",
  },
  {
    id: "agency",
    name: "Local business / Agency",
    description: "Before/after slider, counters, reviews, exit-intent popup and booking form.",
    thumbnail: "linear-gradient(135deg,#059669,#facc15)",
    theme: { ...DEFAULT_THEME, primary: "#059669", secondary: "#facc15", headingFont: "DM Sans", bodyFont: "DM Sans" },
    html: [
      S.navbar,
      S.heroSplit,
      S.beforeAfterSection,
      S.stats,
      S.testimonials,
      S.leadForm,
      S.cta,
      S.footer,
      popupModal("exit-offer", true),
    ].join(""),
    css: "",
  },
];
