import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { derivedSecret, sessionSecret } from "../chipi";

afterEach(() => vi.unstubAllEnvs());

describe("secrets", () => {
  it("derives a stable 32-byte key per purpose from CHIPI_SECRET_KEY", () => {
    vi.stubEnv("CHIPI_SECRET_KEY", "sk_prod_one");
    vi.stubEnv("VELA_SESSION_SECRET", "");
    const key = sessionSecret();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionSecret()).toBe(key);
    expect(derivedSecret("auth")).not.toBe(key);

    vi.stubEnv("CHIPI_SECRET_KEY", "sk_prod_two");
    expect(sessionSecret()).not.toBe(key);
  });

  it("uses VELA_SESSION_SECRET when it is set", () => {
    vi.stubEnv("CHIPI_SECRET_KEY", "sk_prod_one");
    vi.stubEnv("VELA_SESSION_SECRET", "x".repeat(32));
    expect(sessionSecret()).toBe("x".repeat(32));
    vi.stubEnv("VELA_SESSION_SECRET", "short");
    expect(() => sessionSecret()).toThrow(/at least 32/);
  });
});
