"use client";

import { useState } from "react";
import { GLOBAL_COLORS, resolveResponsive } from "@/lib/widgets/css";
import type { Control, Device, LinkValue, Option, Responsive, Settings, Spacing, Typography } from "@/lib/widgets/types";

export interface ControlCtx {
  device: Device;
  setDevice: (d: Device) => void;
  popups: Option[];
  /** Current theme values, for showing global color swatches. */
  themeColors: Record<string, string>;
}

const DEVICE_ICON: Record<Device, string> = { desktop: "🖥", tablet: "▭", mobile: "📱" };
const NEXT_DEVICE: Record<Device, Device> = { desktop: "tablet", tablet: "mobile", mobile: "desktop" };

/** Renders any schema control, handling per-device values and `when` conditions. */
export function ControlField({ control, settings, onChange, ctx }: {
  control: Control;
  settings: Settings;
  onChange: (key: string, value: unknown) => void;
  ctx: ControlCtx;
}) {
  if (control.when && !control.when(settings)) return null;
  const raw = settings[control.key];
  const { device } = ctx;

  let value = raw;
  let inherited = false;
  let set = (v: unknown) => onChange(control.key, v);
  let clearOverride: (() => void) | null = null;

  if (control.responsive) {
    const r = (raw ?? {}) as Responsive<unknown>;
    value = resolveResponsive(r, device);
    inherited = device !== "desktop" && r[device] === undefined && value !== undefined;
    set = (v) => onChange(control.key, { ...r, [device]: v });
    if (device !== "desktop" && r[device] !== undefined) {
      clearOverride = () => {
        const next = { ...r };
        delete next[device];
        onChange(control.key, next);
      };
    }
  }

  const stacked = ["repeater", "typography", "spacing", "link", "code"].includes(control.type) || (control.type === "text" && control.multiline);

  return (
    <div className={`wp-field${stacked ? " wp-field--stacked" : ""}${inherited ? " is-inherited" : ""}`}>
      {control.type !== "toggle" && control.type !== "repeater" && (
        <div className="wp-label">
          <span>{control.label}</span>
          {control.responsive && (
            <button
              type="button"
              className="wp-device"
              title={`Editing ${device} value. Click to switch device.`}
              onClick={() => ctx.setDevice(NEXT_DEVICE[device])}
            >
              {DEVICE_ICON[device]}
            </button>
          )}
          {clearOverride && (
            <button type="button" className="wp-reset" title={`Remove ${device} override`} onClick={clearOverride}>
              ↺
            </button>
          )}
        </div>
      )}
      <ControlInput control={control} value={value} set={set} ctx={ctx} />
      {control.help && <p className="wp-help">{control.help}</p>}
    </div>
  );
}

