import { config, GHL_API, GHL_API_VERSION } from "./config";
import { kv } from "./store";

/** Stored OAuth installation (one per sub-account, plus one per agency for bulk installs). */
export interface Install {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
  userType: "Location" | "Company";
  locationId?: string;
  companyId?: string;
  scope?: string;
  installedAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  userType: "Location" | "Company";
  locationId?: string;
  companyId?: string;
}

const locKey = (locationId: string) => `install:loc:${locationId}`;
const coKey = (companyId: string) => `install:co:${companyId}`;

function toInstall(t: TokenResponse): Install {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in - 300) * 1000,
    userType: t.userType,
    locationId: t.locationId,
    companyId: t.companyId,
    scope: t.scope,
    installedAt: Date.now(),
  };
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${GHL_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OAuth token error ${res.status}: ${JSON.stringify(data)}`);
  return data as TokenResponse;
}

/** Exchanges the authorization code received on install and stores the tokens. */
export async function exchangeCode(code: string): Promise<Install> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri });
  const install = toInstall(t);
  await saveInstall(install);
  return install;
}

export async function saveInstall(install: Install) {
  if (install.userType === "Location" && install.locationId) await kv().set(locKey(install.locationId), install);
  if (install.userType === "Company" && install.companyId) await kv().set(coKey(install.companyId), install);
}

export async function removeInstall(locationId?: string, companyId?: string) {
  if (locationId) await kv().del(locKey(locationId));
  else if (companyId) await kv().del(coKey(companyId));
}

export async function getInstall(locationId: string): Promise<Install | null> {
  return kv().get<Install>(locKey(locationId));
}

async function refresh(install: Install): Promise<Install> {
  const t = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: install.refreshToken,
    user_type: install.userType,
  });
  const next = { ...toInstall(t), installedAt: install.installedAt };
  await saveInstall(next);
  return next;
}

/** For agency (bulk) installs: mint a sub-account token from the agency token. */
async function locationTokenFromCompany(companyId: string, locationId: string): Promise<Install | null> {
  let company = await kv().get<Install>(coKey(companyId));
  if (!company) return null;
  if (company.expiresAt < Date.now()) company = await refresh(company);
  const res = await fetch(`${GHL_API}/oauth/locationToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${company.accessToken}`,
      Version: GHL_API_VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ companyId, locationId }),
  });
  if (!res.ok) return null;
  const install = toInstall((await res.json()) as TokenResponse);
  await saveInstall(install);
  return install;
}

/** Returns a valid access token for a sub-account, refreshing / minting as needed. */
export async function getLocationToken(locationId: string, companyId?: string): Promise<string | null> {
  let install = await getInstall(locationId);
  if (!install && companyId) install = await locationTokenFromCompany(companyId, locationId);
  if (!install) return null;
  if (install.expiresAt < Date.now()) install = await refresh(install);
  return install.accessToken;
}

export class GhlNotInstalledError extends Error {
  constructor() {
    super("The app is not installed for this sub-account (no OAuth token found).");
  }
}

/** Authenticated call to the HighLevel API on behalf of a sub-account. */
export async function ghlFetch<T = unknown>(
  locationId: string,
  pathname: string,
  init: RequestInit = {},
  companyId?: string,
): Promise<T> {
  const token = await getLocationToken(locationId, companyId);
  if (!token) throw new GhlNotInstalledError();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Version", GHL_API_VERSION);
  headers.set("Accept", "application/json");
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${GHL_API}${pathname}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`HighLevel API ${res.status} ${pathname}: ${text.slice(0, 300)}`);
  return data as T;
}
