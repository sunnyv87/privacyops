"use client";

import { Check, X, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SupportValue = "yes" | "no" | "partial" | string;

export interface CompareRow {
  feature: string;
  description?: string;
  /**
   * Either a Record mapping competitor name to value,
   * or a positional array aligned to the `competitors` prop order.
   */
  support?: Record<string, SupportValue>;
  values?: SupportValue[];
}

export interface CompareCategory {
  /** Category name. Either `name` or `category` works. */
  name?: string;
  category?: string;
  rows: CompareRow[];
}

interface CompareTableProps {
  competitors: string[];
  categories: CompareCategory[];
  highlightColumn?: string;
  className?: string;
}

function Cell({ value }: { value: SupportValue }) {
  if (value === "yes") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <X className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  return <span className="text-xs font-medium text-foreground">{value}</span>;
}

export function CompareTable({
  competitors,
  categories,
  highlightColumn = "TechD",
  className,
}: CompareTableProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <div className="overflow-x-auto rounded-2xl border border-border bg-background/40 backdrop-blur">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
            <tr className="border-b border-border">
              <th className="w-1/3 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Capability
              </th>
              {competitors.map((c) => {
                const isHi = c === highlightColumn;
                return (
                  <th
                    key={c}
                    className={cn(
                      "px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider",
                      isHi
                        ? "border-x-2 border-primary/60 bg-primary/5 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {c}
                      {isHi && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                          OURS
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, ci) => (
              <motion.tr
                key={(cat.name ?? cat.category ?? "") + ci}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3 }}
                className="contents"
              >
                <CategoryRows category={cat} competitors={competitors} highlight={highlightColumn} />
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-400" /> Supported
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5 text-amber-400" /> Partial
        </span>
        <span className="inline-flex items-center gap-1.5">
          <X className="h-3.5 w-3.5 text-red-400" /> Not supported
        </span>
      </div>
    </div>
  );
}

function CategoryRows({
  category,
  competitors,
  highlight,
}: {
  category: CompareCategory;
  competitors: string[];
  highlight: string;
}) {
  return (
    <>
      <tr className="border-b border-border bg-secondary/40">
        <td
          colSpan={competitors.length + 1}
          className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/80"
        >
          {category.name ?? category.category}
        </td>
      </tr>
      {category.rows.map((row, ri) => (
        <tr
          key={row.feature + ri}
          className="border-b border-border/60 transition-colors hover:bg-secondary/30"
        >
          <td className="px-5 py-3.5 align-top">
            <p className="text-sm font-medium text-foreground">{row.feature}</p>
            {row.description && (
              <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{row.description}</p>
            )}
          </td>
          {competitors.map((c, ci) => {
            const isHi = c === highlight;
            const value =
              row.support?.[c] ??
              row.values?.[ci] ??
              "no";
            return (
              <td
                key={c}
                className={cn(
                  "px-4 py-3.5 text-center align-middle",
                  isHi && "border-x-2 border-primary/60 bg-primary/5",
                )}
              >
                <Cell value={value} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export default CompareTable;
