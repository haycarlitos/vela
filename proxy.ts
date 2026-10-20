import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "./lib/app-url";

/**
 * Vela answers on one origin (`appUrl()`): passkeys, Sign in with Starknet and
 * Better Auth only accept it. Vercel also serves production on other hosts,
 * such as the automatic `<project>-<team>.vercel.app` alias, where sign-in
 * fails with "Invalid origin". Page visits there move to the canonical origin.
 * API routes are left alone: cron jobs and servers may call any alias.
 */
export function proxy(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.next();
  const canonical = new URL(appUrl());
  if (req.nextUrl.host === canonical.host) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.protocol = canonical.protocol;
  url.host = canonical.host;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
