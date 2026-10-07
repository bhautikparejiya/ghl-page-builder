"use client";

import type { Component, Editor } from "grapesjs";
import { type ReactNode, useEffect, useState } from "react";
import { advancedGroups, type ControlGroup, type Settings } from "@/lib/widgets";
import { getSettings, SETTINGS_PROP, widgetOf } from "../widgetComponents";
import { ControlField, type ControlCtx } from "./controls";

type Tab = "content" | "design" | "advanced";

/** Settings panel for a selected schema widget. Edits write the component's settings, which re-renders it. */
export default function WidgetPanel({ editor, component, ctx, footer }: {
  editor: Editor;
  component: Component;
  ctx: ControlCtx;
  /** Extra panel content (e.g. A/B test results). */
  footer?: ReactNode;
}) {
  const def = widgetOf(component);
  const [tab, setTab] = useState<Tab>("content");
  const [settings, setSettings] = useState<Settings>(() => getSettings(component));
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  // Stay in sync with undo/redo, inline edits and other external changes.
  useEffect(() => {
    setSettings(getSettings(component));
    const sync = (c: Component) => c === component && setSettings(getSettings(component));
    editor.on(`component:update:${SETTINGS_PROP}`, sync);
    return () => {
      editor.off(`component:update:${SETTINGS_PROP}`, sync);
    };
  }, [editor, component]);

  if (!def) return null;

  const onChange = (key: string, value: unknown) => {
    const next = { ...getSettings(component), [key]: value };
    if (value === undefined) delete next[key];
    component.set(SETTINGS_PROP, next);
    setSettings(next);
  };

  const groups: ControlGroup[] = tab === "content" ? def.content : tab === "design" ? def.design : advancedGroups(def);
  const groupKey = (g: ControlGroup) => `${tab}:${g.label}`;
  const isClosed = (g: ControlGroup) => closed[groupKey(g)] ?? !!g.closed;

  // Breadcrumb: parents up to the page, so nested containers are easy to reach.
  const crumbs: Component[] = [];
  for (let p = component.parent(); p && p.get("type") !== "wrapper"; p = p.parent()) crumbs.unshift(p);

  return (
    <div className="wp">
      <div className="wp-title">
        <span dangerouslySetInnerHTML={{ __html: def.icon.replace(/width="\d+" height="\d+"/, 'width="18" height="18"') }} />
        <strong>{def.label}</strong>
      </div>
      {crumbs.length > 0 && (
        <nav className="wp-crumbs" aria-label="Parents">
          {crumbs.map((c, i) => (
            <span key={i}>
              <button type="button" onClick={() => editor.select(c)}>
                {widgetOf(c)?.label ?? c.getName()}
              </button>
              <span aria-hidden="true">›</span>
            </span>
          ))}
          <span className="wp-crumb-current">{def.label}</span>
        </nav>
      )}
      <div className="tabs">
        {(["content", "design", "advanced"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="panel-scroll">
        {groups.length === 0 && <p className="panel-hint">Nothing to style here. Use the Advanced tab for spacing and effects.</p>}
        {groups.map((g) => (
          <section key={g.label} className={`wp-group${isClosed(g) ? " is-closed" : ""}`}>
            <button className="wp-group-head" onClick={() => setClosed({ ...closed, [groupKey(g)]: !isClosed(g) })} aria-expanded={!isClosed(g)}>
              <span>{g.label}</span>
              <span className="wp-caret">▾</span>
            </button>
            {!isClosed(g) && (
              <div className="wp-group-body">
                {g.controls.map((c) => (
                  <ControlField key={c.key} control={c} settings={settings} onChange={onChange} ctx={ctx} />
                ))}
              </div>
            )}
          </section>
        ))}
        {tab === "advanced" && footer}
      </div>
    </div>
  );
}
