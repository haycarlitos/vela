import "server-only";
import { randomBytes } from "node:crypto";
import * as z from "zod";
import { APIError, createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import {
  createStarknetSignInTypedData,
  normalizeStarknetAddress,
  verifyStarknetSignIn,
  type StarknetCallProvider,
  type StarknetSignInFailure,
} from "@chipi-stack/backend";

/**
 * Sign in with Starknet: the user's existing wallet (Braavos, Ready, Bramble)
 * signs a SNIP-12 message with a one-time nonce, and the account itself says
 * whether the signature is valid (`verifyStarknetSignIn` from the Chipi SDK).
 *
 * The wallet is linked to the Vela account as a Better Auth account with
 * provider "starknet" and the address as its id. It is also where withdrawals
 * go. It never holds the agent's key: only a Chipi wallet can enforce the
 * agent's caps on-chain.
 */

export const STARKNET_PROVIDER_ID = "starknet";
const NONCE_PREFIX = "starknet:";
const NONCE_TTL_SECONDS = 600;

const address = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/);
const felt = z.string().regex(/^(0x[0-9a-fA-F]{1,64}|[0-9]{1,78})$/);

interface IssuedNonce {
  address: string;
  issuedAt: number;
  expirationTime: number;
}

export interface StarknetAuthOptions {
  /** Host the message names, e.g. "vela-starknet.vercel.app". */
  domain: string;
  /** App URL the message names, e.g. "https://vela-starknet.vercel.app". */
  uri: string;
  /** Mainnet RPC used to ask the account about the signature. */
  provider: StarknetCallProvider;
}

const FAILURE_MESSAGES: Partial<Record<StarknetSignInFailure, string>> = {
  ACCOUNT_NOT_DEPLOYED: "This wallet account isn't on Starknet yet. Make one transaction with it, then try again.",
  UNSUPPORTED_ACCOUNT_CLASS: "This wallet account isn't on Starknet yet. Make one transaction with it, then try again.",
  EXPIRED: "The sign-in request expired. Try again.",
  WRONG_CHAIN: "Switch your wallet to Starknet mainnet and try again.",
};

export function starknetAuth(options: StarknetAuthOptions) {
  return {
    id: "starknet",
    endpoints: {
      /** Issues a nonce for `address` and the typed data to sign. */
      getStarknetNonce: createAuthEndpoint(
        "/starknet/nonce",
        { method: "POST", body: z.object({ address }).strict() },
        async (ctx) => {
          const now = Math.floor(Date.now() / 1000);
          const nonce = randomBytes(16).toString("hex");
          const issued: IssuedNonce = {
            address: normalizeStarknetAddress(ctx.body.address),
            issuedAt: now,
            expirationTime: now + NONCE_TTL_SECONDS,
          };
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${NONCE_PREFIX}${nonce}`,
            value: JSON.stringify(issued),
            expiresAt: new Date(issued.expirationTime * 1000),
          });
          const typedData = createStarknetSignInTypedData({
            domain: options.domain,
            uri: options.uri,
            nonce,
            ...issued,
          });
          return ctx.json({ nonce, typedData });
        }
      ),

      /**
       * Checks the signature, then: links the wallet to the signed-in user, or
       * signs in the user it is linked to, or creates a user for it.
       */
      verifyStarknetSignIn: createAuthEndpoint(
        "/starknet/verify",
        {
          method: "POST",
          body: z
            .object({
              nonce: z.string().regex(/^[0-9a-f]{32}$/),
              signature: z.array(felt).min(1).max(16),
              deploymentData: z
                .object({ address, class_hash: felt, salt: felt, calldata: z.array(felt).max(16) })
                .optional(),
            })
            .strict(),
          requireRequest: true,
        },
        async (ctx) => {
          const { nonce, signature, deploymentData } = ctx.body;
          const stored = await ctx.context.internalAdapter.consumeVerificationValue(`${NONCE_PREFIX}${nonce}`);
          if (!stored || stored.expiresAt.getTime() <= Date.now()) {
            throw APIError.fromStatus("UNAUTHORIZED", { message: "The sign-in request expired. Try again." });
          }
          const issued = JSON.parse(stored.value) as IssuedNonce;
          const typedData = createStarknetSignInTypedData({
            domain: options.domain,
            uri: options.uri,
            nonce,
            ...issued,
          });

          const result = await verifyStarknetSignIn({
            typedData,
            signature,
            provider: options.provider,
            expected: { domain: options.domain, uri: options.uri, nonce },
            deploymentData,
          });
          if (!result.ok) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: FAILURE_MESSAGES[result.reason] ?? "The wallet signature didn't check out. Try again.",
              code: result.reason,
            });
          }

          const walletAddress = result.address;
          const linked = await ctx.context.internalAdapter.findAccountByKey({
            providerId: STARKNET_PROVIDER_ID,
            accountId: walletAddress,
          });
          const current = await getSessionFromCtx(ctx);

          if (current) {
            // Linking from an existing account (e.g. a passkey account).
            if (linked && linked.userId !== current.user.id) {
              throw APIError.fromStatus("CONFLICT", { message: "This wallet is linked to another Vela account." });
            }
            if (!linked) {
              const other = (await ctx.context.internalAdapter.findAccounts(current.user.id)).find(
                (a) => a.providerId === STARKNET_PROVIDER_ID
              );
              if (other) {
                throw APIError.fromStatus("CONFLICT", { message: "Your account already has a linked wallet." });
              }
              await ctx.context.internalAdapter.createAccount({
                userId: current.user.id,
                providerId: STARKNET_PROVIDER_ID,
                accountId: walletAddress,
              });
            }
            return ctx.json({ userId: current.user.id, address: walletAddress, created: false });
          }

          let user = linked ? await ctx.context.internalAdapter.findUserById(linked.userId) : null;
          const created = !user;
          if (!user) {
            user = await ctx.context.internalAdapter.createUser(
              // No email: a placeholder unique per wallet (64 hex fits an email local part).
              { name: "Starknet wallet", email: `${walletAddress.slice(2)}@starknet.vela.invalid`, image: "" },
              { method: "starknet" }
            );
            await ctx.context.internalAdapter.createAccount({
              userId: user.id,
              providerId: STARKNET_PROVIDER_ID,
              accountId: walletAddress,
            });
          }
          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) throw APIError.fromStatus("INTERNAL_SERVER_ERROR", { message: "Could not start a session" });
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ userId: user.id, address: walletAddress, created });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
}
