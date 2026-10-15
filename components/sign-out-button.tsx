"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Ends this browser's Vela session. The agent is not touched: it keeps running
 * under its own capped key until you stop it or the session expires.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      title="Signs you out of this browser. A running agent keeps running until you stop it."
      className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
