import { registerClient } from "@/lib/oauth";
import { oauthHandle, oauthJson, preflight } from "@/lib/oauthHttp";

/** RFC 7591 dynamic client registration: AI apps register themselves before the first sign-in. */
export const POST = oauthHandle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const client = await registerClient(body);
  return oauthJson(client.raw, 201);
});
export const OPTIONS = preflight;
