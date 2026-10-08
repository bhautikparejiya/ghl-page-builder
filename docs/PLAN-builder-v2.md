# PageForge v2: review and extension plan

Goal: make PageForge as easy to use as the best visual builders (the widget-based editing model that
Elementor made popular), while staying clearly our own product and leaning on what only a
HighLevel-native builder can do.

---

## Status (updated 2026-10-08)

All phases (0–6) are implemented on branch `feature/builder-v2` and tested in a local browser, except the items marked
"needs a HighLevel install" below. Typecheck and `next build` pass.

| Phase | Status |
|---|---|
| 0. Foundations | Done: revisions + restore, pages domain (`PAGES_URL`), debounced saves, form settings moved into widget settings, copy cleanup |
| 1. Editing model | Done: 35 schema widgets, Section/Container layout with drop rules, all control types, Lucide icon set, templates rebuilt on widgets |
| 2. Editing comfort | Done: "+" section picker, right-click menu, on-canvas text editing + toolbar, Ctrl+K palette, widget search + recently used, shortcuts, level colors, empty states |
| 3. Design system | Done: brand kit per sub-account + agency default, text styles, logo (suggested from the HighLevel profile) |
| 4. Reuse | Done: saved sections/pages with thumbnails, global sections, agency sharing, template previews |
| 5. HighLevel features | Done; parts need a HighLevel install to verify (see below) |
| 6. Performance & SEO | Done: per-widget runtime modules, custom domains, sitemap/robots, canonical, OG image, noindex, FAQ JSON-LD, inline embed mode |

