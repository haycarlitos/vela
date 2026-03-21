import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Vela — Set sail. Let AI navigate.",
  description: "Autonomous DeFi agent powered by Chipi Pay. Hire an AI to manage your portfolio while you sleep.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* SVG Filter Definitions — hidden, referenced by CSS url() */}
        <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
          <defs>
            {/* Water distortion: subtle liquid wobble on hover */}
            <filter id="water-distortion" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.015"
                numOctaves="3"
                seed="2"
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  values="0.015;0.02;0.015"
                  dur="8s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="6"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* Chromatic aberration: RGB channel split for hover accent */}
            <filter id="chromatic-aberration" x="-2%" y="-2%" width="104%" height="104%">
              <feOffset in="SourceGraphic" dx="1" dy="0" result="red" />
              <feColorMatrix
                in="red"
                type="matrix"
                values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0"
                result="red-only"
              />
              <feOffset in="SourceGraphic" dx="-1" dy="0" result="blue" />
              <feColorMatrix
                in="blue"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0.3 0"
                result="blue-only"
              />
              <feBlend in="SourceGraphic" in2="red-only" mode="screen" result="with-red" />
              <feBlend in="with-red" in2="blue-only" mode="screen" />
            </filter>

            {/* Caustic pattern: animated light refraction overlay */}
            <filter id="caustic-pattern" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="turbulence"
                baseFrequency="0.03"
                numOctaves="4"
                seed="5"
                result="caustic"
              >
                <animate
                  attributeName="seed"
                  values="5;15;5"
                  dur="12s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feColorMatrix
                in="caustic"
                type="saturate"
                values="0"
                result="mono-caustic"
              />
              <feComponentTransfer in="mono-caustic" result="bright-caustic">
                <feFuncR type="linear" slope="0.3" intercept="0" />
                <feFuncG type="linear" slope="0.3" intercept="0" />
                <feFuncB type="linear" slope="0.4" intercept="0" />
                <feFuncA type="linear" slope="0.15" intercept="0" />
              </feComponentTransfer>
              <feBlend in="SourceGraphic" in2="bright-caustic" mode="screen" />
            </filter>
          </defs>
        </svg>

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
