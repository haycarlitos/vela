"use client";

import { createAuthClient } from "better-auth/react";
import { anonymousClient, jwtClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import type { BetterAuthClientPlugin } from "better-auth/client";

/** Client side of lib/auth-starknet.ts: both endpoints are POST. */
const starknetClient = () =>
  ({
    id: "starknet",
    pathMethods: { "/starknet/nonce": "POST", "/starknet/verify": "POST" },
  }) satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({ plugins: [anonymousClient(), passkeyClient(), jwtClient(), starknetClient()] });

/** A fresh JWT for Chipi's API. Fetch it right before the call: it lasts 15 minutes. */
export async function getChipiToken(): Promise<string | null> {
  const { data } = await authClient.$fetch<{ token: string }>("/token");
  return data?.token ?? null;
}
