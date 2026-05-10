"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Database,
  Users,
  Activity,
  Wrench,
  CheckCircle2,
  ShieldCheck,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TileData {
  Icon: LucideIcon;
  label: string;
  values: string[];
  trend: string;
  accent: string;
}

const TILES: TileData[] = [
  {
    Icon: Database,
    label: "Data Sources",
    values: ["1,284", "1,287", "1,291", "1,294"],
    trend: "+0.3%",
    accent: "text-blue-400",
  },
  {
    Icon: Users,
    label: "PII Records",
    values: ["8.4M", "8.5M", "8.5M", "8.6M"],
    trend: "+1.1%",
    accent: "text-purple-400",
  },
  {
    Icon: Activity,
    label: "Risk Score",
    values: ["72", "70", "69", "67"],
    trend: "-2 pts",
    accent: "text-emerald-400",
  },
  {
    Icon: Wrench,
    label: "Remediations",
    values: ["18", "21", "24", "27"],
    trend: "+9 today",
    accent: "text-cyan-400",
  },
];

interface FeedItem {
  Icon: LucideIcon;
  text: string;
  time: string;
  tone: string;
}

const FEED: FeedItem[] = [
  {
    Icon: ShieldCheck,
    text: "S3 bucket prod-customer-exports classified as Sensitive",
    time: "just now",
    tone: "text-emerald-400 bg-emerald-500/10",
  },
  {
    Icon: Eye,
    text: "DSAR #4892 auto-redacted across 14 systems",
    time: "12s ago",
    tone: "text-cyan-400 bg-cyan-500/10",
  },
  {
    Icon: CheckCircle2,
    text: "Access policy revoked for stale service-account",
    time: "47s ago",
    tone: "text-purple-400 bg-purple-500/10",
  },
];

const BAR_HEIGHTS = [40, 62, 48, 78, 55, 90, 70, 84, 58, 95, 72, 66];

interface LiveDashboardMockProps {
  className?: string;
}

export function LiveDashboardMock({ className }: LiveDashboardMockProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className={cn("relative w-full", className)}
    >
      <div className="glass-card-elevated overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            </div>
            <span className="ml-3 text-xs font-medium text-muted-foreground">
              privacy.techd.ai / production
            </span>
          </div>
          <span className="tag-live inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Production · Live
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:p-6">
          {/* 2x2 Tile grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {TILES.map((tile) => {
              const Icon = tile.Icon;
              const v = tile.values[tick % tile.values.length];
              return (
                <div
                  key={tile.label}
                  className="rounded-xl border border-border/70 bg-background/40 p-3 sm:p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Icon className={cn("h-4 w-4", tile.accent)} />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {tile.trend}
                    </span>
                  </div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {tile.label}
                  </p>
                  <div className="mt-1 h-7 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={v}
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -14, opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="font-display text-2xl font-bold text-foreground"
                      >
                        {v}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mini bar chart */}
          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Sensitive data flows · 12h</p>
              <span className="text-[10px] text-muted-foreground">avg 68/min</span>
            </div>
            <div className="flex h-20 items-end gap-1.5">
              {BAR_HEIGHTS.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.04,
                    repeat: Infinity,
                    repeatType: "reverse",
                    repeatDelay: 4,
                  }}
                  className="flex-1 rounded-t bg-gradient-to-t from-blue-500/60 via-cyan-500/70 to-cyan-300/80"
                />
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Activity
            </p>
            <ul className="space-y-2">
              {FEED.map((item, i) => {
                const Icon = item.Icon;
                return (
                  <motion.li
                    key={item.text}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/30"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 flex-none items-center justify-center rounded-lg",
                        item.tone,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="flex-1 truncate text-xs text-foreground/90">{item.text}</p>
                    <span className="flex-none text-[10px] text-muted-foreground">{item.time}</span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default LiveDashboardMock;
