/**
 * Where the app runs: the one origin passkeys, Sign in with Starknet and
 * Better Auth are bound to. Chipi checks tokens against
 * `${appUrl()}/api/auth/jwks`. No imports, so the proxy and the layout can use
 * it without pulling in the database.
 */
export function appUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
