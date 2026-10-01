import "server-only";
import { headers } from "next/headers";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { anonymous, jwt } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { derivedSecret } from "./chipi";
import { pool } from "./db";

/**
 * Where the app runs. Passkeys are bound to this hostname, and Chipi checks
 * the tokens against `${appUrl()}/api/auth/jwks`.
 */
export function appUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

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
