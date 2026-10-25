/**
 * Bringing USDC from Base (Circle CCTP V2, course module 20): the parts that
 * don't touch a wallet. The SDK's useCrossChainDeposit does the transfer; this
 * file remembers a deposit in flight so the page can be closed, and turns the
 * hook's steps into sentences.
 */

/** A burn on Base whose Starknet mint hasn't been seen yet. */
export interface PendingDeposit {
  burnTxHash: string;
  sourceDomain: number;
  /** Human USDC, as quoted. */
  amountUsdc: string;
  /** Unix ms when the burn was sent. */
  startedAt: number;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Fired on `window` after a save or clear, so a component reading the record re-renders. */
export const PENDING_DEPOSIT_EVENT = "vela:pending-deposit";

/**
 * Where a record lives: `storage` survives a reload; `memory` is this tab only,
 * used when localStorage is missing or throws (private mode, quota, policy).
 * The burn hash is never dropped: a deposit in flight must stay visible.
 */
export type PendingDepositHome = "storage" | "memory";
const memory = new Map<string, string>();

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PENDING_DEPOSIT_EVENT));
}

/** One pending deposit per Vela wallet. */
export function pendingDepositKey(walletAddress: string): string {
  return `vela:pending-deposit:${walletAddress.toLowerCase()}`;
}

/** Remembers the deposit; says where it ended up. */
export function savePendingDeposit(
  walletAddress: string,
  deposit: PendingDeposit,
  store = defaultStore()
): PendingDepositHome {
  const key = pendingDepositKey(walletAddress);
  const raw = JSON.stringify(deposit);
  let home: PendingDepositHome = "memory";
  try {
    if (store) {
      store.setItem(key, raw);
      home = "storage";
    }
  } catch {
    // Quota, private mode, a blocked origin: keep it in memory instead.
  }
  if (home === "memory") memory.set(key, raw);
  else memory.delete(key);
  announce();
  return home;
}

/** The remembered deposit, or null when there is none or the record is unreadable. */
export function loadPendingDeposit(walletAddress: string, store = defaultStore()): PendingDeposit | null {
  return parsePendingDeposit(readPendingDepositRaw(walletAddress, store));
}

/** The stored record, checked field by field; null for anything that isn't a burn hash with its context. */
export function parsePendingDeposit(raw: string | null): PendingDeposit | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingDeposit>;
    if (
      typeof value.burnTxHash !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(value.burnTxHash) ||
      typeof value.sourceDomain !== "number" ||
      typeof value.amountUsdc !== "string" ||
      typeof value.startedAt !== "number"
    ) {
      return null;
    }
    return { burnTxHash: value.burnTxHash, sourceDomain: value.sourceDomain, amountUsdc: value.amountUsdc, startedAt: value.startedAt };
  } catch {
    return null;
  }
}

export function clearPendingDeposit(walletAddress: string, store = defaultStore()): void {
  const key = pendingDepositKey(walletAddress);
  try {
    store?.removeItem(key);
  } catch {
    // Nothing to do: the memory copy below is what the page reads then.
  }
  memory.delete(key);
  announce();
}

function readStored(key: string, store: Store | null): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** The raw record for `useSyncExternalStore`: the string itself, so an unchanged record is the same snapshot. */
export function readPendingDepositRaw(walletAddress: string, store = defaultStore()): string | null {
  const key = pendingDepositKey(walletAddress);
  return readStored(key, store) ?? memory.get(key) ?? null;
}

/** Where the current record lives, or null without one. `memory` means a reload loses it. */
export function pendingDepositHome(walletAddress: string, store = defaultStore()): PendingDepositHome | null {
  const key = pendingDepositKey(walletAddress);
  if (readStored(key, store)) return "storage";
  return memory.has(key) ? "memory" : null;
}

/** Re-render on a save or clear from this tab, or a change from another tab. */
export function subscribePendingDeposit(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PENDING_DEPOSIT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PENDING_DEPOSIT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * What the user sees at each step of the SDK's deposit. `eta` is the SDK's
 * own estimate for the step (formatCctpEta), never a number typed here: the
 * route decides how long attestation takes.
 */
export function depositStepLabel(step: string, eta: string | null): string {
  switch (step) {
    case "quoting":
      return "Getting Circle's quote…";
    case "switching-chain":
      return "Switch your wallet to Base…";
    case "approving":
      return "Approve USDC in your wallet…";
    case "burning":
      return "Confirm the deposit in your wallet…";
    case "registering":
      return "Sent on Base. Registering it with Chipi…";
    case "attesting":
      return `Circle is attesting the transfer (${eta ?? "a while"}). You can close this page: the USDC arrives on its own.`;
    case "minting":
      return `Minting on Starknet (${eta ?? "a while"})…`;
    case "recording":
      return "Recording the deposit…";
    case "done":
      return "Arrived in your Vela wallet.";
    default:
      return "Working…";
  }
}

/** "started 3 minutes ago", for a deposit resumed from storage. */
export function describeStartedAt(startedAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - startedAt) / 60_000));
  if (minutes < 1) return "started just now";
  if (minutes === 1) return "started a minute ago";
  if (minutes < 120) return `started ${minutes} minutes ago`;
  return `started ${Math.round(minutes / 60)} hours ago`;
}
