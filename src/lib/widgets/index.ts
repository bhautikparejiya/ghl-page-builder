import accordion from "./accordion";
import { ADVANCED } from "./advanced";
import button from "./button";
import heading from "./heading";
import type { WidgetDef } from "./types";

export const WIDGETS: WidgetDef[] = [heading, button, accordion];

const byType = new Map(WIDGETS.map((w) => [w.type, w]));

export const getWidget = (type: string) => byType.get(type);

/** Editor component type for a widget, e.g. "pf-heading". */
export const componentType = (type: string) => `pf-${type}`;

export { ADVANCED };
export { widgetCss, widgetHtml } from "./render";
export * from "./types";
