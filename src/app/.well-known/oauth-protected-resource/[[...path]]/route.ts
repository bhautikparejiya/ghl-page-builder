import { resourceMetadata } from "@/lib/oauth";
import { oauthJson, preflight } from "@/lib/oauthHttp";

/** RFC 9728 metadata for the MCP endpoint (also served at /.well-known/oauth-protected-resource/api/mcp). */
export const GET = async () => oauthJson(resourceMetadata());
export const OPTIONS = preflight;
