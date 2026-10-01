import "server-only";
import { hkdfSync } from "node:crypto";
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
 * Encrypts every agent's session key at rest. Derived from CHIPI_SECRET_KEY so
 * a deploy needs no extra secret; set VELA_SESSION_SECRET to decouple the two.
 * Changing whichever one is in use orphans the stored sessions: users re-hire
 * their agent.
 */
export function sessionSecret(): string {
  const secret = process.env.VELA_SESSION_SECRET;
  if (!secret) return derivedSecret("session-key-encryption");
  if (secret.length < 32) throw new Error("VELA_SESSION_SECRET must be at least 32 characters");
  return secret;
}

/** A 32-byte key (hex) for one purpose, derived from CHIPI_SECRET_KEY with HKDF. */
export function derivedSecret(purpose: string): string {
  return Buffer.from(hkdfSync("sha256", required("CHIPI_SECRET_KEY"), "vela", purpose, 32)).toString("hex");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
