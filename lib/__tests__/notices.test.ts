import { describe, expect, it } from "vitest";
import { recoveryAlert, sessionNotice, SESSION_ENDING_SECONDS } from "../notices";

const NOW = 1_800_000_000;
const DAY = 86_400;

describe("sessionNotice", () => {
  const session = (over: Partial<{ isActive: boolean; validUntil: number; remainingCalls: number }> = {}) => ({
    isActive: true,
    validUntil: NOW + 5 * DAY,
    remainingCalls: 900,
    ...over,
  });

  it("says nothing while the agent runs with time left", () => {
    expect(sessionNotice(true, session(), NOW)).toBeNull();
  });

  it("warns a day before the session ends", () => {
    const validUntil = NOW + SESSION_ENDING_SECONDS;
    expect(sessionNotice(true, session({ validUntil }), NOW)).toEqual({ kind: "ending", endsAt: validUntil });
    expect(sessionNotice(true, session({ validUntil: validUntil + 1 }), NOW)).toBeNull();
  });

  it("reports the end date once the session expired, whether or not the tick noticed", () => {
    const validUntil = NOW - DAY;
    expect(sessionNotice(false, session({ isActive: false, validUntil }), NOW)).toEqual({ kind: "expired", endedAt: validUntil });
    expect(sessionNotice(true, session({ validUntil }), NOW)).toEqual({ kind: "expired", endedAt: validUntil });
  });

  it("tells a session that ran out of calls apart from one that was stopped", () => {
    expect(sessionNotice(false, session({ isActive: false, remainingCalls: 0 }), NOW)).toEqual({ kind: "out-of-calls" });
    expect(sessionNotice(false, session({ isActive: false }), NOW)).toEqual({ kind: "stopped" });
  });

  it("treats an agent the server stopped as stopped, even if its session is live", () => {
    expect(sessionNotice(false, session(), NOW)).toEqual({ kind: "stopped" });
  });

  it("treats no session for this wallet as stopped", () => {
    expect(sessionNotice(true, null, NOW)).toEqual({ kind: "stopped" });
  });

  it("treats a revoked or never-registered session (all zeros on-chain) as stopped, not expired in 1970", () => {
    expect(sessionNotice(false, { isActive: false, validUntil: 0, remainingCalls: 0 }, NOW)).toEqual({ kind: "stopped" });
  });
});

describe("recoveryAlert", () => {
  const pending = { initiatedAt: NOW - DAY, validAfter: NOW + 6 * DAY, newOwnerHash: 1n, isActive: true };

  it("is null when no recovery is pending", () => {
    expect(recoveryAlert({ ...pending, isActive: false }, NOW)).toBeNull();
  });

  it("shows when a pending recovery completes", () => {
    expect(recoveryAlert(pending, NOW)).toEqual({ initiatedAt: NOW - DAY, completesAt: NOW + 6 * DAY, ready: false });
  });

  it("flags a recovery anyone can finalize now", () => {
    expect(recoveryAlert(pending, NOW + 6 * DAY)?.ready).toBe(true);
  });
});
