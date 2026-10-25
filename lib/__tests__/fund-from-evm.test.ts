import { describe, it, expect } from "vitest";
import {
  clearPendingDeposit,
  depositStepLabel,
  describeStartedAt,
  loadPendingDeposit,
  parsePendingDeposit,
  pendingDepositHome,
  pendingDepositKey,
  readPendingDepositRaw,
  savePendingDeposit,
  type PendingDeposit,
} from "../fund-from-evm";

const WALLET = "0x3329497026D984fc46a8b50c7794e24cab94924806abd38a27e223f7173dba6";
const BURN = "0x" + "ab".repeat(32);

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

describe("pending deposit", () => {
  const deposit: PendingDeposit = { burnTxHash: BURN, sourceDomain: 6, amountUsdc: "5", startedAt: 1_700_000_000_000 };

  it("remembers one deposit per wallet, whatever the address casing", () => {
    const store = memoryStore();
    savePendingDeposit(WALLET, deposit, store);
    expect(loadPendingDeposit(WALLET.toLowerCase(), store)).toEqual(deposit);
    expect(pendingDepositKey(WALLET)).toBe(pendingDepositKey(WALLET.toLowerCase()));
    clearPendingDeposit(WALLET, store);
    expect(loadPendingDeposit(WALLET, store)).toBeNull();
  });

  it("ignores a record that isn't a burn hash", () => {
    const store = memoryStore();
    store.setItem(pendingDepositKey(WALLET), JSON.stringify({ ...deposit, burnTxHash: "0x123" }));
    expect(loadPendingDeposit(WALLET, store)).toBeNull();
    store.setItem(pendingDepositKey(WALLET), "not json");
    expect(loadPendingDeposit(WALLET, store)).toBeNull();
    store.setItem(pendingDepositKey(WALLET), JSON.stringify({ burnTxHash: BURN }));
    expect(loadPendingDeposit(WALLET, store)).toBeNull();
  });

  it("reads nothing without storage (server render)", () => {
    expect(loadPendingDeposit(WALLET, null)).toBeNull();
    expect(readPendingDepositRaw(WALLET, null)).toBeNull();
    expect(pendingDepositHome(WALLET, null)).toBeNull();
    expect(parsePendingDeposit(null)).toBeNull();
  });

  it("keeps the burn hash in memory when storage is missing or throws, and says so", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(savePendingDeposit(WALLET, deposit, throwing)).toBe("memory");
    expect(loadPendingDeposit(WALLET, throwing)).toEqual(deposit);
    expect(pendingDepositHome(WALLET, throwing)).toBe("memory");
    clearPendingDeposit(WALLET, throwing);
    expect(loadPendingDeposit(WALLET, throwing)).toBeNull();

    expect(savePendingDeposit(WALLET, deposit, null)).toBe("memory");
    expect(loadPendingDeposit(WALLET, null)).toEqual(deposit);
    // Once storage works again, the record moves there and memory is dropped.
    const store = memoryStore();
    expect(savePendingDeposit(WALLET, deposit, store)).toBe("storage");
    expect(pendingDepositHome(WALLET, store)).toBe("storage");
    expect(loadPendingDeposit(WALLET, null)).toBeNull();
    clearPendingDeposit(WALLET, store);
  });

  it("hands useSyncExternalStore the stored string, so an unchanged record is the same snapshot", () => {
    const store = memoryStore();
    savePendingDeposit(WALLET, deposit, store);
    const raw = readPendingDepositRaw(WALLET, store);
    expect(raw).toBe(readPendingDepositRaw(WALLET, store));
    expect(parsePendingDeposit(raw)).toEqual(deposit);
  });
});

describe("depositStepLabel", () => {
  it("shows the SDK's estimate for the long steps and tells the user they can leave", () => {
    expect(depositStepLabel("attesting", "15 to 20 minutes")).toMatch(/15 to 20 minutes.*close this page/);
    expect(depositStepLabel("minting", "a minute or two")).toContain("a minute or two");
    expect(depositStepLabel("attesting", null)).toContain("a while");
  });

  it("names the wallet prompts", () => {
    expect(depositStepLabel("switching-chain", null)).toMatch(/Base/);
    expect(depositStepLabel("approving", null)).toMatch(/Approve/);
    expect(depositStepLabel("burning", null)).toMatch(/Confirm/);
    expect(depositStepLabel("done", null)).toMatch(/Arrived/);
    expect(depositStepLabel("something-new", null)).toBe("Working…");
  });
});

describe("describeStartedAt", () => {
  it("rounds to minutes, then hours", () => {
    const now = 10_000_000;
    expect(describeStartedAt(now - 10_000, now)).toBe("started just now");
    expect(describeStartedAt(now - 60_000, now)).toBe("started a minute ago");
    expect(describeStartedAt(now - 17 * 60_000, now)).toBe("started 17 minutes ago");
    expect(describeStartedAt(now - 3 * 3_600_000, now)).toBe("started 3 hours ago");
  });
});
