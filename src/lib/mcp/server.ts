/**
 * A stateless MCP server over Streamable HTTP (JSON responses, no SSE stream).
 * Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */
import { verifyApiKey } from "../apiKeys";
import { verifyAccessToken, wwwAuthenticate } from "../oauth";
import { type Principal, SERVER_INSTRUCTIONS, ToolError, TOOLS } from "./tools";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 2_000_000;

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function dispatch(msg: RpcRequest, key: Principal): Promise<unknown | null> {
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null; // notifications/initialized, cancelled… need no answer
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "pageforge", title: "PageForge page builder", version: "1.0.0" },
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, ...(annotations ? { annotations } : {}) })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}`);
      try {
        const result = await tool.run((msg.params?.arguments ?? {}) as Record<string, unknown>, key);
        return ok({ content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      } catch (e) {
        // Tool errors go back to the model as results it can read and fix, not as protocol errors.
        const message = e instanceof ToolError ? e.message : "Something went wrong in PageForge. Try again.";
        if (!(e instanceof ToolError)) console.error("[mcp]", tool.name, e);
        return ok({ content: [{ type: "text", text: message }], isError: true });
      }
    }
    case "resources/list":
      return ok({ resources: [] });
    case "prompts/list":
      return ok({ prompts: [] });
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

/** Handles one HTTP request to the MCP endpoint. `token` comes from the Authorization header or the URL. */
export async function handleMcp(req: Request, token: string | null): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  // No server-initiated stream: clients fall back to plain POST request/response.
  if (req.method !== "POST") return json({ error: "Use POST. This MCP server does not open an SSE stream." }, 405, { Allow: "POST, OPTIONS" });

  const key = await authenticate(token);
  if (!key) {
    // OAuth clients read WWW-Authenticate to discover how to sign in (RFC 9728).
    return json(rpcError(null, -32001, token ? "Invalid, expired or revoked token." : "Sign in to PageForge to use these tools."), 401, {
      "WWW-Authenticate": wwwAuthenticate(token ? "invalid_token" : undefined),
    });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(rpcError(null, -32600, "Request too large"), 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as RpcRequest[];
  if (!msgs.length || msgs.some((m) => !m || m.jsonrpc !== "2.0" || typeof m.method !== "string")) {
    return json(rpcError(null, -32600, "Invalid request"), 400);
  }
  const replies = (await Promise.all(msgs.map((m) => dispatch(m, key)))).filter((r) => r !== null);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return json(batch ? replies : replies[0]);
}

/** An API key (pfk_…) created in PageForge, or an OAuth access token (pfa_…) from an approved AI app. */
async function authenticate(token: string | null): Promise<Principal | null> {
  if (!token) return null;
  if (token.startsWith("pfa_")) return verifyAccessToken(token);
  return verifyApiKey(token);
}
