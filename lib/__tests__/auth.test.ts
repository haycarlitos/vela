import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ pool: {} }));

import { appUrl } from "../auth";

afterEach(() => vi.unstubAllEnvs());

describe("appUrl", () => {
  it("prefers BETTER_AUTH_URL, then Vercel's production URL, then localhost", () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(appUrl()).toBe("http://localhost:3000");

    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "vela-starknet.vercel.app");
    expect(appUrl()).toBe("https://vela-starknet.vercel.app");

    vi.stubEnv("BETTER_AUTH_URL", "https://vela.example.com");
    expect(appUrl()).toBe("https://vela.example.com");
  });
});
