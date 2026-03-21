"use client";

import { useTheme } from "@/components/theme-provider";

export function OceanBackground() {
  const { theme } = useTheme();
  const src = theme === "light" ? "/caustics-light.webm" : "/caustics-dark.webm";

  return (
    <div
      className="ocean-bg fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      <video
        key={src}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: "var(--video-opacity)" }}
      >
        <source src={src} type="video/webm" />
      </video>
    </div>
  );
}
