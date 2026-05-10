"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface IconCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  glowColor?: "blue" | "cyan" | "purple" | "green";
  className?: string;
}

const glowMap = {
  blue: "group-hover:text-blue-400 group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]",
  cyan: "group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]",
  purple: "group-hover:text-purple-400 group-hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]",
  green: "group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]",
};

const bgMap = {
  blue: "bg-blue-500/10 border-blue-500/20 group-hover:border-blue-500/40",
  cyan: "bg-cyan-500/10 border-cyan-500/20 group-hover:border-cyan-500/40",
  purple: "bg-purple-500/10 border-purple-500/20 group-hover:border-purple-500/40",
  green: "bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/40",
};

export function IconCard({
  icon: Icon,
  title,
  description,
  glowColor = "blue",
  className,
}: IconCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border bg-card p-6 card-hover",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 inline-flex rounded-lg border p-2.5 transition-colors",
          bgMap[glowColor]
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 text-muted-foreground transition-all",
            glowMap[glowColor]
          )}
        />
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
