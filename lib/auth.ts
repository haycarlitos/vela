import "server-only";
import { headers } from "next/headers";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { anonymous, jwt } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { STARKNET_PROVIDER_ID, starknetAuth } from "./auth-starknet";
import { derivedSecret } from "./chipi";
import { pool } from "./db";
import { callContract } from "./portfolio";

import { appUrl } from "./app-url";

export { appUrl };

function options() {
  return {
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET ?? derivedSecret("better-auth"),
    database: pool,
    plugins: [
      // Sign-up has no email or password: an anonymous account gets a passkey
      // right away, and the passkey is how you sign in from then on.
      // Never delete it on a later sign-in: the account owns a wallet.
      anonymous({ disableDeleteAnonymousUser: true }),
      passkey({ rpID: new URL(appUrl()).hostname, rpName: "Vela", origin: appUrl() }),
      // Chipi accepts our users through this JWT. Its Better Auth validator
      // takes RS256 and a JWKS with a single key, so no rotation.
      jwt({ jwks: { keyPairConfig: { alg: "RS256" as const, modulusLength: 2048 } }, jwt: { expirationTime: "15m" } }),
      // Or sign in with an existing Starknet wallet (Braavos, Ready, Bramble):
      // a SNIP-12 message checked by the account itself. Also links a wallet
      // to a passkey account, as the place withdrawals go.
      starknetAuth({ domain: new URL(appUrl()).host, uri: appUrl(), provider: { callContract } }),
      nextCookies(),
    ],
  } satisfies BetterAuthOptions;
}

let ready: Promise<ReturnType<typeof betterAuth<ReturnType<typeof options>>>> | null = null;

/**
 * Created on first use (the secret is not there at build time), after its
 * tables: Better Auth's migrations are idempotent, like lib/db.ts's schema.
 */
export function getAuth() {
  ready ??= (async () => {
    const config = options();
    await (await getMigrations(config)).runMigrations();
    return betterAuth(config);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** The signed-in user's id, or null. Chipi knows the user by this id (`sub` in the JWT). */
export async function currentUserId(): Promise<string | null> {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

/**
 * The Starknet wallet linked to this user (signed in with, or linked from the
 * dashboard): where withdrawals go. 0x + 64 hex, or null.
 */
export async function linkedWallet(userId: string): Promise<string | null> {
  const ctx = await (await getAuth()).$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  return accounts.find((a) => a.providerId === STARKNET_PROVIDER_ID)?.accountId ?? null;
}
