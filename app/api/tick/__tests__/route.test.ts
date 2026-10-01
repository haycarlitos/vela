import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ claimDueAgent: vi.fn() }));
vi.mock("@/lib/agent", () => ({ runTick: vi.fn() }));

import { GET } from "../route";
import { claimDueAgent } from "@/lib/db";
import { runTick } from "@/lib/agent";

const agent = (id: string) => ({ user_id: id }) as never;

beforeEach(() => vi.clearAllMocks());

describe("GET /api/tick", () => {
  it("runs each claimed agent until none is due, and answers without user data", async () => {
    vi.mocked(claimDueAgent).mockResolvedValueOnce(agent("user_a")).mockResolvedValueOnce(agent("user_b")).mockResolvedValue(null);
    vi.mocked(runTick).mockResolvedValueOnce({ userId: "user_a", outcome: "hold", detail: "quiet" });
    vi.mocked(runTick).mockRejectedValueOnce(new Error("rpc down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const body = await (await GET()).json();

    expect(body).toEqual({ ran: 2, outcomes: ["hold", "failed"] });
    expect(JSON.stringify(body)).not.toMatch(/user_|rpc down/);
  });

  it("does nothing when no agent is due", async () => {
    vi.mocked(claimDueAgent).mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ ran: 0, outcomes: [] });
    expect(runTick).not.toHaveBeenCalled();
  });

  it("only claims agents whose last tick is most of an interval old", async () => {
    vi.mocked(claimDueAgent).mockResolvedValue(null);
    await GET();
    expect(claimDueAgent).toHaveBeenCalledWith(24 * 60 * 60 * 0.9);
  });
});
