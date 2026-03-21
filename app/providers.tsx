"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChipiClientProvider } from "@chipi-stack/nextjs";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render ChipiProvider during SSR/SSG — it validates API key on init
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ChipiClientProvider apiPublicKey={process.env.NEXT_PUBLIC_CHIPI_API_KEY!}>
      {children}
    </ChipiClientProvider>
  );
}
