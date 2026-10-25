"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CrossChainDepositError, useCctpDepositStatus, useCrossChainDeposit } from "@chipi-stack/nextjs";
import {
  cctpEvmChainByKey,
  discoverEvmWallets,
  encodeEvmBalanceOf,
  formatCctpEta,
  type CctpFinality,
  type CctpQuote,
  type EvmWalletDetail,
} from "@chipi-stack/backend";
import { getChipiToken } from "@/lib/auth-client";
import { BASE_RPC_URL, EVM_DEPOSIT_CHAIN_KEY } from "@/lib/config";
import {
  clearPendingDeposit,
  depositStepLabel,
  describeStartedAt,
  parsePendingDeposit,
  pendingDepositHome,
  readPendingDepositRaw,
  savePendingDeposit,
  subscribePendingDeposit,
} from "@/lib/fund-from-evm";
import { checkDeposit, formatUsdc } from "@/lib/wallet-amounts";

interface Props {
  /** The Vela wallet that receives the USDC: the only possible recipient. */
  to: string;
  /** Room left under the beta deposit cap, in dollars. */
  roomUsd: number;
  onDeposited: () => void;
}

const BASE = cctpEvmChainByKey(EVM_DEPOSIT_CHAIN_KEY)!;

/** The account's USDC on Base, read from a public RPC so it works whatever chain the wallet is on. */
async function baseUsdcBalance(account: string): Promise<bigint> {
  const res = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: BASE.usdc, data: encodeEvmBalanceOf(account) }, "latest"],
    }),
  });
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error || !json.result) throw new Error(json.error?.message ?? "Could not read your Base balance");
  return BigInt(json.result);
}

/**
 * Funds the Vela wallet from USDC the user holds on Base, through Circle's
 * CCTP: their EVM wallet burns on Base, Chipi mints on Starknet. The
 * recipient is always this wallet (the SDK checks the encoded value before
 * anything is signed). The user picks the speed after seeing both prices:
 * standard is free and takes the time Circle's finality takes; fast costs
 * Circle's fee, taken from the amount. Chipi pays the Starknet side.
 *
 * Once the burn is registered, the deposit completes even if the page closes:
 * the burn hash is kept in localStorage and followed on the next visit.
 */
