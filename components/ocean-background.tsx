"use client";

import { motion, useReducedMotion } from "framer-motion";

export function OceanBackground() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className="ocean-bg fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: -1, contain: "layout style paint" }}
      aria-hidden="true"
    >
      {/* Layer 1: Deep glow — slow rotation */}
      <motion.div
        className="absolute"
        style={{
          width: "120vw",
          height: "120vh",
          top: "-10vh",
          left: "-10vw",
          background: "radial-gradient(ellipse 80% 60% at 30% 40%, rgba(18, 24, 69, 0.8) 0%, transparent 70%)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
        animate={prefersReducedMotion ? {} : {
          rotate: [0, 360],
          scale: [1, 1.05, 1],
        }}
        transition={{
          rotate: { duration: 40, repeat: Infinity, ease: "linear" },
          scale: { duration: 20, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* Layer 2: Caustic light pool — breathing */}
      <motion.div
        className="absolute"
        style={{
          width: "100vw",
          height: "100vh",
          top: "0",
          left: "0",
          background: "radial-gradient(ellipse 50% 40% at 70% 30%, rgba(79, 195, 247, 0.06) 0%, transparent 60%)",
          mixBlendMode: "screen",
          willChange: "transform",
          filter: "url(#caustic-pattern)",
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.08, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          scale: { duration: 25, repeat: Infinity, ease: "easeInOut" },
          opacity: { duration: 25, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* Layer 3: Bottom ocean glow — desktop only */}
      <motion.div
        className="absolute hidden md:block"
        style={{
          width: "140vw",
          height: "80vh",
          bottom: "-20vh",
          left: "-20vw",
          background: "radial-gradient(ellipse 70% 50% at 60% 80%, rgba(0, 188, 212, 0.04) 0%, transparent 60%)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
        animate={prefersReducedMotion ? {} : {
          rotate: [0, -360],
          scale: [1, 1.03, 1],
        }}
        transition={{
          rotate: { duration: 35, repeat: Infinity, ease: "linear" },
          scale: { duration: 30, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    </div>
  );
}
