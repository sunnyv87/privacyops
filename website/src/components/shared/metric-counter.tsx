"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  description?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}

export function MetricCounter({
  value,
  suffix = "",
  prefix = "",
  label,
  description,
  duration = 2000,
  decimals = 0,
  className,
}: MetricCounterProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.4 }}
      className={cn("flex flex-col", className)}
    >
      <div className="flex items-baseline gap-1 font-display">
        {prefix && (
          <span className="text-2xl font-semibold text-muted-foreground sm:text-3xl">{prefix}</span>
        )}
        <span className="gradient-text text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-6xl">
          {formatted}
        </span>
        {suffix && (
          <span className="gradient-text text-3xl font-bold sm:text-4xl">{suffix}</span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{label}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground text-pretty">{description}</p>}
    </motion.div>
  );
}

export default MetricCounter;
