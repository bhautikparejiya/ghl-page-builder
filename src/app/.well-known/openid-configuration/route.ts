import { authServerMetadata } from "@/lib/oauth";
import { oauthJson, preflight } from "@/lib/oauthHttp";

/** Some MCP clients look here first. Same OAuth metadata (PageForge is not an OpenID provider). */
export const GET = async () => oauthJson(authServerMetadata());
export const OPTIONS = preflight;
