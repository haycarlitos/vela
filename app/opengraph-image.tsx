import { ImageResponse } from "next/og";

export const alt = "Vela: an AI agent that invests for you, inside limits your wallet enforces";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card shown when a Vela link is shared. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #031426 0%, #06345a 55%, #0b5f8a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 36, color: "#4FC3F7", fontWeight: 700, marginBottom: 32 }}>Vela</div>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
          An AI agent that invests for you, inside limits your wallet enforces
        </div>
        <div style={{ fontSize: 30, color: "rgba(255,255,255,0.75)", marginTop: 36 }}>
          Self-custodial · Face ID · Caps on-chain · Starknet
        </div>
      </div>
    ),
    size
  );
}
