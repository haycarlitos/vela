"use client";

import { ChipiProvider } from "@chipi-stack/nextjs";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChipiProvider>{children}</ChipiProvider>;
}
