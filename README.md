# PageForge for HighLevel

A HighLevel Marketplace app that adds an Elementor-style visual page builder to HighLevel.
Users design pages inside HighLevel (as a Custom Page in the left menu), then publish them into any HighLevel
funnel or website step with a one-time snippet. Edits after that go live automatically.

## Features

- **Visual editor (GrapesJS):** drag and drop, layers, undo/redo, code view, per-device styling (desktop / tablet / mobile).
- **More than 30 widgets:** tabs, accordion/FAQ, animated counters, countdown (fixed date or evergreen per visitor, redirect when expired),
  before/after slider, carousel, testimonials, feature boxes, pricing table with monthly/yearly toggle, progress bars,
  typing headline, flip box, logo marquee, sticky navbar with mobile menu, popups (click, delay, exit intent), custom HTML.
- **16 prebuilt sections and 4 templates:** blank, SaaS, webinar, local business/agency.
- **Advanced options on every element:** entrance animations with delay, hover effects (lift/grow/glow/tilt), hide per device,
  and "on click open popup".
- **Global theme:** colors, Google Fonts and corner radius.
- **CRM-connected lead forms:** each submission creates or updates a contact, adds tags, enrolls the contact in a workflow, saves extra
  fields as a contact note, then shows a success message or redirects. Includes spam protection (honeypot and timing check).
- **HighLevel Media Library:** upload images and pick from existing ones.
- **Publishing:** a Shadow DOM embed, so styles never clash with the funnel, plus a standalone hosted URL (`/p/:id`).
- **Leads log:** the last 200 submissions per page, with CRM sync status.

## How it works

```
HighLevel sub-account ──(left menu: Custom Page iframe)──► /app  (Next.js on Vercel)
        │                         SSO: REQUEST_USER_DATA → /api/auth/sso → signed session
        │
  Funnel page with Custom Code:  <div data-gpb-page="ID"></div><script src=".../loader.js">
        │                         loader.js → /api/public/pages/ID → Shadow DOM + runtime.js
        ▼
  Lead form ─► /api/public/forms ─► HighLevel API (contacts upsert, tags, workflow, notes)
```

| Path | Purpose |
|---|---|
| `src/app/api/oauth/callback` | Install: exchanges the OAuth code and stores tokens (per sub-account or agency) |
| `src/app/api/webhooks/ghl` | Uninstall webhook: deletes tokens |
| `src/app/api/auth/sso` | Decrypts HighLevel user context with the Shared Secret and issues a session |
| `src/app/api/pages/**` | Page CRUD, publish, submissions (scoped to the session's sub-account) |
| `src/app/api/public/**` | Public, CORS-enabled endpoints used by published pages |
| `src/components/editor/` | Editor UI and GrapesJS plugin (widgets, settings, blocks) |
| `src/lib/sections.ts` | Widget and section markup (shared by the blocks and templates) |
| `public/runtime.js` / `runtime.css` | Widget behaviour and styles on live pages and in the editor canvas |
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
     `locations.readonly`, `oauth.readonly`, `oauth.write`
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
- Widget behaviour lives in `public/runtime.js`, which is cached for 5 minutes at the browser and up to 1 hour at the CDN. After changing it,
  redeploy and allow for cache time.
- Image uploads go through Vercel, which caps request bodies at about 4.5 MB.
