import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@starknet-io/get-starknet-discovery", () => ({ createStore: vi.fn() }));
const { waitForTransaction } = vi.hoisted(() => ({ waitForTransaction: vi.fn() }));
vi.mock("starknet", async (orig) => {
  const actual = await orig<typeof import("starknet")>();
  class RpcProvider {
    waitForTransaction = waitForTransaction;
    callContract = vi.fn();
  }
  return { ...actual, RpcProvider };
});

import {
  connectWallet,
  deploymentData,
  isMainnet,
  sendUsdc,
  signTypedData,
  walletErrorMessage,
  type ConnectedWallet,
  type DiscoveredWallet,
} from "../starknet-wallet";

/**
 * A wallet as strict as Bramble 0.10.5: any undefined value or api_version in
 * params is error 114, the chain id comes back as hex, addresses unpadded,
 * contract addresses must be lowercase, a locked wallet answers 163.
 */
function strictWallet(overrides: Partial<Record<string, (params: unknown) => unknown>> = {}) {
  const calls: Array<{ type: string; params?: unknown }> = [];
  const hasUndefined = (v: unknown): boolean =>
    v === undefined || (typeof v === "object" && v !== null && Object.values(v).some(hasUndefined));
  const handlers: Record<string, (params: unknown) => unknown> = {
    wallet_requestAccounts: () => ["0x1a2b"],
    wallet_requestChainId: () => "0x534e5f4d41494e",
    wallet_signTypedData: () => ["0x1", "0x2"],
    wallet_deploymentData: () => ({ address: "0x1a2b", class_hash: "0xc1a55", salt: "0x0", calldata: ["0x5"], version: 1 }),
    wallet_addInvokeTransaction: () => ({ transaction_hash: "0xabc" }),
    ...overrides,
  };
  const request = vi.fn(async (call: { type: string; params?: unknown }) => {
    calls.push(call);
    if (Object.keys(call).some((k) => k !== "type" && k !== "params") || hasUndefined(call.params ?? {})) {
      throw Object.assign(new Error("invalid payload"), { code: 114 });
    }
    if (JSON.stringify(call.params ?? {}).includes("api_version")) throw Object.assign(new Error("api"), { code: 162 });
    const handler = handlers[call.type];
    if (!handler) throw Object.assign(new Error("unsupported"), { code: 163 });
    return handler(call.params);
  });
  const wallet: DiscoveredWallet = { name: "Bramble", icon: "data:,", request };
  return { wallet, calls, request };
}

beforeEach(() => waitForTransaction.mockReset());

describe("connectWallet", () => {
  it("passes Bramble's strict checks and pads the address", async () => {
    const { wallet, calls } = strictWallet();
    const connected = await connectWallet(wallet);
    expect(connected.address).toBe(`0x${"0".repeat(60)}1a2b`);
    expect(calls[0]).toEqual({ type: "wallet_requestAccounts", params: { silent_mode: false } });
  });

  it("refuses another network", async () => {
    const { wallet } = strictWallet({ wallet_requestChainId: () => "0x534e5f5345504f4c4941" });
    await expect(connectWallet(wallet)).rejects.toThrow(/mainnet/);
  });

  it("explains a locked wallet", async () => {
    const { wallet } = strictWallet({
      wallet_requestAccounts: () => {
        throw Object.assign(new Error("locked"), { code: 163 });
      },
    });
    await expect(connectWallet(wallet)).rejects.toMatchObject({ code: 163 });
    expect(walletErrorMessage({ code: 163 }, "Bramble")).toBe("Unlock Bramble and try again.");
    expect(walletErrorMessage({ code: 113 }, "Bramble")).toBe("You declined the request in Bramble.");
  });
});

describe("isMainnet", () => {
  it("accepts mainnet as hex or short string", () => {
    expect(isMainnet("0x534e5f4d41494e")).toBe(true);
    expect(isMainnet("SN_MAIN")).toBe(true);
    expect(isMainnet("0x534e5f5345504f4c4941")).toBe(false);
  });
});

describe("signing and deployment data", () => {
  const connected = (w: DiscoveredWallet): ConnectedWallet => ({ ...w, address: "0x1a2b" });

  it("returns the signature as strings (Argent's decimal prefix included)", async () => {
    const { wallet } = strictWallet({ wallet_signTypedData: () => [1, "0", "0x5", "0x6", "0x7"] });
    expect(await signTypedData(connected(wallet), { types: {} })).toEqual(["1", "0", "0x5", "0x6", "0x7"]);
  });

  it("returns deployment data for an undeployed account, and nothing when the wallet refuses", async () => {
    const { wallet } = strictWallet();
    expect(await deploymentData(connected(wallet))).toEqual({ address: "0x1a2b", class_hash: "0xc1a55", salt: "0x0", calldata: ["0x5"] });
    const deployedWallet = strictWallet({
      wallet_deploymentData: () => {
        throw Object.assign(new Error("already deployed"), { code: 115 });
      },
    }).wallet;
    expect(await deploymentData(connected(deployedWallet))).toBeUndefined();
  });
});

describe("sendUsdc", () => {
  it("sends one lowercase USDC transfer as u256 and waits for it", async () => {
    const { wallet, calls } = strictWallet();
    const hash = await sendUsdc({ ...wallet, address: "0x1a2b" }, "0xABC", 2_500_000n);
    expect(hash).toBe("0xabc");
    const invoke = calls.find((c) => c.type === "wallet_addInvokeTransaction")!;
    expect(invoke.params).toEqual({
      calls: [
        {
          contract_address: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
          entry_point: "transfer",
          calldata: [`0x${"0".repeat(61)}abc`, "0x2625a0", "0x0"],
        },
      ],
    });
    expect(waitForTransaction).toHaveBeenCalledWith("0xabc");
  });
});
