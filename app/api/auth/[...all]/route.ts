import { getAuth } from "@/lib/auth";

// Better Auth: sign-in, passkeys, /api/auth/token (the JWT for Chipi) and /api/auth/jwks.
const handler = async (req: Request) => (await getAuth()).handler(req);

export { handler as GET, handler as POST };
