// Session management — wraps @chipi-stack backend SDK for session key operations
// Session keys are created/managed client-side via useChipiSession hook
// Server-side: executes transactions using session keys via Chipi paymaster

export interface SessionConfig {
  durationSeconds: number;
  maxCalls: number;
  allowedEntrypoints: string[];
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  durationSeconds: 604800, // 7 days
  maxCalls: 500,
  allowedEntrypoints: [
    "transfer",
    "approve",
    "deposit",
    "withdraw",
    "redeem",
    // AVNU swap entrypoints are handled by the AVNU contract
  ],
};

export interface ExecutionCall {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

// Session key data (stored encrypted in user metadata)
export interface SessionKeyData {
  publicKey: string;
  encryptedPrivateKey: string;
  validUntil: number; // Unix timestamp (seconds)
}

// Session status from on-chain contract
export interface SessionDataResponse {
  isActive: boolean;
  validUntil: number;
  remainingCalls: number;
  allowedEntrypoints: string[];
}

const CHIPI_API_BASE = "https://api.chipipay.com";

// Execute a transaction using a session key via the Chipi backend
// Uses the paymaster for gasless execution with session signature format:
// [sessionPublicKey, r, s, validUntil]
export async function executeWithSession(
  calls: ExecutionCall[],
  options: {
    walletAddress: string;
    sessionToken: string; // Bearer token (JWT from auth provider)
  },
): Promise<{ txHash: string }> {
  const apiKey = process.env.CHIPI_SECRET_KEY;
  if (!apiKey) {
    throw new Error("CHIPI_SECRET_KEY not configured");
  }

  // Step 1: Prepare typed data for signing
  const prepareResponse = await fetch(`${CHIPI_API_BASE}/v1/transactions/prepare-typed-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.sessionToken}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      walletAddress: options.walletAddress,
      calls: calls.map((c) => ({
        contractAddress: c.contractAddress,
        entrypoint: c.entrypoint,
        calldata: c.calldata,
      })),
    }),
  });

  if (!prepareResponse.ok) {
    const error = await prepareResponse.text();
    throw new Error(`Prepare typed data failed: ${prepareResponse.status} ${error}`);
  }

  const prepareData = await prepareResponse.json();

  // Step 2: Execute the sponsored transaction
  // The session signature is passed along with isSessionSignature: true
  const executeResponse = await fetch(`${CHIPI_API_BASE}/v1/transactions/execute-sponsored-transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.sessionToken}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      walletAddress: options.walletAddress,
      typedData: prepareData.typedData,
      signature: prepareData.signature, // Session signature: [pubKey, r, s, validUntil]
      isSessionSignature: true,
    }),
  });

  if (!executeResponse.ok) {
    const error = await executeResponse.text();
    throw new Error(`Execute transaction failed: ${executeResponse.status} ${error}`);
  }

  const executeData = await executeResponse.json();
  return { txHash: executeData.txHash ?? executeData.transaction_hash };
}
