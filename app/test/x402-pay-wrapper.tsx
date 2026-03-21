"use client";

import { ChipiClientProvider } from "@chipi-stack/nextjs";
import X402PayClient from "./x402-pay";

export default function X402PayWrapper() {
  return (
    <ChipiClientProvider apiPublicKey={process.env.NEXT_PUBLIC_CHIPI_API_KEY!}>
      <X402PayClient />
    </ChipiClientProvider>
  );
}
