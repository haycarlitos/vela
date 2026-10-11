import { TOKEN_DECIMALS } from "./config";

/** "12.5" → 12_500_000n (USDC, 6 decimals). Null for anything that isn't a positive amount. */
export function parseUsdc(input: string): bigint | null {
  const value = input.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const decimals = TOKEN_DECIMALS.USDC;
  if (fraction.length > decimals) return null;
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  return units > 0n ? units : null;
}

/** 12_500_000n → "12.5" */
export function formatUsdc(units: bigint): string {
  const decimals = BigInt(TOKEN_DECIMALS.USDC);
  const scale = 10n ** decimals;
  const fraction = (units % scale).toString().padStart(Number(decimals), "0").replace(/0+$/, "");
  return fraction ? `${units / scale}.${fraction}` : `${units / scale}`;
}

/** Whole-cent floor of a dollar amount, in USDC base units (never negative). */
export function usdToUsdcUnits(usd: number): bigint {
  if (!(usd > 0)) return 0n;
  return BigInt(Math.floor(usd * 100)) * 10n ** BigInt(TOKEN_DECIMALS.USDC - 2);
}

export type AmountCheck = { ok: true; units: bigint } | { ok: false; message: string };

/**
 * Checks a deposit typed by the user: a positive USDC amount, no more than the
 * external wallet holds, and no more than the room left under the deposit cap
 * (MAX_DEPOSIT_USD while the wallet contract's audit is pending).
 */
export function checkDeposit(input: string, opts: { walletUsdc: bigint; roomUsd: number }): AmountCheck {
  const units = parseUsdc(input);
  if (units === null) return { ok: false, message: "Enter an amount in USDC, like 10 or 2.5." };
  if (units > opts.walletUsdc) return { ok: false, message: `Your wallet has ${formatUsdc(opts.walletUsdc)} USDC.` };
  const room = usdToUsdcUnits(opts.roomUsd);
  if (units > room) {
    return {
      ok: false,
      message: room > 0n ? `You can add up to ${formatUsdc(room)} USDC while Vela is in beta.` : "Your wallet is at the beta deposit cap.",
    };
  }
  return { ok: true, units };
}

/** Checks a withdrawal: a positive amount, no more than the liquid USDC in the Vela wallet. */
export function checkWithdrawal(input: string, opts: { liquidUsdc: bigint }): AmountCheck {
  const units = parseUsdc(input);
  if (units === null) return { ok: false, message: "Enter an amount in USDC, like 10 or 2.5." };
  if (units > opts.liquidUsdc) {
    return { ok: false, message: `You can withdraw up to ${formatUsdc(opts.liquidUsdc)} USDC right now.` };
  }
  return { ok: true, units };
}
