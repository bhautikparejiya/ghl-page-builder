import accordion from "./accordion";
import { advancedGroups } from "./advanced";
import { animatedHeadline, html, iconList, iconWidget, image, map, socialIcons, starRating, text, video } from "./basic";
import button from "./button";
import { beforeAfter, counter, countdown, featureBox, flipBox, logoMarquee, pricing, progress, tabs, testimonial, testimonialCarousel } from "./content";
import { form, popup } from "./forms";
import heading from "./heading";
import { buyButton, calendar, ghlForm, reviewsEmbed } from "./highlevel";
import { container, divider, section, spacer } from "./layout";
import { navbar } from "./navbar";
import type { WidgetDef } from "./types";

/** Every schema widget, in library order. */
export const WIDGETS: WidgetDef[] = [
  section,
  container,
  navbar,
  heading,
  text,
  button,
  image,
  video,
  iconWidget,
  iconList,
  divider,
  spacer,
  socialIcons,
  map,
  html,
  animatedHeadline,
  tabs,
  accordion,
  counter,
  countdown,
  progress,
  testimonial,
  testimonialCarousel,
  featureBox,
  pricing,
  flipBox,
  beforeAfter,
  logoMarquee,
  starRating,
  form,
  popup,
  calendar,
  ghlForm,
  reviewsEmbed,
  buyButton,
];

const byType = new Map(WIDGETS.map((w) => [w.type, w]));

export const getWidget = (type: string | undefined) => (type ? byType.get(type) : undefined);

/** Editor component type for a widget, e.g. "pf-heading". */
export const componentType = (type: string) => `pf-${type}`;

export { advancedGroups };
export { widgetCss, widgetHtml } from "./render";
export * from "./types";
