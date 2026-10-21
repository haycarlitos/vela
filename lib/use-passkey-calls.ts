"use client";

import { useCallback } from "react";
import { waitForTransaction } from "@chipi-stack/backend";
import { getWalletEncryptKey, useCallAnyContract, type ChipiWalletData } from "@chipi-stack/nextjs";
import { getChipiToken } from "@/lib/auth-client";

type Calls = Parameters<ReturnType<typeof useCallAnyContract>["callAnyContractAsync"]>[0]["params"]["calls"];

/**
 * Signs wallet calls with the passkey (owner 0): one prompt, then the chain
 * must accept them. Returns the transaction hash once it succeeded.
 */
export function usePasskeyCalls(wallet: ChipiWalletData | null) {
  const { callAnyContractAsync } = useCallAnyContract();

  return useCallback(
    async (calls: Calls, onStatus: (status: string) => void = () => {}) => {
      if (!wallet) throw new Error("Your Vela wallet isn't loaded yet.");
      onStatus("Confirm with your passkey…");
      const encryptKey = await getWalletEncryptKey(wallet.credentialId ?? undefined, {
        prfSupported: wallet.prfSupported ?? undefined,
      });
      if (!encryptKey) throw new Error("Passkey confirmation was cancelled.");
      const bearerToken = await getChipiToken();
      if (!bearerToken) throw new Error("Your session expired. Sign in again.");
      const txHash = await callAnyContractAsync({
        params: { encryptKey, wallet, contractAddress: wallet.publicKey, calls },
        bearerToken,
      });
      onStatus("Sent. Waiting for Starknet…");
      // A hash is not a result.
      const receipt = await waitForTransaction(txHash);
      if (!receipt.success) throw new Error(`The wallet refused it: ${receipt.revertReason ?? "unknown reason"}`);
      return txHash;
    },
    [wallet, callAnyContractAsync]
  );
}