**Needs a HighLevel install to verify** (built against HighLevel's published OpenAPI specs): custom field mapping
(`customFields: [{ id, field_value }]`), opportunity creation, calendar list, custom values / location tokens, logo suggestion.
Add the new scopes listed in the README first.

**Known limits / decisions:**
- Thumbnails are captured in the browser (html-to-image), not rendered on a server.
- Payments: the Product widget links to a HighLevel payment link / order form (no checkout embed API).
  Reviews: embeds HighLevel's reviews widget (no read API).
- Custom domains need the customer's CNAME plus the domain on the Vercel project (automatic with `VERCEL_TOKEN`).
- Ctrl+Alt+C / Ctrl+Alt+V (copy/paste style) couldn't be exercised with the test browser's synthetic key events;
  the same actions work from the right-click menu.
- Pages created before brand kits keep their own theme until switched to the kit (Brand kit dialog).

## 1. Review: where PageForge is today

### What's solid
- **Publishing pipeline**: Shadow DOM embed (`public/loader.js`), "publish once, update everywhere", 30s CDN cache, hosted URL. HighLevel can't do this natively, and it works.
- **CRM forms**: upsert contact, tags, workflow enrollment, notes, honeypot and timing spam checks (`src/app/api/public/forms/route.ts`).
- **Widget runtime**: 13 interactive widgets in plain JS (`public/runtime.js`) with no framework dependency on the live page.
- **Infra**: Next.js + Neon/PGlite, SSO, OAuth, media library. Cheap to run.

### Why it still feels hard to use
The main issue is the editing model, not any missing feature. **PageForge exposes GrapesJS's raw DOM/CSS editor**, while users expect a *widget settings* editor.

| Problem | Where | What the user experiences |
|---|---|---|
| Style panel is GrapesJS's generic CSS manager (General / Dimension / Typography / Decorations / Extra) | `Editor.tsx:149` | Users have to think in CSS properties ("Decorations → Border radius → Top Left"). Nothing is tailored to the widget they selected. |
| No structure rules | `gpbPlugin.ts:211-216` | Anything can be dropped anywhere. Rows, columns, cards and widgets are all just `div`s, and a misplaced drop breaks the layout. |
| Lists can't be edited as lists | tabs, accordion, carousel, pricing, features, progress | To add a tab, the hint says "duplicate a tab button and a panel in the Layers panel". There's no repeater control ("+ Add item"). |
| Widget content mixed with advanced options | `gpbPlugin.ts:181-203` | Every element's Settings tab shows animation, hover, hide and popup options. Widget-specific options get buried. A re-select hack is used to make them render. |
| Wiring by typing IDs | `data-gpb-open` trait | To open a popup, users type `popup-offer` by hand. There's no picker. |
| Prices and other data live in attributes on inner spans | `gpb-price` type | Users have to find the right `<span>` in Layers to change a yearly price. |
| Theme is thin | `src/lib/theme.ts` | 4 colors, 2 fonts and a radius. No named global colors or typography presets, and widgets can't be bound to them. |
| No in-canvas affordances | — | No "+ Add section" between sections, no structure picker, no right-click menu, no copy/paste style, no widget search, no inline text toolbar. |
| Emoji icons | `sections.ts` (`⚡ ◎ ⟳`) | Looks amateur and renders differently on each OS. There's no icon picker. |
| No reuse | — | No saved sections, global/linked widgets or template library. Every page starts from 4 hard-coded templates. |

### Technical debt and risks found
1. **No revision history.** Publishing overwrites `published` (`api/pages/[id]/publish/route.ts`). A `version` counter exists, but there's nothing to roll back to.
2. **Hosted pages run user HTML on the app origin.** `/p/:id` serves Custom HTML and scripts from the same origin as `/app`. The session lives in `sessionStorage` and is tab-scoped, so the immediate risk is low. Still, one tenant's script runs on your domain (phishing, defacement). Serve hosted pages from a separate domain (for example `pages.pageforge.app`).
3. **Theme edits fire a PUT on every keystroke or color drag** (`Editor.tsx:242`, not debounced).
4. **Form config is stripped from published HTML with a regex** (`Editor.tsx:20`). This works now, but it won't scale to richer form settings. Form config should live in the document model, not in DOM attributes.
5. **Block HTML is derived by regex-slicing section strings** (`gpbPlugin.ts:236, 239`). This is fragile.
6. **The live page loads all of runtime.js and runtime.css** whether the page uses one widget or all of them.
7. **Content is rendered by JS inside Shadow DOM**, which is weak for SEO on embedded pages (already noted in the README).

---

## 2. Core decision: the editing model

The usability gap comes from a single architectural choice, so fix that first.

**The model Elementor-style builders use (and Webflow, Divi, Bricks, Framer):**
```
Page
 └─ Section / Container   (layout settings: width, gap, direction, background)
     └─ Column / Container
         └─ Widget        { type, settings{} }  ──render(settings)──► HTML + scoped CSS
```
Each widget is **data plus a schema**. The panel is generated from the schema, and the HTML and CSS are generated from the settings. Users never touch raw DOM or CSS unless they open "Custom CSS".

### Options
| | A. Keep GrapesJS, add a schema layer **(recommended)** | B. Write our own editor (React + JSON tree) |
|---|---|---|
| Approach | Each widget becomes a GrapesJS component whose `settings` prop is the source of truth and whose `toHTML` calls our `render()`. Replace GrapesJS's Style and Trait managers with our own React panel. Keep GrapesJS for canvas, drag and drop, selection and undo. | Our own canvas (iframe), DnD (dnd-kit), selection, undo (immer patches), renderer. |
| Time to first value | ~4–6 weeks | ~3–4 months |
| Control | Good. Some GrapesJS quirks remain. | Total |
| Migration | Existing pages keep working (old components still parse) | Needs an importer |

**Recommendation:** go with A, but design the widget schema and `render()` **independently of GrapesJS** (in `src/lib/widgets/`), so that moving to B later only replaces the canvas. Store `settings` JSON in the project data, which is already persisted.

### Widget definition (our own API design)
```ts
// src/lib/widgets/accordion.ts
export default defineWidget({
  type: "accordion",
  label: "Accordion",
  icon: "list-collapse",            // Lucide icon name
  group: "interactive",
  panels: {
    content: [
      repeater("items", { label: "Items", itemLabel: "title",
        fields: [text("title", "Title"), richText("body", "Content")],
        default: [{ title: "Question one", body: "Answer…" }] }),
      toggle("singleOpen", "Only one open at a time", true),
    ],
    design: [
      group("Title", [color("titleColor", { bind: "global" }), typography("titleType"), spacing("titlePad", { responsive: true })]),
      group("Box", [border("box"), radius("radius", { responsive: true }), shadow("shadow")]),
    ],
  },
  css: (s, $) => [$(".pf-acc-head", { color: s.titleColor, ...s.titleType, padding: s.titlePad })],
  render: (s) => `<div class="pf-accordion" data-pf="accordion" data-single="${s.singleOpen}">…</div>`,
});
```
- `render` and `css` are pure functions shared by editor and server, so the server can pre-render static HTML.
- `responsive: true` stores `{ desktop, tablet, mobile }` and generates media queries automatically.
- `bind: "global"` lets a value reference a global color or typography token (`var(--pf-c-primary)`).

---

## 3. Roadmap

### Phase 0: Foundations (1–2 weeks)
- [ ] `page_revisions` table: snapshot on every publish plus every N autosaves, with a Restore UI.
- [ ] Move hosted pages (`/p/:id`) to a separate origin.
- [ ] Debounce theme saves. Move form config out of DOM attributes into the page document.
- [ ] Remove "Elementor-style" from public copy (see §5).
- [ ] Switch the CSS/class prefix from `gpb-` to `pf-` for new widgets (keep `gpb-` parsing for old pages).

### Phase 1: New editing model (4–6 weeks), the biggest UX win
- [ ] `src/lib/widgets/` registry: `defineWidget`, control types (text, rich text, number+unit slider, color, typography, spacing/dimensions with link toggle, border, shadow, background incl. gradient/image/overlay, image picker, icon picker, link picker, select, toggle, **repeater**, popup picker, form-field list).
- [ ] React right panel: **Content | Design | Advanced** tabs, generated from the schema. A device toggle next to each responsive control, with an indicator when tablet/mobile values override desktop.
- [ ] Layout primitives: **Section → Container (flex/grid) → Widget**, with nesting rules enforced on drop.
- [ ] Port the existing 30+ widgets to schemas, starting with the most-used ones: heading, text, button, image, icon list, form, accordion, tabs, pricing, testimonial carousel, countdown.
- [ ] Advanced tab (shared by all widgets): margin/padding, z-index, entrance animation, hover effect, visibility per device, custom ID/class, **custom CSS for this element**, "on click → open popup" (picker, not a typed ID).
- [ ] Lucide icon set (MIT) replaces emoji.

### Phase 2: Editing comfort (2–3 weeks)
- [ ] In-canvas "+" between sections, opening a structure picker (1, 2, 3, 4 columns, 1/3+2/3…) and a "from library" tab.
- [ ] Hover labels and handles in different colors for section, container and widget. Drag handle, duplicate, delete.
- [ ] Right-click menu: copy, paste, **paste style**, duplicate, reset style, save as template, show in layers.
- [ ] Inline text toolbar (bold, italic, link, color from globals).
- [ ] Widget search box plus "recently used". Command palette (Ctrl+K) to jump to any widget or setting.
- [ ] Keyboard shortcuts (copy/paste/duplicate/delete/undo/responsive toggle/preview), with a shortcuts sheet.
- [ ] Empty-state guidance: an empty column shows "Drag a widget here or click +".

### Phase 3: Design system (2 weeks)
- [ ] **Brand kit at sub-account level** (not per page): named global colors (unlimited), typography presets (H1–H6, body, button), button styles, form styles, container width, spacing scale.
- [ ] Every color and typography control can bind to a token. Changing the kit updates every page.
- [ ] Pull brand colors and logo from the HighLevel location (business profile) on first run.

### Phase 4: Reuse and templates (2–3 weeks)
- [ ] Saved sections and pages per sub-account.
- [ ] **Global (linked) widgets and sections**: edit once, update everywhere.
- [ ] Template library with real thumbnails (render server-side to PNG), categories, preview before insert.
- [ ] **Agency-level library**: an agency publishes templates and brand kits to all its sub-accounts. This is a strong HighLevel-specific selling point that Elementor can't offer.

### Phase 5: HighLevel-native power features (the differentiators, ongoing)
- [ ] **Form builder**: field list editor (repeater) with each field mapped to standard *or custom* HighLevel contact fields (custom fields API), validation, multi-step forms, conditional fields, hidden UTM capture, opportunity creation in a pipeline.
- [ ] **Dynamic content**: HighLevel custom values (`{{custom_values.x}}`), location info, URL params.
- [ ] **Calendar widget** (HighLevel booking widget embed with styling), **payment/product widget**, **reviews widget** (pulled from HighLevel reputation).
- [ ] **Popup builder** as its own document type with triggers (click, delay, scroll %, exit intent, inactivity) and conditions (page, device, UTM, frequency).
- [ ] **Display conditions** on any element: device, date range, URL param/UTM, returning visitor.
- [ ] Motion: sticky elements, scroll-based effects, parallax background.
- [ ] A/B test variants per section, with conversion counts from form submissions.

### Phase 6: Live performance and SEO (2 weeks)
- [ ] Server pre-renders HTML and CSS from settings at publish time and stores it as the static output.
- [ ] Per-page runtime bundle: only ship JS/CSS for widgets used on the page (split `runtime.js` per widget).
- [ ] Hosted pages: custom domain support, sitemap, OG image, schema.org.
- [ ] Embedded pages: optional light-DOM mode for SEO-critical pages (styles scoped with the `.pf-root` prefix).

**Rough total to a "clearly better than the native HighLevel builder" release (Phases 0–3): ~10–13 weeks for one experienced developer.**

---

## 4. Suggested data model changes
```sql
CREATE TABLE brand_kits   (location_id TEXT PRIMARY KEY, kit JSONB NOT NULL, updated_at BIGINT);
CREATE TABLE library_items(id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT,  -- 'location' | 'company'
                           kind TEXT, name TEXT, doc JSONB, thumbnail TEXT, is_global BOOLEAN, updated_at BIGINT);
CREATE TABLE page_revisions(id BIGSERIAL PRIMARY KEY, page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
                           at BIGINT, kind TEXT, doc JSONB);               -- 'publish' | 'autosave'
```
`pages.draft` becomes `{ doc: PageTree, projectData }`, where `PageTree` is the canvas-independent JSON tree.

---

## 5. Taking the concept without copying Elementor

*This is practical guidance, not legal advice. Have a lawyer review the marketplace listing before launch.*

**Free to use (industry-standard ideas, not protectable):** sections/containers/widgets, drag and drop, a settings panel split into content/style/advanced, per-device responsive values, global colors and fonts, repeaters, saved templates, popups with triggers, entrance animations. Webflow, Divi, Bricks, Oxygen, Framer and Breakdance all use these.

**Do not copy:**
| Area | Avoid | Do instead |
|---|---|---|
| Name and trademark | "Elementor-style" in marketing (currently in `README.md`, `src/app/layout.tsx`, `src/app/page.tsx`, `gpbPlugin.ts`), "Elementor alternative" in ads, "Pro" wording that echoes them | "Drag-and-drop widget builder for HighLevel" |
| Code | Any Elementor source (GPLv3). Copying it into `runtime.js`, which you distribute to browsers, can create GPL obligations | Write it yourself, and use MIT/Apache libraries only |
| Visual identity | Their magenta/dark-gray editor theme, the left-panel-only layout with that exact header, their "eicons" icon font | Keep PageForge's own palette and three-pane layout. Use Lucide icons. |
| Feature naming | "Navigator", "Finder", "Theme Builder", "Kit Library", "Site Settings" as branded terms | "Layers", "Quick search (Ctrl+K)", "Brand kit", "Library" |
| CSS classes and data format | `elementor-*` classes, their JSON export format, their `{{WRAPPER}}` selector syntax | `pf-*` classes, our own document schema (§2) |
| Content | Their template designs, demo text, docs or tutorial screenshots | Our own templates built around HighLevel use cases (coaches, clinics, agencies, webinars) |

**Positioning:** don't sell "Elementor for HighLevel". Sell "the builder that knows your CRM": custom fields, workflows, calendars, custom values and agency-wide templates. That's both safer legally and a stronger pitch.

---

## 6. Suggested first sprint (2 weeks)
1. Phase 0 items (revisions, separate hosted origin, copy cleanup).
2. Widget registry plus the React panel with 6 controls (text, color, typography, spacing, toggle, repeater).
3. Port **Heading, Button, Accordion** to the new model end to end (editor → publish → live), proving the architecture before porting the rest.