function ControlInput({ control, value, set, ctx }: { control: Control; value: unknown; set: (v: unknown) => void; ctx: ControlCtx }) {
  switch (control.type) {
    case "text":
      return control.multiline ? (
        <textarea className="wp-input" rows={3} value={str(value)} placeholder={control.placeholder} onChange={(e) => set(e.target.value)} />
      ) : (
        <input className="wp-input" value={str(value)} placeholder={control.placeholder} onChange={(e) => set(e.target.value)} />
      );
    case "code":
      return (
        <textarea
          className="wp-input wp-code"
          rows={5}
          spellCheck={false}
          value={str(value)}
          placeholder={control.placeholder}
          onChange={(e) => set(e.target.value)}
        />
      );
    case "select": {
      const options = control.options === "popups" ? [{ value: "", label: "None" }, ...ctx.popups] : control.options;
      return (
        <select className="wp-input" value={str(value)} onChange={(e) => set(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "buttons":
      return (
        <div className="wp-seg" role="radiogroup">
          {control.options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value === o.value}
              title={o.label}
              className={value === o.value ? "active" : ""}
              onClick={() => set(value === o.value ? undefined : o.value)}
            >
              {o.icon ? <span dangerouslySetInnerHTML={{ __html: o.icon }} /> : o.label}
            </button>
          ))}
        </div>
      );
    case "toggle":
      return (
        <label className="wp-toggle">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
          <span className="wp-switch" />
          <span>{control.label}</span>
        </label>
      );
    case "number":
      return <NumberInput value={value} set={set} min={control.min} max={control.max} step={control.step} unit={control.unit} slider={control.slider} />;
    case "color":
      return <ColorInput value={str(value)} set={set} ctx={ctx} />;
    case "typography":
      return <TypographyInput value={(value ?? {}) as Typography} set={set} ctx={ctx} />;
    case "spacing":
      return <SpacingInput value={(value ?? {}) as Spacing} set={set} />;
    case "link":
      return <LinkInput value={(value ?? {}) as LinkValue} set={set} />;
    case "repeater":
      return <RepeaterInput control={control} value={Array.isArray(value) ? (value as Settings[]) : []} set={set} ctx={ctx} />;
  }
}

const str = (v: unknown) => (v == null ? "" : String(v));

function NumberInput({ value, set, min, max, step, unit, slider, placeholder }: {
  value: unknown;
  set: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  slider?: boolean;
  placeholder?: string;
}) {
  const n = typeof value === "number" ? value : undefined;
  const parse = (s: string) => (s === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
  return (
    <div className="wp-number">
      {slider && (
        <input type="range" min={min} max={max} step={step ?? 1} value={n ?? min ?? 0} onChange={(e) => set(Number(e.target.value))} />
      )}
      <input
        className="wp-input"
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={n ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(parse(e.target.value))}
      />
      {unit && <span className="wp-unit">{unit}</span>}
    </div>
  );
}

function ColorInput({ value, set, ctx }: { value: string; set: (v: string | undefined) => void; ctx: ControlCtx }) {
  const global = value.startsWith("global:") ? value.slice(7) : null;
  const custom = value && !global ? value : "";
  return (
    <div className="wp-color">
      <div className="wp-color-row">
        {GLOBAL_COLORS.map((g) => (
          <button
            key={g.id}
            type="button"
            title={`Theme color: ${g.label}`}
            aria-pressed={global === g.id}
            className={`wp-swatch${global === g.id ? " active" : ""}`}
            style={{ background: ctx.themeColors[g.id] }}
            onClick={() => set(`global:${g.id}`)}
          />
        ))}
        <label className={`wp-swatch wp-swatch--custom${custom ? " active" : ""}`} title="Custom color" style={custom ? { background: custom } : undefined}>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(custom) ? custom : "#000000"} onChange={(e) => set(e.target.value)} />
        </label>
        <button type="button" className="wp-clear" title="Reset to default" hidden={!value} onClick={() => set(undefined)}>
          ×
        </button>
      </div>
      {custom && <input className="wp-input wp-hex" value={custom} onChange={(e) => set(e.target.value || undefined)} aria-label="Color value" />}
    </div>
  );
}

const WEIGHTS = ["", "300", "400", "500", "600", "700", "800", "900"];

function TypographyInput({ value, set, ctx }: { value: Typography; set: (v: Typography) => void; ctx: ControlCtx }) {
  const [open, setOpen] = useState(false);
  const patch = (p: Partial<Typography>) => set({ ...value, ...p });
  const d = ctx.device;
  const setResp = (k: "size" | "lineHeight", v: number | undefined) => patch({ [k]: { ...(value[k] ?? {}), [d]: v } });
  const summary =
    [
      value.font === "heading" ? "Heading font" : value.font === "body" ? "Body font" : "",
      resolveResponsive(value.size, d) && `${resolveResponsive(value.size, d)}px`,
      value.weight,
    ]
      .filter(Boolean)
      .join(" · ") || "Default";
  return (
    <div className="wp-box">
      <button type="button" className="wp-box-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{summary}</span>
        <span>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="wp-box-body">
          <label className="wp-sub">
            <span>Font</span>
            <select className="wp-input" value={value.font ?? ""} onChange={(e) => patch({ font: e.target.value as Typography["font"] })}>
              <option value="">Default</option>
              <option value="heading">Theme heading font</option>
              <option value="body">Theme body font</option>
            </select>
          </label>
          <label className="wp-sub">
            <span>Size {DEVICE_ICON[d]}</span>
            <NumberInput
              value={value.size?.[d]}
              placeholder={str(resolveResponsive(value.size, d))}
              set={(v) => setResp("size", v)}
              min={6}
              max={160}
              unit="px"
            />
          </label>
          <label className="wp-sub">
            <span>Weight</span>
            <select className="wp-input" value={value.weight ?? ""} onChange={(e) => patch({ weight: e.target.value })}>
              {WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w || "Default"}
                </option>
              ))}
            </select>
          </label>
          <label className="wp-sub">
            <span>Line height {DEVICE_ICON[d]}</span>
            <NumberInput
              value={value.lineHeight?.[d]}
              placeholder={str(resolveResponsive(value.lineHeight, d))}
              set={(v) => setResp("lineHeight", v)}
              min={0.5}
              max={3}
              step={0.05}
            />
          </label>
          <label className="wp-sub">
            <span>Letter spacing</span>
            <NumberInput value={value.letterSpacing} set={(v) => patch({ letterSpacing: v })} min={-5} max={20} step={0.1} unit="px" />
          </label>
          <label className="wp-sub">
            <span>Transform</span>
            <select className="wp-input" value={value.transform ?? ""} onChange={(e) => patch({ transform: e.target.value as Typography["transform"] })}>
              <option value="">Default</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </label>
          <label className="wp-sub">
            <span>Style</span>
            <select className="wp-input" value={value.style ?? ""} onChange={(e) => patch({ style: e.target.value as Typography["style"] })}>
              <option value="">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </label>
          <button type="button" className="wp-link-btn" onClick={() => set({})}>
            Reset typography
          </button>
        </div>
      )}
    </div>
  );
}

