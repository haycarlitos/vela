"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate, useInView, motion } from "framer-motion";

interface CountUpProps {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 2,
  duration = 1.5,
  className = "",
}: CountUpProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionValue, to, {
      duration,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [isInView, to, motionValue, duration]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
}
