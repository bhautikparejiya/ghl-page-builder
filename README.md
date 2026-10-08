# PageForge for HighLevel

A HighLevel Marketplace app that adds a drag-and-drop widget page builder to HighLevel.
Users design pages inside HighLevel (as a Custom Page in the left menu), then publish them into any HighLevel
funnel or website step with a one-time snippet. Edits after that go live automatically.

## Features

**Editing**
- **Widget editor:** select anything on the page and edit it in a Content / Design / Advanced panel generated for that widget.
  Every size, spacing and alignment setting can differ per device (desktop / tablet / mobile).
- **Layout:** sections and flex/grid containers (columns, cards, button groups) with drop rules, so layouts can't break.
  Widgets dropped on the bare page get a section automatically.
- **Edit text on the page:** double-click headings, text, buttons and feature titles, with a floating toolbar (bold, links, brand colors, gradient highlight).
- **Faster editing:** "+" between sections with a layout and section picker, right-click menu (duplicate, copy/paste style,
  save to library…), Ctrl+K search for widgets, sections, elements and actions, widget search with "recently used", keyboard shortcuts (press `?`).
- **35 widgets:** heading, text, button, image, video, icon, icon list, social icons, map, HTML, animated headline, tabs, accordion (FAQ),
  counter, countdown (fixed or evergreen), progress bars, testimonial + slider, feature box, pricing table, flip box, before/after,
  logo marquee, star rating, navbar, lead form, popup, HighLevel booking calendar, HighLevel form, reviews widget, product / buy button.
- **20 ready-made sections and 6 templates**, built from the same widgets, with live previews in your brand colors.
- **Advanced options on every widget:** spacing, entrance animation, hover effect, scroll effects (parallax/fade/scale), sticky,
  hide per device, display conditions (date range, URL parameter, new/returning visitor), "on click open popup", custom CSS.

**Design system and reuse**
- **Brand kit** per sub-account (and an agency default for all sub-accounts): unlimited named colors, fonts, text styles for H1–H6 and body,
  corner radius, content width and logo. Changes apply to every page without republishing.
- **Library:** save sections and whole pages as templates; agency users can share them with all sub-accounts.
- **Global sections:** edit once, and every page that uses it updates without republishing.

**HighLevel**
- **Lead forms:** field builder with mapping to standard and custom contact fields, multi-step forms, conditional fields, consent,
  hidden fields from the URL, UTM / referrer capture, tags, workflow enrollment and opportunity creation in a pipeline stage.
- **Dynamic content:** `{{location.name}}`, `{{location.phone}}`, `{{custom_values.key}}` (filled when the page is served) and `{{url.param|default}}`.
- **Popups:** click, delay, scroll %, exit intent and inactivity triggers; once per visit / day / week / ever; center, bar or slide-in.
- **A/B tests:** give two sections the same test name; views and form conversions are counted per variant.
- **HighLevel Media Library** for images.

**Publishing**
- **Embed** in any funnel or website step with a one-time snippet (isolated with Shadow DOM, or inline). Edits go live on publish.
- **Hosted pages and custom domains** with sitemap, robots.txt, canonical URL, social share image, noindex and FAQ structured data.
- Live pages load only the scripts for the widgets they use.
- **Revision history:** a snapshot on every publish plus a draft snapshot every 30 minutes of editing (last 50 kept).
- **Leads log:** the last 200 submissions per page, with CRM sync status.

## How it works

```
HighLevel sub-account ──(left menu: Custom Page iframe)──► /app  (Next.js on Vercel)
        │                         SSO: REQUEST_USER_DATA → /api/auth/sso → signed session
        │
  Funnel page with Custom Code:  <div data-gpb-page="ID"></div><script src=".../loader.js">
        │                         loader.js → /api/public/pages/ID → Shadow DOM + runtime/core.js + widget modules
        ▼
  Lead form ─► /api/public/forms ─► HighLevel API (contacts upsert, custom fields, tags, workflow, opportunity, notes)
```

