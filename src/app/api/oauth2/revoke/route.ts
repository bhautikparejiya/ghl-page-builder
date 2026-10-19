import { revokeToken } from "@/lib/oauth";
import { OAUTH_CORS, oauthHandle, preflight, readParams } from "@/lib/oauthHttp";

/** RFC 7009: always 200, whether or not the token existed. */
export const POST = oauthHandle(async (req: Request) => {
  const { token } = await readParams(req);
  if (token) await revokeToken(token);
  return new Response(null, { status: 200, headers: OAUTH_CORS });
});
export const OPTIONS = preflight;
