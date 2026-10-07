import { NextRequest, NextResponse } from "next/server";
import { config as appConfig } from "@/lib/config";

/** Paths the hosted-pages domain may serve. Everything else (editor, private APIs) is app-only. */
const PAGES_HOST_PATHS = [/^\/p\//, /^\/api\/public\//, /^\/runtime\.(js|css)$/, /^\/loader\.js$/, /^\/_next\//, /^\/favicon/];

/**
 * When PAGES_URL is set, hosted pages live on their own origin:
 * - app domain:   /p/:id redirects to the pages domain
 * - pages domain: only hosted pages + public assets/APIs are served
 */
export function proxy(req: NextRequest) {
  const pagesUrl = appConfig.pagesUrl;
  if (!pagesUrl) return NextResponse.next();
  const pagesHost = new URL(pagesUrl).host;
  if (pagesHost === new URL(appConfig.appUrl).host) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";

  if (host === pagesHost) {
    if (PAGES_HOST_PATHS.some((re) => re.test(pathname))) return NextResponse.next();
    return new NextResponse("Not found", { status: 404 });
  }
  if (pathname.startsWith("/p/")) return NextResponse.redirect(`${pagesUrl}${pathname}${search}`, 308);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
