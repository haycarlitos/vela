"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChipiProvider } from "@chipi-stack/nextjs";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render ChipiProvider during SSR/SSG — it validates API key on init
  if (!mounted) {
    return <>{children}</>;
  }

  return <ChipiProvider>{children}</ChipiProvider>;
}
