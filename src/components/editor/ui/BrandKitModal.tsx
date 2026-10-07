"use client";

import { useState } from "react";
import { type BrandKit, type KitColor, TEXT_STYLES } from "@/lib/brandkit";
import { FONTS } from "@/lib/theme";
import type { Typography } from "@/lib/widgets/types";
import { Modal } from "../../ui";
import { ControlField, type ControlCtx } from "../panel/controls";

export interface KitInfo {
  kit: BrandKit;
  source: "location" | "agency" | "default";
  canEditAgency: boolean;
  agencyKit: BrandKit | null;
  suggestedLogo?: string;
}

const CORE = new Set(["primary", "secondary", "text", "background"]);

/** Edits the sub-account brand kit (or the agency default). Changes apply to every page that follows the kit. */
export default function BrandKitModal({ info, ctx, pageUsesKit, onPageUsesKit, onSave, onReset, onClose }: {
  info: KitInfo;
  ctx: ControlCtx;
  /** null = no page context (e.g. library editor). */
  pageUsesKit: boolean | null;
  onPageUsesKit: (v: boolean) => void;
  onSave: (kit: BrandKit, scope: "location" | "agency") => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"location" | "agency">("location");
  const [kit, setKit] = useState<BrandKit>(() => structuredClone(info.kit));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const switchScope = (s: "location" | "agency") => {
    setScope(s);
    setKit(structuredClone(s === "agency" ? (info.agencyKit ?? info.kit) : info.kit));
  };
  const patch = (p: Partial<BrandKit>) => {
    setKit({ ...kit, ...p });
    setSaved(false);
  };
  const setColor = (i: number, c: Partial<KitColor>) => patch({ colors: kit.colors.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const addColor = () => {
    const n = kit.colors.length - 3;
    patch({ colors: [...kit.colors, { id: `color-${Date.now().toString(36)}`, label: `Brand ${n}`, value: "#0ea5e9" }] });
  };

  // Typography presets reuse the panel's typography control, editing the current device.
  const textCtx: ControlCtx = { ...ctx, colors: kit.colors };

  return (
    <Modal title="Brand kit" onClose={onClose} width={640}>
      <p className="muted">
        Colors, fonts and text styles shared by every page in this sub-account. Widgets that use a brand color update automatically, and live pages
        pick up changes without republishing.
      </p>
      {info.canEditAgency && (
        <div className="wp-seg kit-scope">
          <button type="button" className={scope === "location" ? "active" : ""} onClick={() => switchScope("location")}>
            This sub-account
          </button>
          <button type="button" className={scope === "agency" ? "active" : ""} onClick={() => switchScope("agency")}>
            Agency default (all sub-accounts)
          </button>
        </div>
      )}
      {scope === "location" && info.source === "agency" && <div className="notice">This sub-account currently uses your agency&apos;s brand kit. Saving creates its own copy.</div>}
      {pageUsesKit === false && (
        <div className="notice warn kit-page">
          This page was created before brand kits and uses its own colors and fonts.
          <button type="button" className="btn btn-sm" onClick={() => onPageUsesKit(true)}>
            Switch this page to the brand kit
          </button>
        </div>
      )}

      <h4 className="kit-h">Colors</h4>
      <div className="kit-colors">
        {kit.colors.map((c, i) => (
          <div key={c.id} className="kit-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.value) ? c.value : "#000000"} onChange={(e) => setColor(i, { value: e.target.value })} aria-label={`${c.label} color`} />
            <input className="input" value={c.label} disabled={CORE.has(c.id)} onChange={(e) => setColor(i, { label: e.target.value })} aria-label="Color name" />
            <input className="input kit-hex" value={c.value} onChange={(e) => setColor(i, { value: e.target.value })} aria-label="Hex value" />
            {!CORE.has(c.id) && (
              <button type="button" className="icon-btn" title="Remove color" onClick={() => patch({ colors: kit.colors.filter((_, j) => j !== i) })}>
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={addColor}>
          + Add color
        </button>
      </div>

      <h4 className="kit-h">Fonts</h4>
      <div className="form-grid kit-two">
        {(["heading", "body"] as const).map((k) => (
          <label key={k} className="field">
            <span>{k === "heading" ? "Headings" : "Body text"}</span>
            <select className="input" value={kit.fonts[k]} onChange={(e) => patch({ fonts: { ...kit.fonts, [k]: e.target.value } })}>
              {FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <h4 className="kit-h">Text styles</h4>
      <p className="muted">Sizes apply to the device selected in the editor ({ctx.device}).</p>
      <div className="kit-text">
        {TEXT_STYLES.map(({ key, label }) => (
          <ControlField
            key={key}
            control={{ type: "typography", key, label }}
            settings={kit.text as Record<string, unknown>}
            onChange={(k, v) => patch({ text: { ...kit.text, [k]: v as Typography } })}
            ctx={textCtx}
          />
        ))}
      </div>

      <h4 className="kit-h">Layout</h4>
      <div className="form-grid kit-two">
        <label className="field">
          <span>Corner radius: {kit.radius}px</span>
          <input type="range" min={0} max={40} value={kit.radius} onChange={(e) => patch({ radius: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Content width: {kit.contentWidth}px</span>
          <input type="range" min={720} max={1600} step={10} value={kit.contentWidth} onChange={(e) => patch({ contentWidth: Number(e.target.value) })} />
        </label>
      </div>

      <h4 className="kit-h">Logo</h4>
      <div className="kit-logo">
        {kit.logoUrl ? <img src={kit.logoUrl} alt="Logo" /> : <span className="muted">No logo</span>}
        <button type="button" className="btn btn-sm" onClick={async () => patch({ logoUrl: (await ctx.pickImage()) ?? kit.logoUrl })}>
          Choose…
        </button>
        {!kit.logoUrl && info.suggestedLogo && (
          <button type="button" className="btn btn-sm" onClick={() => patch({ logoUrl: info.suggestedLogo })}>
            Use logo from HighLevel profile
          </button>
        )}
        {kit.logoUrl && (
          <button type="button" className="btn btn-sm" onClick={() => patch({ logoUrl: undefined })}>
            Remove
          </button>
        )}
      </div>
      <p className="muted">Navbars without their own logo show this one.</p>

      <div className="kit-foot">
        {scope === "location" && info.source === "location" && info.canEditAgency !== undefined && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              if (!confirm("Remove this sub-account's own brand kit and use the agency default (or built-in default)?")) return;
              setBusy(true);
              await onReset();
              setBusy(false);
              onClose();
            }}
          >
            Reset to default
          </button>
        )}
        <span className="muted">{saved ? "Saved ✓" : ""}</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(kit, scope);
              setSaved(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : scope === "agency" ? "Save agency kit" : "Save brand kit"}
        </button>
      </div>
    </Modal>
  );
}
