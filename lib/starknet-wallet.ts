"use client";

import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import { RpcProvider, constants, uint256 } from "starknet";
import { TOKENS } from "./config";

/**
 * The user's existing Starknet wallet (Braavos, Ready, Bramble, ...), used to
 * sign in, to fund the Vela wallet and as the place withdrawals go.
 *
 * Everything goes through the standard wallet API (`starknet:walletApi`),
 * written to pass Bramble's strict checks (the strictest wallet we target):
 * - explicit params, never `undefined` (a bare connect sends
 *   `silent_mode: undefined`, which Bramble rejects with 114);
 * - no `api_version` (only "0.10.4-rc.0" is accepted where it's checked);
 * - chain ids compared as numbers (Bramble answers hex, others "SN_MAIN");
 * - lowercase hex addresses (Bramble rejects checksummed ones);
 * - injected wallets can appear after the page loads, so discovery re-scans.
 */

type WalletApiRequest = (call: { type: string; params?: unknown }) => Promise<unknown>;

export interface DiscoveredWallet {
  name: string;
  icon: string;
  request: WalletApiRequest;
}

export interface ConnectedWallet extends DiscoveredWallet {
  /** 0x + 64 hex, lowercase. */
  address: string;
}

/** Starknet wallet error codes we explain to the user (SNIP / wallet API). */
const USER_REFUSED = 113;
const LOCKED_OR_NOT_CONNECTED = 163;

export class WalletError extends Error {
  constructor(
    message: string,
    readonly code?: number
  ) {
    super(message);
  }
}

function errorCode(err: unknown): number | undefined {
  const e = err as { code?: unknown; data?: { code?: unknown } } | null;
  const code = e?.code ?? e?.data?.code;
  return typeof code === "number" ? code : undefined;
}

/** Turns a wallet rejection into a sentence a person can act on. */
export function walletErrorMessage(err: unknown, walletName = "your wallet"): string {
  if (err instanceof WalletError) return err.message;
  switch (errorCode(err)) {
    case USER_REFUSED:
      return `You declined the request in ${walletName}.`;
    case LOCKED_OR_NOT_CONNECTED:
      return `Unlock ${walletName} and try again.`;
    default:
      return err instanceof Error && err.message ? err.message : `${walletName} couldn't complete the request.`;
  }
}

export function normalizeAddress(address: string): string {
  return `0x${BigInt(address).toString(16).padStart(64, "0")}`;
}

let store: Store | null = null;

/** Shared discovery store; re-scans when an injected wallet announces itself late. */
function walletStore(): Store {
  if (!store) {
    store = createStore();
    const rescan = () => store?._refreshInjectedWallets();
    for (const event of ["starknet#initialized", "bramble#initialized"]) window.addEventListener(event, rescan);
  }
  return store;
}

/** The wallets we name in the UI first; any other discovered wallet follows. */
const PREFERRED = ["Bramble", "Braavos", "Ready", "Argent"];

function rank(name: string): number {
  const i = PREFERRED.findIndex((p) => name.toLowerCase().startsWith(p.toLowerCase()));
  return i === -1 ? PREFERRED.length : i;
}

