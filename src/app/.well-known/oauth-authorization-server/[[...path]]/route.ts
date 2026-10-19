import { authServerMetadata } from "@/lib/oauth";
import { oauthJson, preflight } from "@/lib/oauthHttp";

/** RFC 8414 authorization server metadata. */
export const GET = async () => oauthJson(authServerMetadata());
export const OPTIONS = preflight;