const SIDES = ["top", "right", "bottom", "left"] as const;

function SpacingInput({ value, set }: { value: Spacing; set: (v: Spacing) => void }) {
  const [linked, setLinked] = useState(() => SIDES.every((s) => value[s] === value.top));
  const change = (side: (typeof SIDES)[number], raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    if (linked) set({ ...value, top: n, right: n, bottom: n, left: n });
    else set({ ...value, [side]: n });
  };
  return (
    <div className="wp-spacing">
      {SIDES.map((side) => (
        <label key={side}>
          <input className="wp-input" type="number" value={value[side] ?? ""} onChange={(e) => change(side, e.target.value)} />
          <span>{side}</span>
        </label>
      ))}
      <button
        type="button"
        className={`wp-linked${linked ? " active" : ""}`}
        title={linked ? "Sides linked" : "Link all sides"}
        onClick={() => setLinked(!linked)}
      >
        {linked ? "🔗" : "⛓"}
      </button>
      <select className="wp-input wp-spacing-unit" value={value.unit ?? "px"} onChange={(e) => set({ ...value, unit: e.target.value as Spacing["unit"] })}>
        <option value="px">px</option>
        <option value="%">%</option>
        <option value="em">em</option>
      </select>
    </div>
  );
}

function LinkInput({ value, set }: { value: LinkValue; set: (v: LinkValue) => void }) {
  return (
    <div className="wp-linkinput">
      <input className="wp-input" value={value.url ?? ""} placeholder="https://… or #section" onChange={(e) => set({ ...value, url: e.target.value })} />
      <label className="wp-check">
        <input type="checkbox" checked={!!value.newTab} onChange={(e) => set({ ...value, newTab: e.target.checked })} /> Open in new tab
      </label>
      <label className="wp-check">
        <input type="checkbox" checked={!!value.nofollow} onChange={(e) => set({ ...value, nofollow: e.target.checked })} /> Add nofollow
      </label>
    </div>
  );
}

function RepeaterInput({ control, value, set, ctx }: {
  control: Extract<Control, { type: "repeater" }>;
  value: Settings[];
  set: (v: Settings[]) => void;
  ctx: ControlCtx;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const update = (i: number, key: string, v: unknown) => set(value.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
    if (open === i) setOpen(j);
  };
  return (
    <div className="wp-repeater">
      {value.map((item, i) => (
        <div key={i} className={`wp-rep-item${open === i ? " is-open" : ""}`}>
          <div className="wp-rep-head">
            <button type="button" className="wp-rep-title" onClick={() => setOpen(open === i ? null : i)}>
              {str(item[control.itemLabel]) || `Item ${i + 1}`}
            </button>
            <button type="button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" title="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" title="Duplicate" onClick={() => set([...value.slice(0, i + 1), { ...item }, ...value.slice(i + 1)])}>
              ⧉
            </button>
            <button
              type="button"
              title="Delete"
              onClick={() => {
                set(value.filter((_, j) => j !== i));
                setOpen(null);
              }}
            >
              ×
            </button>
          </div>
          {open === i && (
            <div className="wp-rep-body">
              {control.fields.map((f) => (
                <ControlField key={f.key} control={f} settings={item} onChange={(k, v) => update(i, k, v)} ctx={ctx} />
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="btn btn-sm wp-rep-add"
        onClick={() => {
          set([...value, control.newItem()]);
          setOpen(value.length);
        }}
      >
        + {control.addLabel ?? "Add item"}
      </button>
    </div>
  );
}
