import OnboardingClient from "./client";
import { TICK_INTERVAL_MINUTES, describeTickInterval } from "@/lib/config";

export default function OnboardingPage() {
  // TICK_INTERVAL_MINUTES is a server env var: read it here, not in the browser.
  return <OnboardingClient tickEvery={describeTickInterval(TICK_INTERVAL_MINUTES)} />;
}
