"use client";

import dynamic from "next/dynamic";

const OnboardingClient = dynamic(() => import("./client"), { ssr: false });

export default function OnboardingPage() {
  return <OnboardingClient />;
}
