"use client";

import { useEffect, useRef, useState } from "react";

const POS_KEY = "pf-navigator-pos";

/**
 * Floating "Navigator" window (the page structure / layers tree). It stays mounted so GrapesJS can render the
 * layer tree into #gpb-layers once; opening and closing only toggles visibility. Drag it by its header.
 */
export default function Navigator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") return saved;
    } catch {}
    return { x: -1, y: 16 }; // -1 = dock to the right edge of the canvas
  });

  // Keep the window inside the canvas when the editor is resized.
  useEffect(() => {
    if (!open) return;
    const clamp = () => {
      const el = ref.current;
      const parent = el?.parentElement;
      if (!el || !parent || pos.x < 0) return;
      const maxX = Math.max(0, parent.clientWidth - el.offsetWidth - 8);
      const maxY = Math.max(0, parent.clientHeight - 60);
      if (pos.x > maxX || pos.y > maxY) setPos({ x: Math.min(pos.x, maxX), y: Math.min(pos.y, maxY) });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open, pos]);

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    e.preventDefault();
    const box = el.getBoundingClientRect();
    const pbox = parent.getBoundingClientRect();
    const dx = e.clientX - box.left;
    const dy = e.clientY - box.top;
    const move = (ev: PointerEvent) => {
      const x = Math.max(0, Math.min(ev.clientX - pbox.left - dx, pbox.width - box.width - 4));
      const y = Math.max(0, Math.min(ev.clientY - pbox.top - dy, pbox.height - 48));
      setPos({ x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPos((p) => {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(p));
        } catch {}
        return p;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const style = pos.x < 0 ? { right: 16, top: pos.y } : { left: pos.x, top: pos.y };

  return (
    <div ref={ref} className="navigator" hidden={!open} style={style} role="dialog" aria-label="Navigator">
      <div className="navigator-head" onPointerDown={startDrag}>
        <span className="navigator-grip" aria-hidden="true">
          ⋮⋮
        </span>
        <b>Navigator</b>
        <span className="muted navigator-hint">Drag to move</span>
        <button type="button" className="icon-btn" aria-label="Close navigator" title="Close (Ctrl+I)" onClick={onClose}>
          ×
        </button>
      </div>
      <div id="gpb-layers" className="navigator-body" />
    </div>
  );
}
