import { describe, it, expect } from "vitest";
import { encodePaymentHeader, parsePaymentHeader, paymentCall, paymentRequirements } from "../x402";
import { TOKENS } from "../config";

const proof = { transactionHash: "0x0abc", from: "0x0123" };

describe("X-PAYMENT header", () => {
  it("round-trips", () => {
    expect(parsePaymentHeader(encodePaymentHeader(proof))).toEqual(proof);
  });

  it.each([
    ["missing", null],
    ["not base64 JSON", "%%%"],
    ["too long", "a".repeat(5_000)],
    ["wrong version", Buffer.from(JSON.stringify({ x402Version: 2, scheme: "exact", network: "starknet-mainnet", payload: proof })).toString("base64")],
    ["wrong network", Buffer.from(JSON.stringify({ x402Version: 1, scheme: "exact", network: "starknet-sepolia", payload: proof })).toString("base64")],
    ["a non-hex hash", encodePaymentHeader({ ...proof, transactionHash: "abc" })],
    ["a non-hex payer", encodePaymentHeader({ ...proof, from: "0xzz" })],
  ])("rejects %s", (_label, header) => {
    expect(parsePaymentHeader(header)).toBeNull();
  });
});

describe("payment terms", () => {
  it("asks for $0.001 of native USDC to the treasury", () => {
    const body = paymentRequirements("0x7ea", "/api/think");
    expect(body.accepts[0]).toMatchObject({
      network: "starknet-mainnet",
      asset: TOKENS.USDC,
      payTo: "0x7ea",
      maxAmountRequired: "1000",
      resource: "/api/think",
    });
  });

  it("pays with a USDC transfer of 1000 base units", () => {
    expect(paymentCall("0x7ea")).toEqual({
      contractAddress: TOKENS.USDC,
      entrypoint: "transfer",
      calldata: ["0x7ea", "0x3e8", "0x0"],
    });
  });
});
