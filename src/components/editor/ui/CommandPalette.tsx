"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  hint?: string;
  run: () => void;
}

/** Ctrl+K quick search: add widgets and sections, jump to elements, run editor actions. */
export default function CommandPalette({ commands, onClose }: { commands: PaletteCommand[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = commands
      .map((c) => {
        const hay = `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        const starts = words.length && c.label.toLowerCase().startsWith(words[0]) ? 0 : 1;
        return { c, score: starts };
      })
      .filter(Boolean) as { c: PaletteCommand; score: number }[];
    return scored.sort((a, b) => a.score - b.score).map((s) => s.c).slice(0, 60);
  }, [commands, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c: PaletteCommand | undefined) => {
    if (!c) return;
    onClose();
    setTimeout(c.run, 0);
  };

  let lastGroup = "";
  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          className="palette-input"
          autoFocus
          placeholder="Search widgets, sections, elements and actions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(results[active]);
            } else if (e.key === "Escape") onClose();
          }}
        />
        <div className="palette-list" ref={listRef} role="listbox">
          {results.length === 0 && <p className="muted palette-empty">No matches.</p>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && <div className="palette-group">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-i={i}
                  className={i === active ? "active" : ""}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(c)}
                >
                  <span>{c.label}</span>
                  {c.hint && <kbd>{c.hint}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">↑↓ to move · Enter to run · Esc to close</div>
      </div>
    </div>
  );
}

export const SHORTCUTS: [string, string][] = [
  ["Ctrl + K", "Search widgets, sections and actions"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Undo / redo"],
  ["Ctrl + S", "Save now"],
  ["Ctrl + D", "Duplicate the selected element"],
  ["Ctrl + C / Ctrl + V", "Copy / paste the selected element"],
  ["Ctrl + Alt + C / Ctrl + Alt + V", "Copy / paste style"],
  ["Delete", "Delete the selected element"],
  ["Ctrl + Shift + M", "Switch device (desktop → tablet → mobile)"],
  ["Ctrl + Shift + P", "Preview"],
  ["Double-click text", "Edit text on the page"],
  ["Right-click", "Element menu"],
  ["?", "Show these shortcuts"],
];