export function FundFromEvm({ to, roomUsd, onDeposited }: Props) {
  const { quote, depositAsync, isLoading } = useCrossChainDeposit();
  const [wallets, setWallets] = useState<EvmWalletDetail[]>([]);
  const [connected, setConnected] = useState<{ wallet: EvmWalletDetail; account: `0x${string}` } | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("");
  const [quotes, setQuotes] = useState<Record<CctpFinality, CctpQuote> | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The burn in flight for this wallet, from localStorage (null on the server
  // and until the first client render).
  const pendingRaw = useSyncExternalStore(
    subscribePendingDeposit,
    () => readPendingDepositRaw(to),
    () => null
  );
  const pending = useMemo(() => parsePendingDeposit(pendingRaw), [pendingRaw]);
  // "memory" means this browser refused to store it: the hash lives in this tab only.
  const pendingHome = useSyncExternalStore(
    subscribePendingDeposit,
    () => pendingDepositHome(to),
    () => null
  );

  useEffect(() => {
    let cancelled = false;
    discoverEvmWallets().then((found) => {
      if (!cancelled) setWallets(found);
    });
    return () => {
      cancelled = true;
    };
  }, [to]);

  // A deposit remembered from an earlier visit (or one this page started and
  // then lost track of): Chipi says when it has minted.
  const followed = useCctpDepositStatus({
    burnTxHash: isLoading ? null : pending?.burnTxHash ?? null,
    getBearerToken: getChipiToken,
  });
  const finish = useCallback(() => {
    clearPendingDeposit(to);
    onDeposited();
  }, [to, onDeposited]);
  const minted = pending !== null && followed.data?.status === "MINTED";
  useEffect(() => {
    if (minted) finish();
  }, [minted, finish]);

  const connect = async (wallet: EvmWalletDetail) => {
    setBusy(true);
    setError(null);
    try {
      const accounts = (await wallet.provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
      if (!accounts[0]) throw new Error(`${wallet.info.name} returned no account.`);
      // Balance first: if Base's RPC is down, the wallet list stays and the user can retry.
      const usdc = await baseUsdcBalance(accounts[0]);
      setConnected({ wallet, account: accounts[0] });
      setBalance(usdc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // One remembered burn per wallet: a second deposit would replace the hash
  // this page is following. Wait for it, or stop following it, first.
  const inFlight = () => {
    if (!readPendingDepositRaw(to)) return false;
    setError("A deposit from Base is already in flight. Wait for it to arrive before starting another.");
    return true;
  };

  const getQuotes = async () => {
    if (balance === null || inFlight()) return;
    const check = checkDeposit(amount, { walletUsdc: balance, roomUsd });
    if (!check.ok) return setError(check.message);
    setBusy(true);
    setError(null);
    try {
      setQuotes(await quote({ chain: BASE, amount: formatUsdc(check.units) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const deposit = async (finality: CctpFinality) => {
    if (!connected || !quotes || inFlight()) return;
    const q = quotes[finality];
    setError(null);
    setStatus(null);
    try {
      const result = await depositAsync({
        provider: connected.wallet.provider,
        account: connected.account,
        chain: BASE,
        amount: q.amountUsdc,
        walletAddress: to,
        finality,
        getBearerToken: getChipiToken,
        onStatus: ({ step, eta, burnTxHash }) => {
          if (burnTxHash && !readPendingDepositRaw(to)) {
            savePendingDeposit(to, { burnTxHash, sourceDomain: BASE.domain, amountUsdc: q.amountUsdc, startedAt: Date.now() });
          }
          setStatus(depositStepLabel(step, eta ? formatCctpEta(eta) : null));
        },
      });
      setQuotes(null);
      setAmount("");
      if (result.mintTxHash) {
        setStatus(depositStepLabel("done", null));
        finish();
      } else {
        // The page waited as long as it would; Chipi finishes it, and the
        // remembered burn is followed above.
        setStatus("Still in flight. Chipi completes it on its own; this page follows it.");
      }
    } catch (err) {
      setStatus(null);
      if (err instanceof CrossChainDepositError) {
        // The USDC left Base: the burn is registered or can be, nothing is lost.
        setError(`${err.message} Your deposit is tracked below by its Base transaction.`);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const pendingCard = pending && (
    <div className="glass p-4 space-y-1 text-left">
      <p className="text-sm">
        Deposit of <span className="font-mono">{pending.amountUsdc} USDC</span> from Base,{" "}
        {describeStartedAt(pending.startedAt)}.
      </p>
      {pendingHome === "memory" && (
        <p className="text-xs text-[var(--vela-gold)]">
          This browser wouldn&apos;t save the record, so it lives in this tab only. Keep the tab open, or copy the Base
          transaction below.
        </p>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        {followed.data?.status === "FAILED"
          ? "Chipi could not mint it yet. Your USDC is safe: keep the Base transaction below and contact support."
          : followed.data?.status === "UNREGISTERED"
            ? "Chipi has no record of this burn. Keep the Base transaction below; a mint can be delivered at any time."
            : "Circle attests it, then Chipi mints it on Starknet. You can close this page."}
      </p>
      <a
        href={`${BASE.explorerTx}${pending.burnTxHash}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-mono text-[var(--vela-blue)] hover:underline break-all"
      >
        {pending.burnTxHash}
      </a>
      {(followed.data?.status === "FAILED" || followed.data?.status === "UNREGISTERED") && (
        <button onClick={() => finish()} className="block text-xs text-[var(--text-muted)] underline">
          Stop following it
        </button>
      )}
    </div>
  );

  if (!connected) {
    return (
      <div className="space-y-2">
        {pendingCard}
        {wallets.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">No EVM wallet found in this browser (MetaMask, Rabby, Coinbase Wallet…).</p>
        )}
        {wallets.map((w) => (
          <button
            key={w.info.uuid}
            onClick={() => connect(w)}
            disabled={busy || isLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:brightness-110 transition-all disabled:opacity-50"
          >
            {w.info.icon ? (
              // eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs
              <img src={w.info.icon} alt="" width={24} height={24} className="rounded" />
            ) : (
              <span className="w-6 h-6 rounded bg-[var(--glass-hover)]" />
            )}
            <span className="font-medium">Bring USDC from Base with {w.info.name}</span>
          </button>
        ))}
        {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {pendingCard}
      <p className="text-sm text-[var(--text-secondary)]">
        {connected.wallet.info.name} has <span className="font-mono">{balance === null ? "…" : formatUsdc(balance)} USDC</span> on
        Base. It pays Base&apos;s network fee (cents).
      </p>
      {!quotes && (
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            placeholder="Amount in USDC"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy || isLoading}
            className="flex-1 px-4 py-3 rounded-xl glass bg-transparent outline-none font-mono"
          />
          <button
            onClick={getQuotes}
            disabled={busy || isLoading || !amount}
            className="px-5 py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
          >
            {busy ? "…" : "Quote"}
          </button>
        </div>
      )}
      {quotes && !isLoading && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">Pick a speed. Both prices come from Circle right now.</p>
          <button
            onClick={() => deposit("standard")}
            className="w-full px-4 py-3 rounded-xl glass hover:brightness-110 transition-all text-left"
          >
            <span className="font-medium">Free · {formatCctpEta(quotes.standard.eta)}</span>
            <span className="block text-xs text-[var(--text-muted)]">You receive {quotes.standard.receivesUsdc} USDC.</span>
          </button>
          <button
            onClick={() => deposit("fast")}
            className="w-full px-4 py-3 rounded-xl glass hover:brightness-110 transition-all text-left"
          >
            <span className="font-medium">Fast · {formatCctpEta(quotes.fast.eta)}</span>
            <span className="block text-xs text-[var(--text-muted)]">
              Circle takes {quotes.fast.feeUsdc} USDC from the amount. You receive {quotes.fast.receivesUsdc} USDC.
            </span>
          </button>
          <button onClick={() => setQuotes(null)} className="text-xs text-[var(--text-muted)] underline">
            Change the amount
          </button>
        </div>
      )}
      {status && <p className="text-sm text-[var(--text-secondary)]">{status}</p>}
      {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}
