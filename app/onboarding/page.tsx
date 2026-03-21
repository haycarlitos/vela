"use client";

import dynamic from "next/dynamic";

const OnboardingWithProvider = dynamic(() => import("./client-wrapper"), {
  ssr: false,
});

export default function OnboardingPage() {
  return <OnboardingWithProvider />;
}
