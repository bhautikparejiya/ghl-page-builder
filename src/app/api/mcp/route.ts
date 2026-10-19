import { handleMcp } from "@/lib/mcp/server";

/** MCP endpoint, authenticated with `Authorization: Bearer <PageForge API key>`. */
const handler = (req: Request) => handleMcp(req, (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null);

export { handler as GET, handler as OPTIONS, handler as POST };
