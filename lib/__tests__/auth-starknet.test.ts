import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous } from "better-auth/plugins";
import { ec, hash, num, typedData as starknetTypedData, type TypedData } from "starknet";
import { COUNTERFACTUAL_ACCOUNT_CLASSES } from "@chipi-stack/backend";
import { starknetAuth } from "../auth-starknet";

// A Bramble-style OpenZeppelin account: key, counterfactual address, deployment data.
function account(seed: number) {
  const privateKey = num.toHex(BigInt(seed) * 104729n + 7n);
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const calldata = [publicKey];
  const address = hash.calculateContractAddressFromHash("0x0", COUNTERFACTUAL_ACCOUNT_CLASSES.OPENZEPPELIN_V3, calldata, 0);
  return {
    address: `0x${BigInt(address).toString(16).padStart(64, "0")}`,
    deploymentData: { address, class_hash: COUNTERFACTUAL_ACCOUNT_CLASSES.OPENZEPPELIN_V3, salt: "0x0", calldata },
    sign(td: TypedData) {
      const h = starknetTypedData.getMessageHash(td, address);
      const s = ec.starkCurve.sign(h, privateKey);
      return [num.toHex(s.r), num.toHex(s.s)];
    },
  };
}

let deployed: Set<string>;
const provider = {
  callContract: vi.fn(async (call: { contractAddress: string }) => {
    if (!deployed.has(call.contractAddress)) throw Object.assign(new Error("Contract not found"), { baseError: { code: 20 } });
    return ["0x56414c4944"];
  }),
};

function makeAuth() {
  return betterAuth({
    baseURL: "https://vela.test",
    secret: "test-secret-test-secret-test-secret",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    plugins: [anonymous(), starknetAuth({ domain: "vela.test", uri: "https://vela.test", provider })],
  });
}

type Auth = ReturnType<typeof makeAuth>;

async function nonceFor(auth: Auth, address: string) {
  return (await auth.api.getStarknetNonce({ body: { address } })) as { nonce: string; typedData: TypedData };
}

async function verify(auth: Auth, body: Record<string, unknown>, headers = new Headers()) {
  headers.set("content-type", "application/json");
  headers.set("origin", "https://vela.test");
  const res = await auth.handler(
    new Request("https://vela.test/api/auth/starknet/verify", { method: "POST", headers, body: JSON.stringify(body) })
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, cookie: res.headers.get("set-cookie") };
}

beforeEach(() => {
  deployed = new Set();
  provider.callContract.mockClear();
});

describe("Sign in with Starknet", () => {
  it("creates an account for a new, undeployed wallet (Bramble) and starts a session", async () => {
    const auth = makeAuth();
    const acct = account(1);
    const { nonce, typedData } = await nonceFor(auth, acct.address);
    expect(typedData.domain).toMatchObject({ chainId: "SN_MAIN", revision: "1" });

    const res = await verify(auth, { nonce, signature: acct.sign(typedData), deploymentData: acct.deploymentData });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ address: acct.address, created: true });
    expect(res.cookie).toMatch(/session_token/);
  });

  it("signs the same wallet back in to the same account (deployed by now)", async () => {
    const auth = makeAuth();
    const acct = account(2);
    const first = await nonceFor(auth, acct.address);
    const created = await verify(auth, { nonce: first.nonce, signature: acct.sign(first.typedData), deploymentData: acct.deploymentData });

    deployed.add(acct.address);
    const again = await nonceFor(auth, acct.address);
    const res = await verify(auth, { nonce: again.nonce, signature: acct.sign(again.typedData) });
    expect(res.json).toMatchObject({ userId: created.json.userId, created: false });
  });

  it("never accepts a nonce twice", async () => {
    const auth = makeAuth();
    const acct = account(3);
    deployed.add(acct.address);
    const { nonce, typedData } = await nonceFor(auth, acct.address);
    const body = { nonce, signature: acct.sign(typedData) };
    expect((await verify(auth, body)).status).toBe(200);
    expect((await verify(auth, body)).status).toBe(401);
  });

  it("refuses a signature from another key", async () => {
    const auth = makeAuth();
    const acct = account(4);
    const other = account(5);
    const { nonce, typedData } = await nonceFor(auth, acct.address);
    const res = await verify(auth, { nonce, signature: other.sign(typedData), deploymentData: acct.deploymentData });
    expect(res.status).toBe(401);
  });

  it("asks an undeployed wallet without deployment data to make a transaction first", async () => {
    const auth = makeAuth();
    const acct = account(6);
    const { nonce, typedData } = await nonceFor(auth, acct.address);
    const res = await verify(auth, { nonce, signature: acct.sign(typedData) });
    expect(res.status).toBe(401);
    expect(String(res.json.message)).toMatch(/isn't on Starknet yet/);
  });

  it("links a wallet to the signed-in account, and refuses one linked elsewhere", async () => {
    const auth = makeAuth();
    const anon = await auth.api.signInAnonymous({ asResponse: true });
    const cookie = anon.headers.get("set-cookie")!.split(";")[0];
    const headers = new Headers({ cookie });
    const anonUser = (await anon.json()) as { user: { id: string } };

    const mine = account(7);
    const n1 = await nonceFor(auth, mine.address);
    const linked = await verify(auth, { nonce: n1.nonce, signature: mine.sign(n1.typedData), deploymentData: mine.deploymentData }, headers);
    expect(linked.json).toMatchObject({ userId: anonUser.user.id, created: false });

    // A second wallet for the same account is refused (one withdrawal destination).
    const second = account(8);
    const n2 = await nonceFor(auth, second.address);
    const res2 = await verify(auth, { nonce: n2.nonce, signature: second.sign(n2.typedData), deploymentData: second.deploymentData }, headers);
    expect(res2.status).toBe(409);

    // A wallet that already belongs to another account is refused too.
    const theirs = account(9);
    const n3 = await nonceFor(auth, theirs.address);
    await verify(auth, { nonce: n3.nonce, signature: theirs.sign(n3.typedData), deploymentData: theirs.deploymentData });
    const other = await auth.api.signInAnonymous({ asResponse: true });
    const otherHeaders = new Headers({ cookie: other.headers.get("set-cookie")!.split(";")[0] });
    const n4 = await nonceFor(auth, theirs.address);
    const res4 = await verify(auth, { nonce: n4.nonce, signature: theirs.sign(n4.typedData), deploymentData: theirs.deploymentData }, otherHeaders);
    expect(res4.status).toBe(409);
  });

  it("rejects malformed input before touching the chain", async () => {
    const auth = makeAuth();
    await expect(auth.api.getStarknetNonce({ body: { address: "not-an-address" } })).rejects.toThrow();
    const res = await verify(auth, { nonce: "../../etc", signature: ["0x1"] });
    expect(res.status).toBe(400);
    expect(provider.callContract).not.toHaveBeenCalled();
  });
});
