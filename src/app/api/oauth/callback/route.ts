import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/ghl";
import { config } from "@/lib/config";

/** HighLevel redirects here after an agency/sub-account installs the app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  let target: URL;
  try {
    target = new URL("/installed", config.appUrl);
  } catch {
    console.error(`Invalid APP_URL: ${JSON.stringify(config.appUrl)}`);
    target = new URL("/installed", url.origin);
  }
  if (!code) {
    target.searchParams.set("error", "Missing authorization code");
    return NextResponse.redirect(target);
  }
  try {
    const install = await exchangeCode(code);
    target.searchParams.set("ok", "1");
    target.searchParams.set("type", install.userType);
  } catch (err) {
    console.error(err);
    target.searchParams.set("error", (err as Error).message.slice(0, 200));
  }
  return NextResponse.redirect(target);
}
