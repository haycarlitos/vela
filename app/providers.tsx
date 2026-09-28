"use client";

import { type ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ChipiProvider } from "@chipi-stack/nextjs/client";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ChipiProvider config={{ apiPublicKey: process.env.NEXT_PUBLIC_CHIPI_API_KEY! }}>
        <ThemeProvider>{children}</ThemeProvider>
      </ChipiProvider>
    </ClerkProvider>
  );
}
