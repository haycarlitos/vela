// Vesu USDC vault: call builders and the position read. Ported from walletv2
// (lib/chipi/vesu.ts), USDC only.

import type { Call } from "starknet";
import { TOKENS, VESU_USDC_VAULT } from "./config";

function splitU256(value: bigint): [string, string] {
  const mask = (1n << 128n) - 1n;
  return ["0x" + (value & mask).toString(16), "0x" + (value >> 128n).toString(16)];
}

/** approve(vault, assets) + deposit(assets, receiver). */
export function vesuDepositCalls(assets: bigint, receiver: string): Call[] {
  const [low, high] = splitU256(assets);
  return [
    { contractAddress: TOKENS.USDC, entrypoint: "approve", calldata: [VESU_USDC_VAULT, low, high] },
    { contractAddress: VESU_USDC_VAULT, entrypoint: "deposit", calldata: [low, high, receiver] },
  ];
}

/** withdraw(assets, receiver, owner): burns the owner's own shares, no approval. */
export function vesuWithdrawCalls(assets: bigint, wallet: string): Call[] {
  const [low, high] = splitU256(assets);
  return [{ contractAddress: VESU_USDC_VAULT, entrypoint: "withdraw", calldata: [low, high, wallet, wallet] }];
}

type CallContract = (call: { contractAddress: string; entrypoint: string; calldata: string[] }) => Promise<string[]>;

function u256(res: string[]): bigint {
  return (BigInt(res[1] ?? "0x0") << 128n) + BigInt(res[0] ?? "0x0");
}

/** USDC the wallet could withdraw from the vault right now, in base units. */
export async function vesuMaxWithdraw(callContract: CallContract, owner: string): Promise<bigint> {
  return u256(await callContract({ contractAddress: VESU_USDC_VAULT, entrypoint: "max_withdraw", calldata: [owner] }));
}
