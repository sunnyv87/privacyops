"use client";

import {
  Banknote,
  HeartPulse,
  Cloud,
  Factory,
  Landmark,
  ShieldCheck,
  FlaskConical,
  Radio,
  GraduationCap,
  Crosshair,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoCard {
  label: string;
  Icon: LucideIcon;
  tone: string;
}

const LOGOS: LogoCard[] = [
  { label: "Top-3 Indian Bank", Icon: Banknote, tone: "from-blue-500/20 to-cyan-500/10" },
  { label: "Global Healthcare Network", Icon: HeartPulse, tone: "from-rose-500/20 to-red-500/10" },
  { label: "Fortune 500 SaaS", Icon: Cloud, tone: "from-cyan-500/20 to-sky-500/10" },
  { label: "G2000 Manufacturer", Icon: Factory, tone: "from-amber-500/20 to-orange-500/10" },
  { label: "Federal Agency", Icon: Landmark, tone: "from-indigo-500/20 to-violet-500/10" },
  { label: "Insurance Leader", Icon: ShieldCheck, tone: "from-emerald-500/20 to-teal-500/10" },
  { label: "Pharma R&D", Icon: FlaskConical, tone: "from-pink-500/20 to-fuchsia-500/10" },
  { label: "Telecom Operator", Icon: Radio, tone: "from-purple-500/20 to-indigo-500/10" },
  { label: "EdTech Platform", Icon: GraduationCap, tone: "from-yellow-500/20 to-amber-500/10" },
  { label: "Defense Contractor", Icon: Crosshair, tone: "from-slate-500/20 to-zinc-500/10" },
];

interface LogoMarqueeProps {
  className?: string;
  heading?: string;
}

function LogoCardItem({ logo }: { logo: LogoCard }) {
  const Icon = logo.Icon;
  return (
    <div
      className={cn(
        "group flex h-16 min-w-[220px] flex-none items-center gap-3 rounded-xl border border-border/60 bg-gradient-to-br px-4 transition-colors hover:border-primary/40",
        logo.tone,
      )}
    >
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/10 bg-background/70">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <span className="text-sm font-semibold text-foreground/90 group-hover:text-foreground">
        {logo.label}
      </span>
    </div>
  );
}

export function LogoMarquee({
  className,
  heading = "Trusted by enterprises in regulated industries",
}: LogoMarqueeProps) {
  const doubled = [...LOGOS, ...LOGOS];

  return (
    <div className={cn("relative w-full", className)}>
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        {heading}
      </p>

      <div className="relative overflow-hidden">
        {/* Edge fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

        <div className="flex w-max animate-marquee gap-4 will-change-transform">
          {doubled.map((logo, i) => (
            <LogoCardItem key={`${logo.label}-${i}`} logo={logo} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default LogoMarquee;
