"use client";

import dynamic from "next/dynamic";
import { ChipiClientProvider } from "@chipi-stack/nextjs";

const OnboardingClient = dynamic(() => import("./client"), { ssr: false });

export default function OnboardingPage() {
  return (
    <ChipiClientProvider apiPublicKey={process.env.NEXT_PUBLIC_CHIPI_API_KEY!}>
      <OnboardingClient />
    </ChipiClientProvider>
  );
}
