import { exchangeCode, OAuthError, refreshTokens } from "@/lib/oauth";
import { oauthHandle, oauthJson, preflight, readParams } from "@/lib/oauthHttp";

export const POST = oauthHandle(async (req: Request) => {
  const p = await readParams(req);
  if (p.grant_type === "authorization_code") return oauthJson(await exchangeCode(p));
  if (p.grant_type === "refresh_token") return oauthJson(await refreshTokens(p));
  throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
});
export const OPTIONS = preflight;
