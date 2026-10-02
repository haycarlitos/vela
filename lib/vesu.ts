// Vesu USDC vault: call builders and the position read. The agent goes through
// the vault router (VESU_ROUTER), whose functions take no receiver.

import type { Call } from "starknet";
import { TOKENS, VESU_ROUTER, VESU_USDC_VAULT } from "./config";

function splitU256(value: bigint): [string, string] {
  const mask = (1n << 128n) - 1n;
  return ["0x" + (value & mask).toString(16), "0x" + (value >> 128n).toString(16)];
}

/** USDC.approve(router, assets) + router.deposit_to_self(assets): the shares go to the caller. */
export function vesuDepositCalls(assets: bigint): Call[] {
  const [low, high] = splitU256(assets);
  return [
    { contractAddress: TOKENS.USDC, entrypoint: "approve", calldata: [VESU_ROUTER, low, high] },
    { contractAddress: VESU_ROUTER, entrypoint: "deposit_to_self", calldata: [low, high] },
  ];
}

/**
 * vault.approve(router, shares) + router.withdraw_to_self(assets): the USDC goes
 * to the caller. `shares` is vesuSharesFor(assets); the approval is what the
 * vault-shares spending policy caps.
 */
export function vesuWithdrawCalls(assets: bigint, shares: bigint): Call[] {
  const [low, high] = splitU256(assets);
  const [sharesLow, sharesHigh] = splitU256(shares);
  return [
    { contractAddress: VESU_USDC_VAULT, entrypoint: "approve", calldata: [VESU_ROUTER, sharesLow, sharesHigh] },
    { contractAddress: VESU_ROUTER, entrypoint: "withdraw_to_self", calldata: [low, high] },
  ];
}

/**
 * Sessions hired before the router whitelist the vault's own deposit and
 * withdraw (and cap its shares at one unit). They keep these calls until the
 * owner hires again.
 */
export function legacyVesuDepositCalls(assets: bigint, receiver: string): Call[] {
  const [low, high] = splitU256(assets);
  return [
    { contractAddress: TOKENS.USDC, entrypoint: "approve", calldata: [VESU_USDC_VAULT, low, high] },
    { contractAddress: VESU_USDC_VAULT, entrypoint: "deposit", calldata: [low, high, receiver] },
  ];
}

export function legacyVesuWithdrawCalls(assets: bigint, wallet: string): Call[] {
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

/** Shares a withdrawal of `assets` burns (rounded up by the vault). */
export async function vesuSharesFor(callContract: CallContract, assets: bigint): Promise<bigint> {
  const [low, high] = splitU256(assets);
  return u256(await callContract({ contractAddress: VESU_USDC_VAULT, entrypoint: "preview_withdraw", calldata: [low, high] }));
}
