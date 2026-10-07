export const GHL_API = "https://services.leadconnectorhq.com";
export const GHL_API_VERSION = "2021-07-28";

/** OAuth scopes this app requests. Keep in sync with the scopes selected in the Developer portal. */
export const GHL_SCOPES = [
  "contacts.readonly",
  "contacts.write",
  "workflows.readonly",
  "medias.readonly",
  "medias.write",
  "locations.readonly",
  "oauth.readonly",
  "oauth.write",
];

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  get appUrl() {
    return env("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  /**
   * Optional separate origin for hosted pages (/p/:id), e.g. https://pages.example.com.
   * Customer pages can contain custom HTML/JS; serving them away from the editor's origin keeps that code
   * off the app's domain. Unset = hosted pages are served from APP_URL.
   */
  get pagesUrl() {
    return env("PAGES_URL").replace(/\/$/, "");
  },
  get clientId() {
    return env("GHL_CLIENT_ID");
  },
  get clientSecret() {
    return env("GHL_CLIENT_SECRET");
  },
  get ssoKey() {
    return env("GHL_SSO_KEY");
  },
  get webhookPublicKey() {
    return env("GHL_WEBHOOK_PUBLIC_KEY").replace(/\\n/g, "\n");
  },
  get sessionSecret() {
    const s = env("SESSION_SECRET");
    if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
    return s || "dev-only-session-secret";
  },
  get allowDevLogin() {
    return env("ALLOW_DEV_LOGIN") === "true";
  },
  get redirectUri() {
    return `${this.appUrl}/api/oauth/callback`;
  },
};
