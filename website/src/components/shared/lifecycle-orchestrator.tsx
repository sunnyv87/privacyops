"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Inbox, ShieldCheck, Cog, Archive, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  label: string;
  Icon: LucideIcon;
  features: string[];
}

const STAGES: Stage[] = [
  {
    id: "collect",
    label: "Collect",
    Icon: Inbox,
    features: ["Source discovery", "Schema fingerprint", "Auto-onboard"],
  },
  {
    id: "consent",
    label: "Consent",
    Icon: ShieldCheck,
    features: ["Purpose binding", "Cross-channel sync", "Receipts"],
  },
  {
    id: "process",
    label: "Process",
    Icon: Cog,
    features: ["Policy gates", "Tokenize on use", "Lineage trace"],
  },
  {
    id: "retain",
    label: "Retain",
    Icon: Archive,
    features: ["TTL by purpose", "Legal hold", "Audit ledger"],
  },
  {
    id: "erase",
    label: "Erase",
    Icon: Trash2,
    features: ["DSAR fulfillment", "Cascading delete", "Proof of erasure"],
  },
];

interface LifecycleOrchestratorProps {
  className?: string;
  intervalMs?: number;
}

export function LifecycleOrchestrator({
  className,
  intervalMs = 4000,
}: LifecycleOrchestratorProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((p) => (p + 1) % STAGES.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="glass-card-elevated rounded-2xl p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Privacy Data Lifecycle
            </p>
            <p className="text-balance mt-1 text-base font-semibold text-foreground sm:text-lg">
              Orchestrated end-to-end across every stage
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            Live orchestration
          </span>
        </div>

        {/* Desktop ribbon */}
        <div className="relative hidden md:block">
          {/* Connecting gradient line */}
          <div className="absolute left-[8%] right-[8%] top-[34px] h-[2px] bg-gradient-to-r from-blue-500/40 via-cyan-500/60 to-purple-500/40" />

          <div className="relative grid grid-cols-5 gap-4">
            {STAGES.map((stage, i) => {
              const Icon = stage.Icon;
              const isActive = active === i;
              return (
                <div key={stage.id} className="flex flex-col items-center text-center">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.12 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    className={cn(
                      "relative flex h-[68px] w-[68px] items-center justify-center rounded-2xl border bg-background/80 backdrop-blur",
                      isActive
                        ? "border-cyan-500/60 shadow-lg shadow-cyan-500/30"
                        : "border-border",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="lifecycle-glow"
                        className="absolute inset-0 -m-1 rounded-2xl bg-cyan-500/25 blur-xl"
                      />
                    )}
                    <Icon
                      className={cn(
                        "relative h-7 w-7 transition-colors",
                        isActive ? "text-cyan-300" : "text-muted-foreground",
                      )}
                    />
                  </motion.div>
                  <p
                    className={cn(
                      "mt-3 text-xs font-bold uppercase tracking-wider transition-colors",
                      isActive ? "text-cyan-300" : "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {stage.features.map((f) => (
                      <li
                        key={f}
                        className={cn(
                          "text-[11px] transition-colors",
                          isActive ? "text-foreground" : "text-muted-foreground/70",
                        )}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile stack */}
        <div className="space-y-3 md:hidden">
          {STAGES.map((stage, i) => {
            const Icon = stage.Icon;
            const isActive = active === i;
            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                  isActive ? "border-cyan-500/50 bg-cyan-500/5" : "border-border",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 flex-none items-center justify-center rounded-xl border",
                    isActive ? "border-cyan-500/60 bg-cyan-500/10" : "border-border bg-background",
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", isActive ? "text-cyan-300" : "text-muted-foreground")}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      isActive ? "text-cyan-300" : "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stage.features.join(" · ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={STAGES[active].id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            Active: <span className="font-semibold text-cyan-300">{STAGES[active].label}</span>
            {" — "}
            {STAGES[active].features[0]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default LifecycleOrchestrator;
