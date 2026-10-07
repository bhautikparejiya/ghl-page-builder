"use client";

import type { Component, Editor } from "grapesjs";
import { useEffect, useRef } from "react";
import { canPasteStyle, copyStyle, duplicate, pasteStyle, resetStyle, topLevelOf } from "../actions";
import { globalIdOf } from "../globalSection";
import { widgetOf } from "../widgetComponents";

export interface ContextMenuState {
  x: number;
  y: number;
  component: Component;
}

/** Right-click menu for canvas elements. */
export default function ContextMenu({ editor, state, onClose, onSaveToLibrary, onShowLayers, onEditGlobal, onDetachGlobal, flash }: {
  editor: Editor;
  state: ContextMenuState;
  onClose: () => void;
  onSaveToLibrary: (c: Component) => void;
  onShowLayers: () => void;
  onEditGlobal: (id: string) => void;
  onDetachGlobal: (c: Component) => void;
  flash: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const c = state.component;
  const def = widgetOf(c);
  const globalId = globalIdOf(c);
  const top = topLevelOf(c);

  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    const frame = editor.Canvas.getWindow();
    frame?.addEventListener("mousedown", onClose);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
      frame?.removeEventListener("mousedown", onClose);
    };
  }, [editor, onClose]);

  const item = (label: string, keys: string, action: () => void, disabled = false) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        action();
        onClose();
      }}
    >
      <span>{label}</span>
      {keys && <kbd>{keys}</kbd>}
    </button>
  );

  // Keep the menu on screen.
  const x = Math.min(state.x, window.innerWidth - 240);
  const y = Math.min(state.y, window.innerHeight - 380);

  return (
    <div ref={ref} className="ctx-menu" role="menu" style={{ left: x, top: y }}>
      <div className="ctx-title">{def?.label ?? c.getName()}</div>
      {globalId ? (
        <>
          {item("Edit global section", "", () => onEditGlobal(globalId))}
          {item("Detach (make an editable copy)", "", () => onDetachGlobal(c))}
        </>
      ) : null}
      {item("Duplicate", "Ctrl+D", () => duplicate(editor, c))}
      {item("Copy", "Ctrl+C", () => {
        editor.select(c);
        editor.runCommand("core:copy");
      })}
      {item("Paste after", "Ctrl+V", () => {
        editor.select(c);
        editor.runCommand("core:paste");
      })}
      <hr />
      {item("Copy style", "Ctrl+Alt+C", () => copyStyle(c) && flash("Style copied"), !def)}
      {item("Paste style", "Ctrl+Alt+V", () => pasteStyle(c), !canPasteStyle(c))}
      {item("Reset style", "", () => resetStyle(c), !def)}
      <hr />
      {item("Select parent", "", () => c.parent() && c.parent()!.get("type") !== "wrapper" && editor.select(c.parent()!), !c.parent() || c.parent()!.get("type") === "wrapper")}
      {item("Show in Layers", "", () => {
        editor.select(c);
        onShowLayers();
      })}
      {item("Save section to library…", "", () => onSaveToLibrary(top ?? c), !!globalId)}
      <hr />
      {item("Delete", "Del", () => c.remove(), c.get("removable") === false)}
    </div>
  );
}