export function listWallets(): DiscoveredWallet[] {
  const s = walletStore();
  s._refreshInjectedWallets();
  return s
    .getWallets()
    .map((w) => ({
      name: w.name,
      icon: w.icon,
      request: ((call) => (w.features["starknet:walletApi"].request as WalletApiRequest)(call)) as WalletApiRequest,
    }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export function subscribeWallets(onChange: () => void): () => void {
  return walletStore().subscribe(onChange);
}

/** Asks the wallet for its account (opening its approval UI) and checks it is on mainnet. */
export async function connectWallet(wallet: DiscoveredWallet): Promise<ConnectedWallet> {
  const accounts = (await wallet.request({ type: "wallet_requestAccounts", params: { silent_mode: false } })) as string[];
  if (!accounts?.length) throw new WalletError(`Unlock ${wallet.name} and try again.`, LOCKED_OR_NOT_CONNECTED);
  const chainId = (await wallet.request({ type: "wallet_requestChainId" })) as string;
  if (!isMainnet(chainId)) throw new WalletError(`Switch ${wallet.name} to Starknet mainnet and try again.`);
  return { ...wallet, address: normalizeAddress(accounts[0]) };
}

export function isMainnet(chainId: string): boolean {
  try {
    return BigInt(chainId) === BigInt(constants.StarknetChainId.SN_MAIN);
  } catch {
    return chainId === "SN_MAIN";
  }
}

/** SNIP-12 signature as felts. */
export async function signTypedData(wallet: ConnectedWallet, typedData: unknown): Promise<string[]> {
  const signature = (await wallet.request({ type: "wallet_signTypedData", params: typedData })) as unknown[];
  if (!Array.isArray(signature) || signature.length === 0) throw new WalletError(`${wallet.name} returned no signature.`);
  return signature.map((s) => String(s));
}

export interface DeploymentData {
  address: string;
  class_hash: string;
  salt: string;
  calldata: string[];
}

/**
 * For an account that isn't deployed yet (new Bramble/Ready accounts), what it
 * will deploy as, so the server can check the signature off-chain. Wallets
 * refuse this for deployed accounts; that's fine, the server asks the account.
 */
export async function deploymentData(wallet: ConnectedWallet): Promise<DeploymentData | undefined> {
  try {
    const data = (await wallet.request({ type: "wallet_deploymentData" })) as Partial<DeploymentData> | null;
    if (!data?.class_hash || !data.address || !Array.isArray(data.calldata)) return undefined;
    return {
      address: String(data.address),
      class_hash: String(data.class_hash),
      salt: String(data.salt ?? "0x0"),
      calldata: data.calldata.map(String),
    };
  } catch {
    return undefined;
  }
}

const provider = new RpcProvider({
  nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "https://api.cartridge.gg/x/starknet/mainnet",
});

async function balanceOf(token: string, owner: string): Promise<bigint> {
  const [low, high] = await provider.callContract({
    contractAddress: token,
    entrypoint: "balance_of",
    calldata: [owner],
  });
  return uint256.uint256ToBN({ low, high });
}

/** USDC and STRK the external wallet holds publicly (STRK pays its network fees). */
export async function externalBalances(address: string): Promise<{ usdc: bigint; strk: bigint }> {
  const [usdc, strk] = await Promise.all([balanceOf(TOKENS.USDC, address), balanceOf(TOKENS.STRK, address)]);
  return { usdc, strk };
}

/** Below this the wallet likely can't pay fees (deploying a new account costs more than a transfer). */
export const MIN_STRK_FOR_FEES = 10n ** 17n; // 0.1 STRK

/**
 * Sends USDC from the external wallet to `to` and waits until it is accepted
 * on L2. The wallet shows the transfer and pays its own fees.
 */
export async function sendUsdc(wallet: ConnectedWallet, to: string, units: bigint): Promise<string> {
  const amount = uint256.bnToUint256(units);
  const result = (await wallet.request({
    type: "wallet_addInvokeTransaction",
    params: {
      calls: [
        {
          contract_address: normalizeAddress(TOKENS.USDC),
          entry_point: "transfer",
          calldata: [normalizeAddress(to), toHex(amount.low), toHex(amount.high)],
        },
      ],
    },
  })) as { transaction_hash?: string } | null;
  const hash = result?.transaction_hash;
  if (!hash) throw new WalletError(`${wallet.name} didn't send the transfer.`);
  await provider.waitForTransaction(hash);
  return hash;
}

/** Waits for a transaction the Vela wallet sent (e.g. a withdrawal). */
export async function waitForTx(hash: string): Promise<void> {
  await provider.waitForTransaction(hash);
}

function toHex(value: string | number | bigint): string {
  return `0x${BigInt(value).toString(16)}`;
}
