"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Globe, Key, Server, Database, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttackPathFlowProps {
  className?: string;
}

interface PathNode {
  id: string;
  label: string;
  caption: string;
  risk: number;
  Icon: typeof Globe;
}

const NODES: PathNode[] = [
  {
    id: "public",
    label: "Public Asset",
    caption: "Internet-exposed S3 bucket",
    risk: 62,
    Icon: Globe,
  },
  {
    id: "perm",
    label: "Misconfig",
    caption: "Wildcard IAM policy",
    risk: 78,
    Icon: Key,
  },
  {
    id: "svc",
    label: "Service Account",
    caption: "Over-privileged role",
    risk: 84,
    Icon: Server,
  },
  {
    id: "db",
    label: "Sensitive DB",
    caption: "1.2M PII rows exposed",
    risk: 96,
    Icon: Database,
  },
];

const riskColor = (r: number) => {
  if (r >= 90) return "bg-red-500/20 text-red-300 border-red-500/40";
  if (r >= 75) return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  return "bg-amber-500/20 text-amber-300 border-amber-500/40";
};

export function AttackPathFlow({ className }: AttackPathFlowProps) {
  // viewBox-based positions matched to grid layout below
  const positions = [
    { x: 80, y: 60 },
    { x: 280, y: 60 },
    { x: 480, y: 60 },
    { x: 680, y: 60 },
  ];

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/30 via-background to-background p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="text-sm font-semibold text-red-300">Toxic Combination Detected</span>
          </div>
          <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-medium text-red-300">
            Critical
          </span>
        </div>

        {/* SVG path overlay */}
        <div className="relative">
          <svg
            viewBox="0 0 760 120"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full pointer-events-none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="atk-path" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#ef4444" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
              </linearGradient>
            </defs>
            {positions.slice(0, -1).map((p, i) => {
              const next = positions[i + 1];
              return (
                <motion.path
                  key={i}
                  d={`M ${p.x + 36} ${p.y} L ${next.x - 36} ${next.y}`}
                  fill="none"
                  stroke="url(#atk-path)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray="6 6"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    duration: 0.9,
                    delay: i * 0.9,
                    repeat: Infinity,
                    repeatDelay: 1.6,
                    ease: "easeInOut",
                  }}
                />
              );
            })}
          </svg>

          {/* Nodes grid */}
          <div className="relative grid grid-cols-2 gap-6 md:grid-cols-4">
            {NODES.map((n, i) => {
              const Icon = n.Icon;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15, duration: 0.4 }}
                  className="relative"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-3">
                      <div className="absolute inset-0 -m-2 rounded-2xl bg-red-500/20 blur-xl" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-950/80 to-background shadow-lg shadow-red-500/20">
                        <Icon className="h-7 w-7 text-red-300" />
                      </div>
                      <span
                        className={cn(
                          "absolute -right-2 -top-2 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          riskColor(n.risk),
                        )}
                      >
                        {n.risk}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{n.label}</p>
                    <p className="mt-1 max-w-[160px] text-xs text-muted-foreground text-pretty">
                      {n.caption}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Remediation callout */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-8 flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald-500/15">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Remediation Available</p>
              <p className="text-xs text-muted-foreground">
                Revoke wildcard IAM, scope service-account to read-only, enable bucket private mode.
              </p>
            </div>
          </div>
          <button className="self-start rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 sm:self-auto">
            Auto-Fix
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default AttackPathFlow;
