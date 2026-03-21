"use client";

import { ChipiClientProvider } from "@chipi-stack/nextjs";
import OnboardingClient from "./client";

export default function OnboardingWithProvider() {
  return (
    <ChipiClientProvider apiPublicKey={process.env.NEXT_PUBLIC_CHIPI_API_KEY!}>
      <OnboardingClient />
    </ChipiClientProvider>
  );
}
