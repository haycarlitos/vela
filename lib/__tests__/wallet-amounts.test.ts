import { describe, it, expect } from "vitest";
import { checkDeposit, checkWithdrawal, formatUsdc, parseUsdc, usdToUsdcUnits } from "../wallet-amounts";

describe("USDC amounts", () => {
  it("parses and formats with 6 decimals", () => {
    expect(parseUsdc("12.5")).toBe(12_500_000n);
    expect(parseUsdc(" 1 ")).toBe(1_000_000n);
    expect(parseUsdc("0.000001")).toBe(1n);
    expect(formatUsdc(12_500_000n)).toBe("12.5");
    expect(formatUsdc(1_000_000n)).toBe("1");
    expect(formatUsdc(1n)).toBe("0.000001");
  });

  it("refuses what isn't a positive amount", () => {
    for (const bad of ["", "0", "0.0", "-1", "1e3", "1,5", "abc", "0.0000001"]) expect(parseUsdc(bad)).toBeNull();
  });

  it("floors dollars to whole cents", () => {
    expect(usdToUsdcUnits(99.999)).toBe(99_990_000n);
    expect(usdToUsdcUnits(-5)).toBe(0n);
  });
});

describe("checkDeposit", () => {
  const wallet = { walletUsdc: 50_000_000n, roomUsd: 20 };

  it("accepts an amount within the wallet balance and the beta cap", () => {
    expect(checkDeposit("10", wallet)).toEqual({ ok: true, units: 10_000_000n });
  });

  it("refuses more than the wallet holds or the cap allows", () => {
    expect(checkDeposit("60", { ...wallet, roomUsd: 100 })).toMatchObject({ ok: false, message: expect.stringMatching(/has 50 USDC/) });
    expect(checkDeposit("25", wallet)).toMatchObject({ ok: false, message: expect.stringMatching(/up to 20 USDC/) });
    expect(checkDeposit("1", { ...wallet, roomUsd: 0 })).toMatchObject({ ok: false, message: expect.stringMatching(/deposit cap/) });
  });
});

describe("checkWithdrawal", () => {
  it("allows up to the liquid USDC only", () => {
    expect(checkWithdrawal("5", { liquidUsdc: 5_000_000n })).toEqual({ ok: true, units: 5_000_000n });
    expect(checkWithdrawal("5.01", { liquidUsdc: 5_000_000n })).toMatchObject({ ok: false });
  });
});
