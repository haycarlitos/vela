import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "../../proxy";

afterEach(() => vi.unstubAllEnvs());

function production() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("BETTER_AUTH_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "vela-starknet.vercel.app");
}

describe("proxy", () => {
  it("moves a page visit on another production host to the canonical origin, path and query kept", () => {
    production();
    const res = proxy(new NextRequest("https://vela-chipi.vercel.app/onboarding?x=1"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://vela-starknet.vercel.app/onboarding?x=1");
  });

  it("leaves the canonical host alone", () => {
    production();
    const res = proxy(new NextRequest("https://vela-starknet.vercel.app/onboarding"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does nothing outside production (previews, local)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "vela-starknet.vercel.app");
    expect(proxy(new NextRequest("https://vela-git-x-chipi.vercel.app/")).headers.get("location")).toBeNull();
  });

  it("never runs on API routes or Next assets (cron and servers may use any alias)", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/onboarding")).toBe(true);
    expect(matcher.test("/")).toBe(true);
    expect(matcher.test("/api/tick")).toBe(false);
    expect(matcher.test("/api/auth/jwks")).toBe(false);
    expect(matcher.test("/_next/static/chunks/a.js")).toBe(false);
  });
});
