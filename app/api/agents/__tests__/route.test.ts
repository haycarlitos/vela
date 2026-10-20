import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn(async () => "user-1"), linkedWallet: vi.fn(async () => null) }));
const getWallet = vi.fn();
vi.mock("@/lib/chipi", () => ({ chipi: () => ({ getWallet, sessions: { getSessionData: vi.fn() } }), sessionSecret: () => "s" }));
vi.mock("@/lib/db", () => ({
  getAgent: vi.fn(async () => null),
  recentDecisions: vi.fn(async () => []),
  setAgentActive: vi.fn(),
  upsertPendingAgent: vi.fn(),
}));
vi.mock("@/lib/portfolio", () => ({ getPortfolio: vi.fn(), totalUsd: vi.fn(() => 0) }));

import { GET } from "../route";
import { getPortfolio } from "@/lib/portfolio";

beforeEach(() => {
  vi.clearAllMocks();
  getWallet.mockResolvedValue({ publicKey: "0x" + "a".repeat(64), walletType: "SHHH" });
});

describe("GET /api/agents", () => {
  it("answers 503 with a readable message when balances can't be read (no bare 500, no guessed zero)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getPortfolio).mockRejectedValueOnce(new Error("Failed to fetch STRK balance from Starknet RPC. Please retry."));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("15");
    expect(await res.json()).toEqual({ error: "Couldn't read your balances from Starknet right now. Retrying…" });
  });
});
