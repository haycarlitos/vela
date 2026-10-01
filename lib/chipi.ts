import "server-only";
import { ChipiServerSDK } from "@chipi-stack/backend";

// Server-only. The secret key never reaches the browser.
let sdk: ChipiServerSDK | null = null;

export function chipi(): ChipiServerSDK {
  sdk ??= new ChipiServerSDK({
    apiPublicKey: required("NEXT_PUBLIC_CHIPI_API_KEY"),
    apiSecretKey: required("CHIPI_SECRET_KEY"),
  });
  return sdk;
}

/**
 * Encrypts every agent's session key at rest. Rotating it orphans the stored
 * sessions: users re-hire their agent.
 */
export function sessionSecret(): string {
  const secret = required("VELA_SESSION_SECRET");
  if (secret.length < 32) throw new Error("VELA_SESSION_SECRET must be at least 32 characters");
  return secret;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
