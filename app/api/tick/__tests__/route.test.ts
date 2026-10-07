import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ claimDueAgent: vi.fn(), countOverdueAgents: vi.fn(), logDecision: vi.fn() }));
vi.mock("@/lib/agent", () => ({ runTick: vi.fn() }));

import { GET } from "../route";
import { claimDueAgent, countOverdueAgents, logDecision } from "@/lib/db";
import { runTick } from "@/lib/agent";

const agent = (id: string) => ({ user_id: id }) as never;
const call = (headers: Record<string, string> = {}) => GET(new Request("https://vela.test/api/tick", { headers }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(countOverdueAgents).mockResolvedValue(0);
  vi.mocked(logDecision).mockResolvedValue(undefined);
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/tick", () => {
  it("runs each claimed agent until none is due, and answers without user data", async () => {
    vi.mocked(claimDueAgent).mockResolvedValueOnce(agent("user_a")).mockResolvedValueOnce(agent("user_b")).mockResolvedValue(null);
    vi.mocked(runTick).mockResolvedValueOnce({ userId: "user_a", outcome: "hold", detail: "quiet" });
    vi.mocked(runTick).mockRejectedValueOnce(new Error("rpc down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const body = await (await call()).json();

    expect(body).toEqual({ ran: 2, outcomes: ["hold", "failed"], failed: 1, overdue: 0 });
    expect(JSON.stringify(body)).not.toMatch(/user_|rpc down/);
  });

  it("records a tick that threw in the user's activity", async () => {
    vi.mocked(claimDueAgent).mockResolvedValueOnce(agent("user_a")).mockResolvedValue(null);
    vi.mocked(runTick).mockRejectedValueOnce(new Error("rpc down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await call();

    expect(logDecision).toHaveBeenCalledWith({ userId: "user_a", kind: "error", reason: "Tick failed: rpc down", success: false });
  });

  it("counts a trade the wallet refused as an outcome, not as a failed tick", async () => {
    vi.mocked(claimDueAgent).mockResolvedValueOnce(agent("user_a")).mockResolvedValue(null);
    vi.mocked(runTick).mockResolvedValueOnce({ userId: "user_a", outcome: "failed", detail: "blocked", txHash: "0x1" });

    expect(await (await call()).json()).toEqual({ ran: 1, outcomes: ["failed"], failed: 0, overdue: 0 });
  });

  it("reports active agents with no tick for two intervals", async () => {
    vi.mocked(claimDueAgent).mockResolvedValue(null);
    vi.mocked(countOverdueAgents).mockResolvedValue(3);

    expect(await (await call()).json()).toEqual({ ran: 0, outcomes: [], failed: 0, overdue: 3 });
    expect(countOverdueAgents).toHaveBeenCalledWith(2 * 24 * 60 * 60);
  });

  it("does nothing when no agent is due", async () => {
    vi.mocked(claimDueAgent).mockResolvedValue(null);
    expect(await (await call()).json()).toEqual({ ran: 0, outcomes: [], failed: 0, overdue: 0 });
    expect(runTick).not.toHaveBeenCalled();
  });

  it("only claims agents whose last tick is most of an interval old", async () => {
    vi.mocked(claimDueAgent).mockResolvedValue(null);
    await call();
    expect(claimDueAgent).toHaveBeenCalledWith(24 * 60 * 60 * 0.9);
  });

  describe("with CRON_SECRET", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "s3cret";
      vi.mocked(claimDueAgent).mockResolvedValue(null);
    });

    it("refuses a call without the secret, before touching the database", async () => {
      const res = await call();
      expect(res.status).toBe(401);
      expect(claimDueAgent).not.toHaveBeenCalled();
      expect(countOverdueAgents).not.toHaveBeenCalled();
    });

    it("refuses a wrong secret", async () => {
      expect((await call({ authorization: "Bearer nope" })).status).toBe(401);
      expect((await call({ authorization: "s3cret" })).status).toBe(401);
    });

    it("runs with the bearer secret (what Vercel Cron and Trigger.dev send)", async () => {
      const res = await call({ authorization: "Bearer s3cret" });
      expect(res.status).toBe(200);
      expect(claimDueAgent).toHaveBeenCalled();
    });
  });
});
