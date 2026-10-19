import { handleMcp } from "@/lib/mcp/server";

type Ctx = { params: Promise<{ key: string }> };

/** MCP endpoint with the API key in the URL, for AI tools that only accept a server URL (no custom headers). */
const handler = async (req: Request, { params }: Ctx) => handleMcp(req, (await params).key);

export { handler as GET, handler as OPTIONS, handler as POST };
