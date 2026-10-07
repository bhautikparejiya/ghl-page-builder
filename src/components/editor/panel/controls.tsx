"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveResponsive } from "@/lib/widgets/css";
import { BRAND_PATHS, ICON_PATHS } from "@/lib/widgets/icon-data";
import { iconSvg, sanitizeRich } from "@/lib/widgets/render";
import type {
  Background,
  Border,
  Control,
  Device,
  DynamicOptions,
  Length,
  LinkValue,
  Option,
  Responsive,
  Settings,
  Shadow,
  Spacing,
  Typography,
} from "@/lib/widgets/types";

export interface KitColor {
  id: string;
  label: string;
  value: string;
}

export interface ControlCtx {
  device: Device;
  setDevice: (d: Device) => void;
  /** Options for dropdowns filled at runtime (popups on the page, HighLevel workflows, fields…). */
  getOptions: (source: DynamicOptions, settings: Settings) => Option[];
  /** Brand kit colors, for swatches. */
  colors: KitColor[];
  /** Google fonts offered by the typography control. */
  fonts: string[];
  /** Opens the media library and resolves with the chosen image URL. */
  pickImage: () => Promise<string | null>;
}

const DEVICE_ICON: Record<Device, string> = { desktop: "🖥", tablet: "▭", mobile: "📱" };
const NEXT_DEVICE: Record<Device, Device> = { desktop: "tablet", tablet: "mobile", mobile: "desktop" };
const STACKED = new Set(["repeater", "typography", "spacing", "link", "code", "richtext", "background", "border", "shadow", "image", "icon"]);

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
    set = (v) => {
      const next = { ...r, [device]: v };
      if (v === undefined) delete next[device];
      onChange(control.key, next);
    };
    if (device !== "desktop" && r[device] !== undefined) {
      clearOverride = () => {
        const next = { ...r };
        delete next[device];
        onChange(control.key, next);
      };
    }
  }

  const stacked = STACKED.has(control.type) || (control.type === "text" && control.multiline);

  return (
    <div className={`wp-field${stacked ? " wp-field--stacked" : ""}${inherited ? " is-inherited" : ""}`}>
      {control.type !== "toggle" && control.type !== "repeater" && (
        <div className="wp-label">
          <span>{control.label}</span>
          {control.responsive && (
            <button
              type="button"
              className="wp-device"
              title={`Editing the ${device} value. Click to switch device.`}
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
      <ControlInput control={control} value={value} set={set} ctx={ctx} settings={settings} />
      {control.help && <p className="wp-help">{control.help}</p>}
    </div>
  );
}

function ControlInput({ control, value, set, ctx, settings }: {
  control: Control;
  value: unknown;
  set: (v: unknown) => void;
  ctx: ControlCtx;
  settings: Settings;
}) {
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
          rows={control.language === "html" ? 8 : 5}
          spellCheck={false}
          value={str(value)}
          placeholder={control.placeholder}
          onChange={(e) => set(e.target.value)}
        />
      );
    case "richtext":
      return <RichTextInput value={str(value)} set={set} inline={!!control.inline} />;
    case "select": {
      const options = typeof control.options === "string" ? ctx.getOptions(control.options, settings) : control.options;
      const current = str(value);
      const known = options.some((o) => o.value === current);
      return (
        <select className="wp-input" value={current} onChange={(e) => set(e.target.value || undefined)}>
          {(control.placeholder !== undefined || typeof control.options === "string") && <option value="">{control.placeholder ?? "None"}</option>}
          {current && !known && <option value={current}>{current}</option>}
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
          {control.options.map((o) => {
            const active = value === o.value || (!value && o.value === "");
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={o.label}
                className={active ? "active" : ""}
                onClick={() => set(active || o.value === "" ? undefined : o.value)}
              >
                {o.icon ? <span dangerouslySetInnerHTML={{ __html: o.icon }} /> : o.label}
              </button>
            );
          })}
        </div>
      );
    case "toggle":
      return (
        <label className="wp-toggle">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked || undefined)} />
          <span className="wp-switch" />
          <span>{control.label}</span>
        </label>
      );
    case "number":
      return <NumberInput value={value} set={set} min={control.min} max={control.max} step={control.step} unit={control.unit} slider={control.slider} />;
    case "length":
      return <LengthInput value={(value ?? {}) as Length} set={set} units={control.units ?? ["px", "%"]} />;
    case "datetime":
      return <input className="wp-input" type="datetime-local" value={str(value)} onChange={(e) => set(e.target.value || undefined)} />;
    case "color":
      return <ColorInput value={str(value)} set={set} ctx={ctx} />;
    case "typography":
      return <TypographyInput value={(value ?? {}) as Typography} set={set} ctx={ctx} />;
    case "spacing":
      return <SpacingInput value={(value ?? {}) as Spacing} set={set} />;
    case "link":
      return <LinkInput value={(value ?? {}) as LinkValue} set={set} />;
    case "image":
      return <ImageInput value={str(value)} set={set} ctx={ctx} />;
    case "icon":
      return <IconInput value={str(value)} set={set} allowNone={!!control.allowNone} />;
    case "background":
      return <BackgroundInput value={(value ?? {}) as Background} set={set} ctx={ctx} />;
    case "border":
      return <BorderInput value={(value ?? {}) as Border} set={set} ctx={ctx} />;
    case "shadow":
      return <ShadowInput value={(value ?? {}) as Shadow} set={set} ctx={ctx} />;
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
      {slider && <input type="range" min={min} max={max} step={step ?? 1} value={n ?? min ?? 0} onChange={(e) => set(Number(e.target.value))} />}
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

function LengthInput({ value, set, units }: { value: Length; set: (v: Length | undefined) => void; units: NonNullable<Length["unit"]>[] }) {
  const unit = value.unit ?? units[0];
  return (
    <div className="wp-number">
      <input
        className="wp-input"
        type="number"
        min={0}
        value={value.value ?? ""}
        onChange={(e) => set(e.target.value === "" ? undefined : { value: Number(e.target.value), unit })}
      />
      <select className="wp-input wp-unit-select" value={unit} onChange={(e) => set({ ...value, unit: e.target.value as Length["unit"] })}>
        {units.map((u) => (
          <option key={u}>{u}</option>
        ))}
      </select>
    </div>
  );
}

function ColorInput({ value, set, ctx }: { value: string; set: (v: string | undefined) => void; ctx: ControlCtx }) {
  const global = value.startsWith("global:") ? value.slice(7) : null;
  const custom = value && !global ? value : "";
  const shown = ctx.colors.slice(0, 8);
  const extra = global && !shown.some((c) => c.id === global) ? ctx.colors.find((c) => c.id === global) : undefined;
  return (
    <div className="wp-color">
      <div className="wp-color-row">
        {[...shown, ...(extra ? [extra] : [])].map((g) => (
          <button
            key={g.id}
            type="button"
            title={`Brand color: ${g.label}`}
            aria-pressed={global === g.id}
            className={`wp-swatch${global === g.id ? " active" : ""}`}
            style={{ background: g.value }}
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

function TypographyInput({ value, set, ctx }: { value: Typography; set: (v: Typography | undefined) => void; ctx: ControlCtx }) {
  const [open, setOpen] = useState(false);
  const patch = (p: Partial<Typography>) => set({ ...value, ...p });
  const d = ctx.device;
  const setResp = (k: "size" | "lineHeight", v: number | undefined) => {
    const next = { ...(value[k] ?? {}), [d]: v };
    if (v === undefined) delete next[d];
    patch({ [k]: next });
  };
  const fontLabel = value.font === "heading" ? "Heading font" : value.font === "body" ? "Body font" : value.font?.startsWith("family:") ? value.font.slice(7) : "";
  const size = resolveResponsive(value.size, d);
  const summary = [fontLabel, size && `${size}px`, value.weight].filter(Boolean).join(" · ") || "Default";
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
            <select className="wp-input" value={value.font ?? ""} onChange={(e) => patch({ font: e.target.value || undefined })}>
              <option value="">Default</option>
              <option value="heading">Brand heading font</option>
              <option value="body">Brand body font</option>
              <optgroup label="Google fonts">
                {ctx.fonts.map((f) => (
                  <option key={f} value={`family:${f}`}>
                    {f}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="wp-sub">
            <span>Size {DEVICE_ICON[d]}</span>
            <NumberInput value={value.size?.[d]} placeholder={str(resolveResponsive(value.size, d))} set={(v) => setResp("size", v)} min={6} max={200} unit="px" />
          </label>
          <label className="wp-sub">
            <span>Weight</span>
            <select className="wp-input" value={value.weight ?? ""} onChange={(e) => patch({ weight: e.target.value || undefined })}>
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
          <button type="button" className="wp-link-btn" onClick={() => set(undefined)}>
            Reset typography
          </button>
        </div>
      )}
    </div>
  );
}

const SIDES = ["top", "right", "bottom", "left"] as const;

function SpacingInput({ value, set }: { value: Spacing; set: (v: Spacing | undefined) => void }) {
  const [linked, setLinked] = useState(() => SIDES.every((s) => value[s] === value.top));
  const change = (side: (typeof SIDES)[number], raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    const next = linked ? { ...value, top: n, right: n, bottom: n, left: n } : { ...value, [side]: n };
    set(SIDES.every((s) => next[s] === undefined) ? undefined : next);
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
        title={linked ? "Sides linked: editing one changes all" : "Link all sides"}
        aria-pressed={linked}
        onClick={() => setLinked(!linked)}
      >
        <span dangerouslySetInnerHTML={{ __html: iconSvg(linked ? "link" : "minus") }} />
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

function ImageInput({ value, set, ctx }: { value: string; set: (v: string | undefined) => void; ctx: ControlCtx }) {
  return (
    <div className="wp-image">
      <button type="button" className="wp-image-thumb" onClick={async () => set((await ctx.pickImage()) ?? (value || undefined))} title="Choose from media library">
        {value ? <img src={value} alt="" /> : <span>Choose image</span>}
      </button>
      <div className="wp-image-row">
        <input className="wp-input" value={value} placeholder="Image URL" onChange={(e) => set(e.target.value || undefined)} />
        {value && (
          <button type="button" className="wp-clear" title="Remove image" onClick={() => set(undefined)}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

const ICON_NAMES = Object.keys(ICON_PATHS);
const BRAND_NAMES = Object.keys(BRAND_PATHS).map((b) => `brand:${b}`);

function IconInput({ value, set, allowNone }: { value: string; set: (v: string | undefined) => void; allowNone: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const names = useMemo(() => {
    const all = [...ICON_NAMES, ...BRAND_NAMES];
    const s = q.trim().toLowerCase();
    return s ? all.filter((n) => n.includes(s)) : all;
  }, [q]);
  return (
    <div className="wp-icon">
      <button type="button" className="wp-icon-current" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="wp-icon-preview" dangerouslySetInnerHTML={{ __html: value ? iconSvg(value) : "" }} />
        <span>{value ? value.replace("brand:", "") : "No icon"}</span>
        <span>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="wp-icon-pop">
          <input className="wp-input" autoFocus placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="wp-icon-grid">
            {allowNone && (
              <button
                type="button"
                title="No icon"
                className={!value ? "active" : ""}
                onClick={() => {
                  set(undefined);
                  setOpen(false);
                }}
              >
                ∅
              </button>
            )}
            {names.map((n) => (
              <button
                key={n}
                type="button"
                title={n.replace("brand:", "")}
                className={value === n ? "active" : ""}
                onClick={() => {
                  set(n);
                  setOpen(false);
                }}
                dangerouslySetInnerHTML={{ __html: iconSvg(n) }}
              />
            ))}
            {!names.length && <p className="wp-help">No icons match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function BackgroundInput({ value, set, ctx }: { value: Background; set: (v: Background | undefined) => void; ctx: ControlCtx }) {
  const type = value.type ?? "";
  const patch = (p: Partial<Background>) => set({ ...value, ...p });
  return (
    <div className="wp-subgroup">
      <div className="wp-seg">
        {(
          [
            ["", "None"],
            ["color", "Color"],
            ["gradient", "Gradient"],
            ["image", "Image"],
          ] as const
        ).map(([t, label]) => (
          <button key={t} type="button" className={type === t ? "active" : ""} onClick={() => (t ? patch({ type: t }) : set(undefined))}>
            {label}
          </button>
        ))}
      </div>
      {(type === "color" || type === "image") && (
        <div className="wp-sub">
          <span>{type === "image" ? "Fallback color" : "Color"}</span>
          <ColorInput value={str(value.color)} set={(c) => patch({ color: c })} ctx={ctx} />
        </div>
      )}
      {type === "gradient" && (
        <>
          <div className="wp-sub">
            <span>From</span>
            <ColorInput value={str(value.gradient?.from)} set={(c) => patch({ gradient: { ...value.gradient, from: c } })} ctx={ctx} />
          </div>
          <div className="wp-sub">
            <span>To</span>
            <ColorInput value={str(value.gradient?.to)} set={(c) => patch({ gradient: { ...value.gradient, to: c } })} ctx={ctx} />
          </div>
          <div className="wp-sub">
            <span>Angle</span>
            <NumberInput value={value.gradient?.angle} set={(a) => patch({ gradient: { ...value.gradient, angle: a } })} min={0} max={360} unit="°" slider />
          </div>
        </>
      )}
      {type === "image" && (
        <>
          <ImageInput value={str(value.image?.url)} set={(url) => patch({ image: { ...value.image, url } })} ctx={ctx} />
          <label className="wp-sub">
            <span>Size</span>
            <select className="wp-input" value={value.image?.size ?? "cover"} onChange={(e) => patch({ image: { ...value.image, size: e.target.value as "cover" } })}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="auto">Original</option>
            </select>
          </label>
          <label className="wp-sub">
            <span>Position</span>
            <select className="wp-input" value={value.image?.position ?? "center"} onChange={(e) => patch({ image: { ...value.image, position: e.target.value } })}>
              {["center", "top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="wp-check">
            <input type="checkbox" checked={!!value.image?.fixed} onChange={(e) => patch({ image: { ...value.image, fixed: e.target.checked } })} /> Fixed while scrolling (desktop)
          </label>
          <label className="wp-check">
            <input type="checkbox" checked={!!value.image?.repeat} onChange={(e) => patch({ image: { ...value.image, repeat: e.target.checked } })} /> Repeat
          </label>
          <div className="wp-sub">
            <span>Overlay</span>
            <ColorInput value={str(value.overlay?.color)} set={(c) => patch({ overlay: { ...value.overlay, color: c } })} ctx={ctx} />
          </div>
          {value.overlay?.color && (
            <div className="wp-sub">
              <span>Overlay opacity</span>
              <NumberInput value={value.overlay?.opacity ?? 50} set={(o) => patch({ overlay: { ...value.overlay, opacity: o } })} min={0} max={100} unit="%" slider />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BorderInput({ value, set, ctx }: { value: Border; set: (v: Border | undefined) => void; ctx: ControlCtx }) {
  const patch = (p: Partial<Border>) => set({ ...value, ...p });
  return (
    <div className="wp-subgroup">
      <select className="wp-input" value={value.style ?? ""} onChange={(e) => (e.target.value ? patch({ style: e.target.value as Border["style"] }) : set(undefined))}>
        <option value="">Default</option>
        <option value="none">None</option>
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>
      {value.style && value.style !== "none" && (
        <>
          <div className="wp-sub">
            <span>Width</span>
            <NumberInput value={value.width} set={(w) => patch({ width: w })} min={0} max={20} unit="px" />
          </div>
          <div className="wp-sub">
            <span>Color</span>
            <ColorInput value={str(value.color)} set={(c) => patch({ color: c })} ctx={ctx} />
          </div>
        </>
      )}
    </div>
  );
}

function ShadowInput({ value, set, ctx }: { value: Shadow; set: (v: Shadow | undefined) => void; ctx: ControlCtx }) {
  const patch = (p: Partial<Shadow>) => set({ ...value, ...p });
  const preset = value.preset ?? "";
  return (
    <div className="wp-subgroup">
      <div className="wp-seg">
        {(
          [
            ["", "Auto"],
            ["none", "None"],
            ["sm", "S"],
            ["md", "M"],
            ["lg", "L"],
            ["xl", "XL"],
            ["custom", "…"],
          ] as const
        ).map(([p, label]) => (
          <button key={p} type="button" title={p === "custom" ? "Custom" : label} className={preset === p ? "active" : ""} onClick={() => (p ? patch({ preset: p }) : set(undefined))}>
            {label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <>
          {(
            [
              ["x", "Horizontal", -50, 50],
              ["y", "Vertical", -50, 80],
              ["blur", "Blur", 0, 120],
              ["spread", "Spread", -40, 40],
            ] as const
          ).map(([k, label, min, max]) => (
            <div key={k} className="wp-sub">
              <span>{label}</span>
              <NumberInput value={value[k]} set={(v) => patch({ [k]: v })} min={min} max={max} unit="px" />
            </div>
          ))}
          <div className="wp-sub">
            <span>Color</span>
            <ColorInput value={str(value.color)} set={(c) => patch({ color: c })} ctx={ctx} />
          </div>
        </>
      )}
    </div>
  );
}

/** Small contenteditable editor. Output is sanitized with the same allow-list used when rendering. */
function RichTextInput({ value, set, inline }: { value: string; set: (v: string) => void; inline: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Only push external changes into the editor when it isn't being typed in (keeps the caret stable).
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== value) el.innerHTML = sanitizeRich(value, inline);
  }, [value, inline]);
  const emit = () => ref.current && set(sanitizeRich(ref.current.innerHTML, inline));
  const cmd = (name: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  };
  return (
    <div className="wp-rich">
      <div className="wp-rich-bar" onMouseDown={(e) => e.preventDefault()}>
        <button type="button" title="Bold" onClick={() => cmd("bold")}>
          <b>B</b>
        </button>
        <button type="button" title="Italic" onClick={() => cmd("italic")}>
          <i>I</i>
        </button>
        <button type="button" title="Underline" onClick={() => cmd("underline")}>
          <u>U</u>
        </button>
        <button
          type="button"
          title="Link"
          onClick={() => {
            const url = prompt("Link URL (https://… or #section)");
            if (url) cmd("createLink", url);
          }}
        >
          🔗
        </button>
        {inline ? (
          <button type="button" title="Highlight with brand gradient" onClick={() => wrapSelection("gpb-gradient-text", emit)}>
            ✦
          </button>
        ) : (
          <>
            <button type="button" title="Bulleted list" onClick={() => cmd("insertUnorderedList")}>
              •
            </button>
            <button type="button" title="Numbered list" onClick={() => cmd("insertOrderedList")}>
              1.
            </button>
          </>
        )}
        <button type="button" title="Clear formatting" onClick={() => cmd("removeFormat")}>
          ⌫
        </button>
      </div>
      <div
        ref={ref}
        className={`wp-rich-area${inline ? " is-inline" : ""}`}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onKeyDown={(e) => inline && e.key === "Enter" && !e.shiftKey && e.preventDefault()}
      />
    </div>
  );
}

/** Wraps the current selection in <span class="…"> (used for the gradient highlight). */
export function wrapSelection(className: string, done: () => void, doc: Document = document) {
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = doc.createElement("span");
  span.className = className;
  span.appendChild(range.extractContents());
  range.insertNode(span);
  sel.removeAllRanges();
  done();
}

function RepeaterInput({ control, value, set, ctx }: {
  control: Extract<Control, { type: "repeater" }>;
  value: Settings[];
  set: (v: Settings[]) => void;
  ctx: ControlCtx;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const update = (i: number, key: string, v: unknown) =>
    set(
      value.map((it, j) => {
        if (j !== i) return it;
        const next = { ...it, [key]: v };
        if (v === undefined) delete next[key];
        return next;
      }),
    );
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
    if (open === i) setOpen(j);
  };
  const labelOf = (item: Settings, i: number) => {
    const raw = str(item[control.itemLabel]).replace(/<[^>]+>/g, "");
    return raw || `${control.label.replace(/s$/, "")} ${i + 1}`;
  };
  return (
    <div className="wp-repeater">
      <div className="wp-label">
        <span>{control.label}</span>
      </div>
      {value.map((item, i) => (
        <div key={i} className={`wp-rep-item${open === i ? " is-open" : ""}`}>
          <div className="wp-rep-head">
            <button type="button" className="wp-rep-title" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {labelOf(item, i)}
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
