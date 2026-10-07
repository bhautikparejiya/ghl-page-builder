"use client";

import type { Editor } from "grapesjs";
import { useEffect, useState } from "react";
import { colorVar } from "@/lib/widgets/css";
import type { KitColor } from "../panel/controls";

/** Floating formatting toolbar shown while text is being edited directly on the canvas. */
export default function InlineToolbar({ editor, el, colors, rich }: { editor: Editor; el: HTMLElement; colors: KitColor[]; rich: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    const place = () => {
      const p = editor.Canvas.getElementPos(el);
      if (p) setPos({ top: Math.max(4, p.top - 44), left: Math.max(4, p.left) });
    };
    place();
    const win = editor.Canvas.getWindow();
    win?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => {
      win?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      ro.disconnect();
    };
  }, [editor, el]);

  if (!pos) return null;
  const doc = el.ownerDocument;

  const run = (cmd: string, arg?: string) => {
    el.focus();
    doc.execCommand("styleWithCSS", false, "true");
    doc.execCommand(cmd, false, arg);
  };

  /** Wraps the selection in a span (gradient highlight or brand color; brand colors stay linked to the kit). */
  const wrap = (attrs: { className?: string; color?: string }) => {
    el.focus();
    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const span = doc.createElement("span");
    if (attrs.className) span.className = attrs.className;
    if (attrs.color) span.style.color = attrs.color;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    const r = doc.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
  };

  const link = () => {
    const sel = doc.getSelection();
    const saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const url = window.prompt("Link URL (https://… or #section)");
    if (!url || !saved) return;
    el.focus();
    sel!.removeAllRanges();
    sel!.addRange(saved);
    run("createLink", url);
  };

  const btn = (title: string, label: React.ReactNode, onClick: () => void) => (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="inline-toolbar" data-pf-inline-toolbar style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => e.preventDefault()}>
      {btn("Bold (Ctrl+B)", <b>B</b>, () => run("bold"))}
      {btn("Italic (Ctrl+I)", <i>I</i>, () => run("italic"))}
      {btn("Underline (Ctrl+U)", <u>U</u>, () => run("underline"))}
      {btn("Link", "🔗", link)}
      {btn("Highlight with brand gradient", "✦", () => wrap({ className: "gpb-gradient-text" }))}
      <span className="inline-toolbar-sep" />
      {btn("Text color", <span className="inline-toolbar-color">A</span>, () => setShowColors(!showColors))}
      {rich && btn("Bulleted list", "•", () => run("insertUnorderedList"))}
      {btn("Clear formatting", "⌫", () => run("removeFormat"))}
      {showColors && (
        <div className="inline-toolbar-colors">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              style={{ background: c.value }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                wrap({ color: `var(${colorVar(c.id)})` });
                setShowColors(false);
              }}
            />
          ))}
        </div>
      )}
      <span className="inline-toolbar-hint">Esc to cancel · click outside to save</span>
    </div>
  );
}
