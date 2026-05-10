"use client";

import { cn } from "@/lib/utils";

type Region = "EU" | "US" | "India" | "Global";

interface RegBadge {
  name: string;
  region: Region;
  prominent?: boolean;
}

const ROW_TOP: RegBadge[] = [
  { name: "GDPR", region: "EU" },
  { name: "DPDPA", region: "India", prominent: true },
  { name: "CCPA", region: "US" },
  { name: "HIPAA", region: "US" },
  { name: "CPRA", region: "US" },
  { name: "LGPD", region: "Global" },
  { name: "PIPEDA", region: "Global" },
  { name: "POPIA", region: "Global" },
];

const ROW_BOTTOM: RegBadge[] = [
  { name: "PIPL", region: "Global" },
  { name: "ISO 27001", region: "Global" },
  { name: "SOC 2 Type II", region: "Global" },
  { name: "PCI DSS", region: "Global" },
  { name: "NIS2", region: "EU" },
  { name: "EU AI Act", region: "EU" },
  { name: "SEBI CSCRF", region: "India" },
  { name: "RBI Guidelines", region: "India" },
];

const regionTone: Record<Region, string> = {
  EU: "border-blue-500/30 bg-blue-500/5 text-blue-300",
  US: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
  India: "border-orange-500/30 bg-orange-500/5 text-orange-300",
  Global: "border-purple-500/30 bg-purple-500/5 text-purple-300",
};

interface RegulationRibbonProps {
  className?: string;
}

function Pill({ badge }: { badge: RegBadge }) {
  const isProminent = badge.prominent;
  return (
    <div
      className={cn(
        "flex flex-none items-center gap-2 rounded-full border px-4 py-2 backdrop-blur transition-colors",
        isProminent
          ? "border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10"
          : "border-border bg-background/60 hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold",
          isProminent ? "text-orange-200" : "text-foreground",
        )}
      >
        {badge.name}
      </span>
      <span
        className={cn(
          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          regionTone[badge.region],
        )}
      >
        {badge.region}
      </span>
    </div>
  );
}

function MarqueeRow({
  badges,
  reverse = false,
  slow = false,
}: {
  badges: RegBadge[];
  reverse?: boolean;
  slow?: boolean;
}) {
  const doubled = [...badges, ...badges];
  return (
    <div className={cn("flex w-max gap-3 will-change-transform", slow ? "animate-marquee-slow" : "animate-marquee", reverse && "flex-row-reverse")}>
      {doubled.map((b, i) => (
        <Pill key={`${b.name}-${i}`} badge={b} />
      ))}
    </div>
  );
}

export function RegulationRibbon({ className }: RegulationRibbonProps) {
  return (
    <div className={cn("relative w-full space-y-3 py-2", className)}>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
        <MarqueeRow badges={ROW_TOP} />
      </div>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
        <MarqueeRow badges={ROW_BOTTOM} reverse slow />
      </div>
    </div>
  );
}

export default RegulationRibbon;
