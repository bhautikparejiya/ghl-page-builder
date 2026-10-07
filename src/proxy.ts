import { NextRequest, NextResponse } from "next/server";
import { config as appConfig } from "@/lib/config";

/** Paths the hosted-pages domain (and custom domains) may serve. Everything else (editor, private APIs) is app-only. */
const PAGES_HOST_PATHS = [/^\/p\//, /^\/api\/public\//, /^\/runtime(\.(js|css)$|\/)/, /^\/loader\.js$/, /^\/_next\//, /^\/favicon/];

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/** Hosts that belong to this deployment (app domain, pages domain, previews, local dev). */
function isOwnHost(host: string) {
  const bare = host.replace(/:\d+$/, "");
  return (
    host === hostOf(appConfig.appUrl) ||
    (!!appConfig.pagesUrl && host === hostOf(appConfig.pagesUrl)) ||
    bare === "localhost" ||
    bare === "127.0.0.1" ||
    bare.endsWith(".localhost") ||
    bare.endsWith(".vercel.app") ||
    (!!process.env.VERCEL_URL && host === process.env.VERCEL_URL)
  );
}

/**
 * - Custom domains (any host that isn't ours): served by /d/… which looks up the mapped page.
 * - PAGES_URL set: /p/:id on the app domain redirects there, and the pages domain only serves pages + public assets.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";

  if (host && !isOwnHost(host)) {
    if (PAGES_HOST_PATHS.some((re) => re.test(pathname))) return NextResponse.next();
    return NextResponse.rewrite(new URL(`/d${pathname === "/" ? "" : pathname}${search}`, req.url));
  }

  const pagesUrl = appConfig.pagesUrl;
  if (!pagesUrl) return NextResponse.next();
  const pagesHost = hostOf(pagesUrl);
  if (pagesHost === hostOf(appConfig.appUrl)) return NextResponse.next();

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
