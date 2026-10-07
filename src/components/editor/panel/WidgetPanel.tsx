"use client";

import type { Component, Editor } from "grapesjs";
import { useEffect, useState } from "react";
import { ADVANCED, getWidget, type ControlGroup, type Settings } from "@/lib/widgets";
import { getSettings, listPopups, SETTINGS_PROP, WIDGET_PROP } from "../widgetComponents";
import { ControlField, type ControlCtx } from "./controls";

type Tab = "content" | "design" | "advanced";

/** Settings panel for a selected schema widget. Edits write the component's settings, which re-renders it. */
export default function WidgetPanel({ editor, component, ctx }: {
  editor: Editor;
  component: Component;
  ctx: Omit<ControlCtx, "popups">;
}) {
  const def = getWidget(component.get(WIDGET_PROP));
  const [tab, setTab] = useState<Tab>("content");
  const [settings, setSettings] = useState<Settings>(() => getSettings(component));
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  // Stay in sync with undo/redo and other external changes.
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

  const groups: ControlGroup[] = tab === "content" ? def.content : tab === "design" ? def.design : ADVANCED;
  const fullCtx: ControlCtx = { ...ctx, popups: listPopups(editor) };
  const groupKey = (g: ControlGroup) => `${tab}:${g.label}`;
  const isClosed = (g: ControlGroup) => closed[groupKey(g)] ?? !!g.closed;

  return (
    <div className="wp">
      <div className="wp-title">
        <span dangerouslySetInnerHTML={{ __html: def.icon.replace(/width="\d+" height="\d+"/, 'width="18" height="18"') }} />
        <strong>{def.label}</strong>
      </div>
      <div className="tabs">
        {(["content", "design", "advanced"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="panel-scroll">
        {groups.map((g) => (
          <section key={g.label} className={`wp-group${isClosed(g) ? " is-closed" : ""}`}>
            <button className="wp-group-head" onClick={() => setClosed({ ...closed, [groupKey(g)]: !isClosed(g) })} aria-expanded={!isClosed(g)}>
              <span>{g.label}</span>
              <span className="wp-caret">▾</span>
            </button>
            {!isClosed(g) && (
              <div className="wp-group-body">
                {g.controls.map((c) => (
                  <ControlField key={c.key} control={c} settings={settings} onChange={onChange} ctx={fullCtx} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
