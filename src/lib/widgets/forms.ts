import { buttonCss } from "./button";
import { borderDecls, color, length, px, typography } from "./css";
import { esc, sanitizeRich } from "./render";
import { ALIGN3, boxControls, boxCss, icon, list, num, opts, str } from "./shared";
import { type Border, defineWidget, type Length, type Responsive, type Settings, type Typography } from "./types";

/* ── Lead form ── */

/** HighLevel standard contact fields a form field can map to. Custom fields map to "cf:<id>". */
export const CONTACT_FIELDS = opts(
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["name", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["companyName", "Company"],
  ["website", "Website"],
  ["address1", "Street address"],
  ["city", "City"],
  ["state", "State / region"],
  ["postalCode", "Postal code"],
  ["country", "Country"],
);

export type FormField = {
  type?: string;
  label?: string;
  map?: string;
  placeholder?: string;
  required?: boolean;
  options?: string;
  width?: string;
  value?: string;
  showIf?: string;
  showValue?: string;
};

const FIELD_TYPES = opts(
  ["text", "Text"],
  ["email", "Email"],
  ["tel", "Phone"],
  ["textarea", "Paragraph"],
  ["select", "Dropdown"],
  ["radio", "Single choice"],
  ["checkbox", "Multiple choice"],
  ["date", "Date"],
  ["number", "Number"],
  ["consent", "Consent checkbox"],
  ["hidden", "Hidden"],
  ["step", "— New step —"],
);

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "field";

/**
 * The submitted field name. Standard fields use HighLevel's names, custom fields "cf_<id>"
 * (the server turns those into customFields), anything else is saved in a contact note.
 */
export function fieldName(f: FormField, i: number): string {
  const map = str(f.map);
  if (map.startsWith("cf:")) return `cf_${map.slice(3).replace(/[^\w-]/g, "")}`;
  if (map) return map;
  if (f.type === "consent") return "consent";
  return slugify(str(f.label) || `field_${i + 1}`);
}

const choices = (f: FormField) =>
  str(f.options)
    .split(/\r?\n/)
    .map((o) => o.trim())
    .filter(Boolean);

function fieldHtml(f: FormField, i: number, uid: string): string {
  const name = esc(fieldName(f, i));
  const id = `${uid}-f${i}`;
  const req = f.required ? " required" : "";
  const star = f.required ? `<span class="pf-req" aria-hidden="true">*</span>` : "";
  const label = f.label ? `<label for="${id}">${esc(f.label)}${star}</label>` : "";
  const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
  const cond = f.showIf ? ` data-show-if="${esc(f.showIf)}" data-show-value="${esc(f.showValue)}"` : "";
  const cls = `gpb-field pf-field${f.width === "half" ? " pf-field--half" : ""}`;
  let input: string;
  switch (f.type) {
    case "hidden":
      return `<input type="hidden" name="${name}" value="${esc(f.value)}" data-pf-dynamic>`;
    case "textarea":
      input = `<textarea id="${id}" name="${name}"${ph}${req}></textarea>`;
      break;
    case "select":
      input = `<select id="${id}" name="${name}"${req}><option value="">${esc(f.placeholder || "Select…")}</option>${choices(f)
        .map((o) => `<option>${esc(o)}</option>`)
        .join("")}</select>`;
      break;
    case "radio":
    case "checkbox":
      return `<fieldset class="${cls} pf-choices"${cond}>${f.label ? `<legend>${esc(f.label)}${star}</legend>` : ""}${choices(f)
        .map(
          (o, j) =>
            `<label class="pf-choice"><input type="${f.type}" name="${name}" value="${esc(o)}"${f.type === "radio" && j === 0 ? req : ""}> <span>${esc(o)}</span></label>`,
        )
        .join("")}</fieldset>`;
    case "consent":
      return `<div class="${cls} pf-consent"${cond}><label class="pf-choice"><input type="checkbox" name="${name}" value="yes"${req}> <span>${sanitizeRich(f.label || "I agree to receive messages.", true)}</span></label></div>`;
    default: {
      const t = ["email", "tel", "date", "number"].includes(str(f.type)) ? f.type : "text";
      const auto = { email: "email", phone: "tel", firstName: "given-name", lastName: "family-name", name: "name" }[str(f.map)] ?? "";
      input = `<input id="${id}" type="${t}" name="${name}"${ph}${req}${auto ? ` autocomplete="${auto}"` : ""}>`;
    }
  }
  return `<div class="${cls}"${cond}>${label}${input}</div>`;
}

export const form = defineWidget({
  type: "form",
  label: "Lead form",
  icon: icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>'),
  category: "Forms & popups",
  keywords: "contact optin signup lead capture crm survey multi step",
  defaults: () => ({
    fields: [
      { type: "text", label: "First name", map: "firstName", placeholder: "Jane", required: true, width: "half" },
      { type: "text", label: "Last name", map: "lastName", placeholder: "Doe", width: "half" },
      { type: "email", label: "Email", map: "email", placeholder: "jane@company.com", required: true },
      { type: "tel", label: "Phone", map: "phone", placeholder: "+1 555 000 0000" },
    ],
    submitText: "Get instant access",
    successMessage: "Thanks! Check your inbox for the next steps.",
    tags: "website-lead",
    captureUtm: true,
    note: "We respect your privacy. Unsubscribe anytime.",
    fullWidthButton: true,
  }),
  content: [
    {
      label: "Fields",
      controls: [
        {
          type: "repeater",
          key: "fields",
          label: "Fields",
          itemLabel: "label",
          addLabel: "Add field",
          newItem: () => ({ type: "text", label: "New field" }),
          fields: [
            { type: "select", key: "type", label: "Type", options: FIELD_TYPES },
            { type: "text", key: "label", label: "Label", when: (f) => f.type !== "step" },
            {
              type: "select",
              key: "map",
              label: "Save to",
              options: "customFields",
              placeholder: "Contact note",
              help: "A HighLevel contact field. Unmapped answers are saved as a note on the contact.",
              when: (f) => !["step", "consent"].includes(str(f.type)),
            },
            { type: "text", key: "placeholder", label: "Placeholder", when: (f) => ["text", "email", "tel", "textarea", "number", "select"].includes(str(f.type, "text")) },
            { type: "text", key: "options", label: "Choices", multiline: true, help: "One per line.", when: (f) => ["select", "radio", "checkbox"].includes(str(f.type)) },
            {
              type: "text",
              key: "value",
              label: "Value",
              placeholder: "{{url.utm_source}}",
              help: "Fixed text, or {{url.param}} to copy a value from the page URL.",
              when: (f) => f.type === "hidden",
            },
            { type: "toggle", key: "required", label: "Required", when: (f) => !["hidden", "step"].includes(str(f.type)) },
            { type: "buttons", key: "width", label: "Width", options: opts(["", "Full"], ["half", "Half"]), when: (f) => !["hidden", "step"].includes(str(f.type)) },
            { type: "text", key: "showIf", label: "Only show if field", placeholder: "Field name, e.g. budget", when: (f) => !["hidden", "step"].includes(str(f.type)) },
            { type: "text", key: "showValue", label: "…has the value", when: (f) => !!f.showIf },
          ],
        },
      ],
    },
    {
      label: "Buttons",
      controls: [
        { type: "text", key: "submitText", label: "Submit button" },
        { type: "text", key: "nextText", label: "Next button", placeholder: "Next", help: "Used when the form has steps." },
        { type: "text", key: "backText", label: "Back button", placeholder: "Back" },
        { type: "toggle", key: "fullWidthButton", label: "Full-width buttons" },
        { type: "text", key: "note", label: "Note under the button" },
      ],
    },
    {
      label: "After submit",
      controls: [
        { type: "text", key: "successMessage", label: "Success message" },
        { type: "text", key: "redirectUrl", label: "Or redirect to", placeholder: "https://…/thank-you" },
      ],
    },
    {
      label: "HighLevel CRM",
      controls: [
        { type: "text", key: "tags", label: "Tags to add", placeholder: "website-lead, webinar", help: "Comma separated." },
        { type: "select", key: "workflowId", label: "Add to workflow", options: "workflows", placeholder: "Don't add to a workflow" },
        { type: "select", key: "pipelineId", label: "Create opportunity in", options: "pipelines", placeholder: "Don't create an opportunity" },
        { type: "select", key: "stageId", label: "Stage", options: "stages", when: (s) => !!s.pipelineId },
        { type: "text", key: "opportunityName", label: "Opportunity name", placeholder: "{{name}} – {{page}}", when: (s) => !!s.pipelineId },
        { type: "number", key: "opportunityValue", label: "Value", min: 0, when: (s) => !!s.pipelineId },
        { type: "toggle", key: "captureUtm", label: "Capture UTM and referrer", help: "Saves utm_*, gclid, fbclid, the page URL and referrer with the lead." },
      ],
    },
  ],
  design: [
    {
      label: "Labels",
      controls: [
        { type: "color", key: "labelColor", label: "Color" },
        { type: "typography", key: "labelTypography", label: "Typography" },
      ],
    },
    {
      label: "Inputs",
      controls: [
        { type: "color", key: "inputBg", label: "Background" },
        { type: "color", key: "inputColor", label: "Text color" },
        { type: "border", key: "inputBorder", label: "Border" },
        { type: "number", key: "inputRadius", label: "Corner radius", unit: "px", min: 0, max: 40 },
        { type: "number", key: "inputHeight", label: "Height", unit: "px", min: 32, max: 80 },
        { type: "number", key: "gap", label: "Space between fields", unit: "px", min: 0, max: 60 },
      ],
    },
    {
      label: "Button",
      controls: [
        { type: "color", key: "bgColor", label: "Background" },
        { type: "color", key: "textColor", label: "Text" },
        { type: "color", key: "hoverBgColor", label: "Background on hover" },
        { type: "number", key: "radius", label: "Corner radius", unit: "px", min: 0, max: 60 },
        { type: "typography", key: "typography", label: "Typography" },
        { type: "buttons", key: "align", label: "Alignment", options: ALIGN3, when: (s) => !s.fullWidthButton },
      ],
    },
    { label: "Form box", closed: true, controls: boxControls("box") },
  ],
  render: (s, { uid }) => {
    const fields = list<FormField>(s.fields);
    // Split into steps at "step" fields.
    const steps: string[][] = [[]];
    const hidden: string[] = [];
    fields.forEach((f, i) => {
      if (f.type === "step") steps.push([]);
      else if (f.type === "hidden") hidden.push(fieldHtml(f, i, uid));
      else steps[steps.length - 1].push(fieldHtml(f, i, uid));
    });
    const multi = steps.length > 1;
    const body = steps
      .map((st, i) => (multi ? `<div class="pf-form-step${i === 0 ? " is-active" : ""}" data-step="${i}">${st.join("")}</div>` : st.join("")))
      .join("");
    const block = s.fullWidthButton ? "pf-btn--block" : "";
    const submit = `<button class="pf-btn pf-btn--lg ${block} pf-form-submit" type="submit">${esc(str(s.submitText) || "Submit")}</button>`;
    const nav = multi
      ? `<div class="pf-form-nav"><button class="pf-btn pf-btn--outline pf-form-back" type="button">${esc(str(s.backText) || "Back")}</button><button class="pf-btn pf-btn--lg ${block} pf-form-next" type="button">${esc(str(s.nextText) || "Next")}</button>${submit}</div><div class="pf-form-progress"><span></span></div>`
      : `<div class="pf-form-nav">${submit}</div>`;
    return `<form class="gpb-form pf-form${multi ? " pf-form--steps" : ""}" data-gpb-form="pf-${esc(uid)}"${s.captureUtm ? ' data-utm="true"' : ""}>${body}${hidden.join("")}<div class="gpb-hp" aria-hidden="true"><input name="_hp" type="text" tabindex="-1" autocomplete="off"></div>${nav}<div class="gpb-form-msg" role="status"></div>${s.note ? `<p class="gpb-form-note">${esc(s.note)}</p>` : ""}</form>`;
  },
  css: (s, css) => {
    css.rule(".gpb-form", { gap: px(s.gap) });
    css.rule(".gpb-field label, .pf-choices legend", { color: color(s.labelColor) });
    typography(css, ".gpb-field > label, .pf-choices legend", s.labelTypography as Typography);
    css.rule(".gpb-field input:not([type=checkbox]):not([type=radio]), .gpb-field textarea, .gpb-field select", {
      background: color(s.inputBg),
      color: color(s.inputColor),
      ...borderDecls(s.inputBorder as Border),
      "border-radius": px(s.inputRadius),
      height: px(s.inputHeight),
    });
    css.rule(".pf-form-nav", { "justify-content": s.fullWidthButton ? undefined : { left: "flex-start", center: "center", right: "flex-end" }[str(s.align)] });
    for (const btn of [".pf-form-submit", ".pf-form-next"]) buttonCss({ ...s, padding: undefined, align: undefined }, css, ".pf-form-nav", btn);
    boxCss(css, ".gpb-form", s, "box");
  },
});

/** Form settings that stay on the server (published page config), keyed by the form's data-gpb-form id. */
export function formConfig(s: Settings) {
  return {
    tags: str(s.tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    workflowId: str(s.workflowId) || undefined,
    successMessage: str(s.successMessage) || undefined,
    redirectUrl: str(s.redirectUrl) || undefined,
    pipelineId: str(s.pipelineId) || undefined,
    stageId: str(s.stageId) || undefined,
    opportunityName: str(s.opportunityName) || undefined,
    opportunityValue: typeof s.opportunityValue === "number" ? s.opportunityValue : undefined,
  };
}

/* ── Popup ── */

export const popup = defineWidget({
  type: "popup",
  label: "Popup",
  icon: icon('<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  category: "Forms & popups",
  keywords: "modal lightbox exit intent overlay slide in bar",
  topLevel: true,
  noAdvancedSpacing: true,
  defaults: () => ({
    popupId: `popup-${Math.random().toString(36).slice(2, 7)}`,
    position: "center",
    frequency: "session",
    closeButton: true,
    overlayClose: true,
  }),
  container: {
    rejects: ["pf-section", "pf-popup"],
    inner: { open: '<div class="gpb-modal-box"><button class="gpb-modal-close" type="button" aria-label="Close">×</button><div class="pf-popup-content" data-pf-children>', close: "</div></div>" },
  },
  content: [
    {
      label: "Popup",
      controls: [
        { type: "text", key: "popupId", label: "Popup ID", help: "Buttons open it with Advanced → On click, open popup, or by linking to #popup-id." },
        {
          type: "select",
          key: "position",
          label: "Position",
          options: opts(["center", "Center"], ["bottom-bar", "Bottom bar"], ["top-bar", "Top bar"], ["bottom-right", "Slide-in, bottom right"], ["bottom-left", "Slide-in, bottom left"]),
        },
        { type: "length", key: "width", label: "Width", units: ["px", "%"], responsive: true },
      ],
    },
    {
      label: "Open automatically",
      controls: [
        { type: "number", key: "delay", label: "After", unit: "sec", min: 0, help: "0 = off" },
        { type: "number", key: "scroll", label: "When scrolled", unit: "%", min: 0, max: 100, help: "0 = off" },
        { type: "toggle", key: "exitIntent", label: "When leaving the page (desktop)" },
        { type: "number", key: "idle", label: "After inactivity", unit: "sec", min: 0, help: "0 = off" },
        {
          type: "select",
          key: "frequency",
          label: "Show automatically",
          options: opts(["always", "Every page view"], ["session", "Once per visit"], ["day", "Once a day"], ["week", "Once a week"], ["once", "Only once"]),
        },
      ],
    },
    {
      label: "Closing",
      controls: [
        { type: "toggle", key: "closeButton", label: "Show close button" },
        { type: "toggle", key: "overlayClose", label: "Close when clicking outside" },
      ],
    },
  ],
  design: [
    { label: "Box", controls: boxControls("box") },
    {
      label: "Overlay",
      controls: [
        { type: "color", key: "overlay", label: "Overlay color" },
        { type: "toggle", key: "noBlur", label: "No background blur" },
      ],
    },
  ],
  render: () => "",
  wrapper: (s) => ({
    attrs: {
      id: str(s.popupId).replace(/[^\w-]/g, "") || "popup",
      "data-gpb": "modal",
      "data-auto-open": String(num(s.delay, 0)),
      "data-exit-intent": s.exitIntent ? "true" : "false",
      "data-once": s.frequency === "always" ? "false" : "true",
      "data-pf-freq": str(s.frequency, "session"),
      "data-pf-scroll-open": String(num(s.scroll, 0)),
      "data-pf-idle": String(num(s.idle, 0)),
      "data-pf-overlay-close": s.overlayClose === false ? "false" : "true",
    },
    classes: ["gpb-modal", `pf-popup--${str(s.position, "center")}`, ...(s.closeButton === false ? ["pf-popup--noclose"] : []), ...(s.noBlur ? ["pf-popup--noblur"] : [])],
  }),
  css: (s, css) => {
    css.responsive(".gpb-modal-box", s.width as Responsive<Length>, (v) => ({ "max-width": length(v) }));
    css.rule("&", { background: color(s.overlay) });
    boxCss(css, ".gpb-modal-box", s, "box");
  },
});
