import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public: the landing, the demo, and the two machine endpoints that carry
// their own auth (/api/think is paid with x402, /api/tick needs CRON_SECRET).
const isPublic = createRouteMatcher([
  "/",
  "/demo(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/think",
  "/api/tick",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