| Path | Purpose |
|---|---|
| `src/app/api/oauth/callback` | Install: exchanges the OAuth code and stores tokens (per sub-account or agency) |
| `src/app/api/webhooks/ghl` | Uninstall webhook: deletes tokens |
| `src/app/api/auth/sso` | Decrypts HighLevel user context with the Shared Secret and issues a session |
| `src/app/api/pages/**` | Page CRUD, publish, submissions (scoped to the session's sub-account) |
| `src/app/api/public/**` | Public, CORS-enabled endpoints used by published pages |
| `src/components/editor/` | Editor UI and GrapesJS plugin (widgets, settings, blocks) |
| `src/lib/widgets/` | Schema widgets: settings schema + pure HTML/CSS renderers, shared by editor and server |
| `src/components/editor/panel/` | Content / Design / Advanced settings panel generated from widget schemas |
| `src/lib/blueprints.ts` | Ready-made sections and page templates, written as widget trees |
| `src/lib/compose.ts` | What a live page serves: published HTML + brand kit + global sections + dynamic values |
| `src/components/editor/ui/` | Brand kit, library, section picker, context menu, command palette, page settings |
| `runtime-src/` | Live-page runtime source: `core.js/.css` plus one module per interactive widget |
| `public/runtime/**`, `public/runtime.{js,css}` | Generated by `npm run runtime` (also runs before `dev` and `build`). Don't edit by hand |
| `src/proxy.ts` | Routes the optional pages domain and customers' custom domains |
| `public/loader.js` | The embed script customers paste into HighLevel |

---

## 1. Run and test locally (about 5 minutes)

```bash
npm install
cp .env.example .env.local      # keep ALLOW_DEV_LOGIN=true for local testing
npm run dev
```

1. Open http://localhost:3000/app. You'll see **Developer login** (you're outside HighLevel). Click Continue.
2. Click **+ New page**, then **SaaS / Product launch**. The editor opens.
3. Try the following:
   - Drag widgets from the left panel.
   - Select an element. In the **Style** tab, switch to Mobile and change the font size.
   - Open the **Settings** tab and set an entrance animation.
   - Click **Theme** and change the primary color and fonts.
4. Click **Publish**, then **Embed**, and copy the snippet.
5. Test the embed on a different origin to simulate a HighLevel funnel. Create `test.html` anywhere:
   ```html
   <h1 style="font-family:serif;color:red">Host page</h1>
   <div data-gpb-page="PASTE_PAGE_ID"></div>
   <script src="http://localhost:3000/loader.js" async></script>
   ```
   Serve that folder (`npx serve .` or `python -m http.server 5500`) and open it. The page should render with the
   host's red serif styles not leaking in. Scroll to see the counters and animations. Submit the form, then open
   **Leads** on the dashboard. Locally the lead shows **Not synced**, because no HighLevel token exists for
   `dev-location`. That's expected.

> Locally, data is stored in an embedded Postgres (PGlite) under `.data/pg`, so no database setup is needed. Delete that folder to reset.
> To test against Neon instead, put your Neon connection string in `DATABASE_URL` in `.env.local`.

## 2. Deploy to Vercel (free)

1. Push this folder to a **GitHub** repo (`git init && git add . && git commit -m "init"`, then create the repo and push).
2. At https://vercel.com, click **Add New → Project**, import the repo, and keep the defaults (Next.js). Deploy.
3. **Database:** open the Vercel project, go to **Storage → Create Database → Neon (Serverless Postgres)**, choose the free plan, and connect it
   to the project (all environments). This adds `DATABASE_URL` automatically. The tables are created on first request,
   so there's no migration step. The schema is in `src/lib/db.ts`.
4. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `APP_URL` | `https://your-project.vercel.app` (no trailing slash) |
   | `SESSION_SECRET` | output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `GHL_CLIENT_ID` / `GHL_CLIENT_SECRET` | from step 3 below |
   | `GHL_SSO_KEY` | the Shared Secret from step 3 below |
   | `GHL_WEBHOOK_PUBLIC_KEY` | optional: the public key from HighLevel's webhook docs (enables signature checks) |
   | `PAGES_URL` | optional but recommended: a second domain (e.g. `https://pages.your-domain.com`) added to the same Vercel project. Hosted pages (`/p/:id`) are served only there, so customer custom code never runs on the editor's domain |
   | `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` (/ `VERCEL_TEAM_ID`) | optional: lets the app add customers' custom domains to the Vercel project automatically |
   | `CUSTOM_DOMAIN_CNAME` | optional: the CNAME target shown to customers (default `cname.vercel-dns.com`) |
   | `ALLOW_DEV_LOGIN` | **leave unset in production** |

5. Redeploy (Deployments → ⋯ → Redeploy) so the variables take effect.

> ⚠️ Vercel's free **Hobby** plan is for **non-commercial** use only. Testing and review on Hobby is fine. Once you
> charge customers, upgrade to Vercel **Pro** ($20/mo), or move to another host. Neon's free plan includes 0.5 GB storage per project and a monthly compute allowance,
> and it scales to zero when idle (the first request after idle takes about 0.5 s). Upgrade when you have real traffic.

## 3. Create the app in the HighLevel Developer Portal

1. Go to https://marketplace.gohighlevel.com, sign up as a developer, then click **My Apps → Create App**.
   - **App type:** start as **Private** (only you can install it, which is ideal for testing). Switch to **Public** when you're ready to list.
   - **Target user:** **Sub-account**. **Who can install:** Agency & Sub-account (allows bulk install by agencies).
2. **Advanced Settings → Auth**
   - **Scopes:** `contacts.readonly`, `contacts.write`, `workflows.readonly`, `medias.readonly`, `medias.write`,
     `locations.readonly`, `locations/customFields.readonly`, `locations/customValues.readonly`, `calendars.readonly`,
     `opportunities.readonly`, `opportunities.write`, `oauth.readonly`, `oauth.write`.
     Without the newer ones the related dropdowns (custom fields, calendars, pipelines) are just empty; everything else works.
   - **Redirect URL:** `https://your-project.vercel.app/api/oauth/callback`
   - **Client Keys:** add a key and copy the **Client ID** and **Client Secret** into Vercel.
   - **Shared Secret (SSO key):** generate it and copy it into `GHL_SSO_KEY`.
3. **Webhooks:** set the Default Webhook URL to `https://your-project.vercel.app/api/webhooks/ghl` and enable the
   **AppInstall** and **AppUninstall** events.
4. **Custom Page** (sometimes listed as "Custom Pages / Custom Menu Link"):
   - **URL:** `https://your-project.vercel.app/app`
   - **Name:** PageForge. **Placement:** left navigation (sub-account).
5. Redeploy on Vercel after setting the keys.

## 4. Test inside HighLevel (end to end)

1. In the Developer Portal, open your app and copy the **Install link**, or use the "Test app" button. Open it while
   logged into your HighLevel agency, pick a **test sub-account**, and approve. You should land on `/installed`
   showing a success message.
2. In that sub-account, open **PageForge** from the left menu. You should be signed in automatically through SSO and see
   **● CRM connected**.
3. Create a page, change something, and **Publish**.
4. In HighLevel, go to **Sites → Funnels**, open a funnel step in the builder, and add a full-width section with 0 padding. Add a
   **Custom JS/HTML** element and paste the snippet from **Embed**. Save, then preview or publish the funnel.
5. On the live funnel, check the following:
   - The page renders, animations and widgets work, and the layout is correct on mobile (use your phone).
   - Submit the lead form. In **Contacts**, the contact appears with the tag `website-lead`.
   - Select the form in the editor, pick a workflow under **Settings → Add contact to workflow**, and publish again.
     Submit again and confirm the contact entered the workflow.
   - Upload an image in the editor. It appears in the sub-account's **Media Library**.
   - Edit the page and publish. The funnel updates within about 30 seconds, with no re-pasting.
6. Uninstall the app from the sub-account. Its tokens are deleted. Embedded pages keep rendering, but leads are no longer
   synced to the CRM.

## 5. Publish to the Marketplace and get paid

1. **App profile / listing:** add the name, tagline, a long description (lead with the widget list and the "edit once,
   updates everywhere" benefit), a 512×512 logo, 3–5 screenshots or GIFs of the editor and widgets, a demo video (strongly
   recommended), category (Sites/Funnels), support email, and website.
   - **Privacy policy URL:** `https://your-project.vercel.app/privacy`
   - **Terms URL:** `https://your-project.vercel.app/terms`
   - Fill in the placeholders in `src/app/privacy` and `src/app/terms` first.
2. **Pricing:** set it in the portal under Pricing / Monetization. Typical options are a free trial, then a monthly price per sub-account.
   HighLevel bills the agency and pays out your revenue share. Check the current payout terms in the portal.
3. Switch the app to **Public** and **Submit for review**. Reviewers install it in a sandbox, so make sure:
   - The install, SSO, and Custom Page flow works on a fresh sub-account with no manual steps.
   - `ALLOW_DEV_LOGIN` is **not** set in production.
   - Your support email and documentation link work.
4. After approval, use agency Facebook groups, YouTube demos, and the HighLevel community to drive installs.

## Notes and limits

- HighLevel has **no API for writing funnel pages**, so content is injected through the snippet rather than written into
  HighLevel's native page JSON. The snippet only needs to be added once per page.
- Embedded content is rendered by JavaScript. Google does render it, but for SEO-critical pages you should prefer the hosted URL
  or put the key copy in HighLevel's native elements.
- Widget behaviour lives in `runtime-src/` and is built into `public/runtime/`. Those files are cached for 5 minutes in browsers and up to
  1 hour at the CDN, so after changing them, redeploy and allow for cache time.
- Custom domains: the customer adds a CNAME record; the domain must also be added to the Vercel project (automatic with `VERCEL_TOKEN`).
- Payments: HighLevel has no checkout embed API, so the Product widget links to a HighLevel payment link or order form.
  The Reviews widget embeds HighLevel's own reviews widget for the same reason.
- Image uploads go through Vercel, which caps request bodies at about 4.5 MB.

## Adding a widget

Widgets live in `src/lib/widgets/`. Each one is a `defineWidget({...})` with:

- `defaults()`: initial settings
- `content` / `design`: control groups that generate the settings panel (text, rich text, select, buttons, toggle, number, length,
  color with brand-kit binding, typography, spacing, link, image, icon, background, border, shadow, date-time, code, repeater).
  Set `responsive: true` for per-device values. Selects can use runtime options such as `"popups"`, `"workflows"` or `"customFields"`.
- `render(settings, { uid })`: inner HTML. Escape user text with `esc` / `textToHtml`, and pass rich text through `sanitizeRich`.
- `css(settings, css)`: scoped styles; `&` is the widget wrapper, and media queries are generated for tablet/mobile values.
- Optional: `container` (holds other widgets), `inline` (on-canvas text editing), `wrapper` (extra attributes), `topLevel`, `keywords`.

Register it in `WIDGETS` in `src/lib/widgets/index.ts`; it then appears in the library and the Ctrl+K search automatically.
The Advanced tab is added to every widget. Interactive behaviour on live pages goes in `runtime-src/modules/<name>.js`
(`GPB.define("<name>", fn)`), and is loaded for elements with `data-gpb="<name>"`.

Icons: `npm run icons` regenerates `src/lib/widgets/icon-data.ts` from Lucide (ISC) and Simple Icons (CC0).
