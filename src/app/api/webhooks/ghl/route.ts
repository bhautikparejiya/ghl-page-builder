import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { removeInstall } from "@/lib/ghl";

function verify(raw: string, req: Request): boolean {
  const key = config.webhookPublicKey;
  if (!key) return true; // verification disabled until a public key is configured
  try {
    const ed = req.headers.get("x-ghl-signature");
    if (ed) return crypto.verify(null, Buffer.from(raw), key, Buffer.from(ed, "base64"));
    const rsa = req.headers.get("x-wh-signature");
    if (rsa) return crypto.verify("sha256", Buffer.from(raw), key, Buffer.from(rsa, "base64"));
  } catch (err) {
    console.error("Webhook signature check failed", err);
  }
  return false;
}

/** App lifecycle webhooks (configure "Default Webhook URL" in the Developer portal). */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const event = JSON.parse(raw || "{}") as { type?: string; locationId?: string; companyId?: string };
  if (event.type === "UNINSTALL") {
    await removeInstall(event.locationId, event.companyId);
  }
  return NextResponse.json({ ok: true });
}
