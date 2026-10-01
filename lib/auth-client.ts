"use client";

import { createAuthClient } from "better-auth/react";
import { anonymousClient, jwtClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({ plugins: [anonymousClient(), passkeyClient(), jwtClient()] });

/** A fresh JWT for Chipi's API. Fetch it right before the call: it lasts 15 minutes. */
export async function getChipiToken(): Promise<string | null> {
  const { data } = await authClient.$fetch<{ token: string }>("/token");
  return data?.token ?? null;
}
