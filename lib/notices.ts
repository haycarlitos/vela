import type { ShhhPendingRecovery } from "@chipi-stack/backend";

/** Warn this long before the agent's session ends. */
export const SESSION_ENDING_SECONDS = 24 * 3600;

export type SessionNotice =
  /** Still running, but the session ends soon. */
  | { kind: "ending"; endsAt: number }
  /** The session reached its end date: the agent stopped by itself. */
  | { kind: "expired"; endedAt: number }
  /** The session used every call it allowed. */
  | { kind: "out-of-calls" }
  /** Stopped (by the user, or revoked) or never confirmed. */
  | { kind: "stopped" };

/**
 * What to tell the user about the agent's session. `session` is the chain's
 * view (`getSessionData`), or null when there is none for this wallet. `now`
 * is unix seconds. Null: nothing to say.
 */
export function sessionNotice(
  agentActive: boolean,
  session: { isActive: boolean; validUntil: number; remainingCalls: number } | null,
  now: number
): SessionNotice | null {
  // No session for this wallet, or one that was revoked (zeroed) or never registered.
  if (!session || session.validUntil === 0) return { kind: "stopped" };
  if (agentActive && session.isActive && now < session.validUntil) {
    return session.validUntil - now <= SESSION_ENDING_SECONDS ? { kind: "ending", endsAt: session.validUntil } : null;
  }
  if (now >= session.validUntil) return { kind: "expired", endedAt: session.validUntil };
  if (session.remainingCalls <= 0) return { kind: "out-of-calls" };
  return { kind: "stopped" };
}

export type RecoveryAlert = {
  initiatedAt: number;
  /** When anyone may finalize it, adding the new key as an owner. */
  completesAt: number;
  /** The 7 days are over: it can be finalized right now. */
  ready: boolean;
};

/**
 * A recovery someone started on the wallet (`readPendingRecovery`), or null.
 * A recovery has no expiry: it stays until an owner cancels it or anyone
 * finalizes it after the timelock.
 */
export function recoveryAlert(pending: ShhhPendingRecovery, now: number): RecoveryAlert | null {
  if (!pending.isActive) return null;
  return { initiatedAt: pending.initiatedAt, completesAt: pending.validAfter, ready: now >= pending.validAfter };
}

/** "Oct 25, 4:57 PM", in the reader's locale. */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
