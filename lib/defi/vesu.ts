import { CallData, uint256 } from "starknet";
import { USDC_ADDRESS, VESU_USDC_VTOKEN, TOKEN_DECIMALS } from "@/lib/config";

// Build Vesu supply calls: approve USDC → deposit to vToken
export function buildVesuSupplyCalls(
  amount: bigint,
  walletAddress: string,
): { contractAddress: string; entrypoint: string; calldata: string[] }[] {
  const amountU256 = uint256.bnToUint256(amount);

  return [
    // 1. Approve vToken contract to spend USDC
    {
      contractAddress: USDC_ADDRESS,
      entrypoint: "approve",
      calldata: CallData.compile({
        spender: VESU_USDC_VTOKEN,
        amount: amountU256,
      }),
    },
    // 2. Deposit USDC into Vesu pool
    {
      contractAddress: VESU_USDC_VTOKEN,
      entrypoint: "deposit",
      calldata: CallData.compile({
        assets: amountU256,
        receiver: walletAddress,
      }),
    },
  ];
}

// Build Vesu withdraw calls: withdraw from vToken
export function buildVesuWithdrawCalls(
  amount: bigint,
  walletAddress: string,
): { contractAddress: string; entrypoint: string; calldata: string[] }[] {
  const amountU256 = uint256.bnToUint256(amount);

  return [
    {
      contractAddress: VESU_USDC_VTOKEN,
      entrypoint: "redeem",
      calldata: CallData.compile({
        shares: amountU256,
        receiver: walletAddress,
        owner: walletAddress,
      }),
    },
  ];
}

// Helper: convert human USDC amount to raw
export function usdcToRaw(amount: number): bigint {
  return BigInt(Math.floor(amount * 10 ** TOKEN_DECIMALS.USDC));
}

// Prepare Vesu supply (validates and returns calls)
export function prepareVesuSupply(
  amountUsd: number,
  walletAddress: string,
): { calls: { contractAddress: string; entrypoint: string; calldata: string[] }[] } {
  const raw = usdcToRaw(amountUsd);
  const calls = buildVesuSupplyCalls(raw, walletAddress);
  return { calls };
}

// Prepare Vesu withdraw
export function prepareVesuWithdraw(
  amountUsd: number,
  walletAddress: string,
): { calls: { contractAddress: string; entrypoint: string; calldata: string[] }[] } {
  const raw = usdcToRaw(amountUsd);
  const calls = buildVesuWithdrawCalls(raw, walletAddress);
  return { calls };
}
