"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTASection } from "@/components/shared/cta-section";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/animated-section";
import { MetricCounter } from "@/components/shared/metric-counter";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Building,
  Cloud,
  Factory,
  Globe,
  Heart,
  Landmark,
  Shield,
  Sparkles,
  TrendingDown,
  ClipboardCheck,
  FileText,
  Layers,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Industry {
  href: string;
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  regulations: string[];
  highlights: string[];
  accent: "blue" | "cyan" | "purple" | "emerald" | "amber" | "rose";
}

const INDUSTRIES: Industry[] = [
  {
    href: "/industries/bfsi",
    icon: Landmark,
    title: "BFSI",
    tagline: "Banking, Financial Services & Insurance",
    description:
      "Cross-border data flows, customer data protection, and third-party risk — automated. Built for RBI-regulated entities, SEBI-listed firms, and global insurers.",
    regulations: ["RBI", "SEBI CSCRF", "PCI DSS", "DPDPA", "GDPR"],
    highlights: ["Data localisation enforcement", "Continuous PCI evidence", "Third-party DPA tracking"],
    accent: "blue",
  },
  {
    href: "/industries/healthcare",
    icon: Heart,
    title: "Healthcare",
    tagline: "Hospitals, Payers, Pharma & HealthTech",
    description:
      "PHI discovery across EHR + cloud, 60-day breach notification workflows, and BAA management — purpose-built for HIPAA-grade environments.",
    regulations: ["HIPAA", "HITECH", "DPDPA", "GDPR", "21 CFR Part 11"],
    highlights: ["EHR & PACS connectors", "Auto-BAA tracking", "Minimum-necessary access"],
    accent: "rose",
  },
  {
    href: "/industries/saas",
    icon: Cloud,
    title: "SaaS & Tech Companies",
    tagline: "Multi-tenant Platforms & Developer Tools",
    description:
      "Multi-tenant isolation proofs, customer DSAR fulfillment, and SOC 2 evidence automation — so your security review unblocks deals instead of burning quarters.",
    regulations: ["SOC 2", "GDPR", "CCPA", "DPDPA", "ISO 27001"],
    highlights: ["RLS coverage scoring", "DSAR self-serve", "Continuous SOC 2 evidence"],
    accent: "cyan",
  },
  {
    href: "/industries/manufacturing",
    icon: Factory,
    title: "Manufacturing & Industrial",
    tagline: "Discrete, Process & Industrial IoT",
    description:
      "OT/IT convergence security, IP classification across CAD and ERP, and supply-chain DPA management — without disrupting plant operations.",
    regulations: ["ISO 27001", "NIST", "IEC 62443", "GDPR"],
    highlights: ["OT-safe scanning", "IP classification", "Supplier risk tiers"],
    accent: "amber",
  },
  {
    href: "/industries/government",
    icon: Shield,
    title: "Government & Public Sector",
    tagline: "Federal, State, and Citizen Services",
    description:
      "Citizen data sovereignty, tamper-evident audit trails, and FedRAMP-ready architecture — engineered for the highest accountability bar.",
    regulations: ["DPDPA", "CERT-In", "FedRAMP", "GDPR", "NIS2"],
    highlights: ["Sovereignty enforcement", "SHA-256 audit chain", "Air-gap deploy ready"],
    accent: "purple",
  },
  {
    href: "/industries/enterprises",
    icon: Globe,
    title: "Large Enterprises",
    tagline: "Multi-cloud, Multi-region, Multi-regulation",
    description:
      "Multi-cloud data discovery, M&A due diligence playbooks, and board-level reporting — unified across every business unit and jurisdiction.",
    regulations: ["All major frameworks"],
    highlights: ["Cross-cloud discovery", "M&A risk dossiers", "Board-ready dashboards"],
    accent: "emerald",
  },
];

const VALUE_PROPS = [
  {
    icon: TrendingDown,
    title: "80% lower DSAR cost",
    description: "Automated request intake, identity verification, and fail-closed redaction — at a fraction of manual fulfillment cost.",
    accent: "from-cyan-500/20 to-sky-500/5 border-cyan-500/30",
    iconClass: "text-cyan-400",
  },
  {
    icon: ClipboardCheck,
    title: "Continuous SOC 2 evidence",
    description: "Always-on evidence collection from audit logs, configs, and scans — pass your next Type II audit in days, not quarters.",
    accent: "from-emerald-500/20 to-teal-500/5 border-emerald-500/30",
    iconClass: "text-emerald-400",
  },
  {
    icon: Layers,
    title: "Auto-mapped controls",
    description: "Pre-built crosswalks across 16+ frameworks. Map a control once, prove it across every regulation that requires it.",
    accent: "from-purple-500/20 to-fuchsia-500/5 border-purple-500/30",
    iconClass: "text-purple-400",
  },
  {
    icon: FileText,
    title: "Board-ready reports",
    description: "Executive PDFs, regulator dossiers, and quarterly attestations — generated on schedule, signed by the platform itself.",
    accent: "from-amber-500/20 to-orange-500/5 border-amber-500/30",
    iconClass: "text-amber-400",
  },
];

const ACCENT_BG: Record<Industry["accent"], string> = {
  blue: "from-blue-500/10 to-transparent border-blue-500/30 group-hover:border-blue-500/50",
  cyan: "from-cyan-500/10 to-transparent border-cyan-500/30 group-hover:border-cyan-500/50",
  purple: "from-purple-500/10 to-transparent border-purple-500/30 group-hover:border-purple-500/50",
  emerald: "from-emerald-500/10 to-transparent border-emerald-500/30 group-hover:border-emerald-500/50",
  amber: "from-amber-500/10 to-transparent border-amber-500/30 group-hover:border-amber-500/50",
  rose: "from-rose-500/10 to-transparent border-rose-500/30 group-hover:border-rose-500/50",
};

const ACCENT_ICON: Record<Industry["accent"], string> = {
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  purple: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  rose: "border-rose-500/40 bg-rose-500/10 text-rose-400",
};

const ACCENT_LINK: Record<Industry["accent"], string> = {
  blue: "text-blue-400",
  cyan: "text-cyan-400",
  purple: "text-purple-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IndustriesPage() {
  return (
    <main className="relative overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────
          1. HERO
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />

        <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-4">
              Industry Solutions
            </div>
            <Badge variant="cyan" className="mb-6">
              <Building className="h-3 w-3 mr-1.5" /> 6 Industries · 16+ Regulations
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6 text-balance">
              Built for your{" "}
              <span className="gradient-text">regulated reality.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
              Industry-specific data security and privacy for organizations operating under the
              strictest regulations and the highest stakes. From regulated banking to citizen
              services — pre-built for your reality.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="gradient" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Talk to an Industry Expert <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/compliance">View Compliance Coverage</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          2. INDUSTRY CARDS
         ───────────────────────────────────────────────────────────────── */}
      <Section pattern="dots">
        <SectionHeader
          eyebrow="Industries"
          title="One platform."
          titleGradient="Six regulated realities."
          description="Each industry inherits the full TechD platform — and adds the connectors, control mappings, and report templates specific to its regulatory landscape."
        />

        <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => {
            const Icon = industry.icon;
            return (
              <StaggerItem key={industry.title}>
                <Link href={industry.href} className="group block h-full">
                  <div
                    className={cn(
                      "relative h-full rounded-2xl border bg-gradient-to-br p-7 transition-all duration-300 card-hover",
                      ACCENT_BG[industry.accent],
                    )}
                  >
                    <div
                      className={cn(
                        "mb-5 inline-flex rounded-xl border p-3 transition-colors",
                        ACCENT_ICON[industry.accent],
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <h3 className="text-xl font-semibold mb-1">{industry.title}</h3>
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                      {industry.tagline}
                    </p>

                    <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                      {industry.description}
                    </p>

                    <div className="space-y-2 mb-5 pb-5 border-b border-border/60">
                      {industry.highlights.map((h) => (
                        <div
                          key={h}
                          className="flex items-center gap-2 text-xs text-foreground/80"
                        >
                          <Sparkles className={cn("h-3 w-3 shrink-0", ACCENT_LINK[industry.accent])} />
                          {h}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {industry.regulations.map((reg) => (
                        <span
                          key={reg}
                          className="inline-flex items-center rounded-md bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border"
                        >
                          {reg}
                        </span>
                      ))}
                    </div>

                    <div
                      className={cn(
                        "flex items-center text-sm font-medium transition-all gap-1.5 group-hover:gap-2.5",
                        ACCENT_LINK[industry.accent],
                      )}
                    >
                      Explore {industry.title}{" "}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          3. CROSS-INDUSTRY VALUE PROPS
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="muted">
        <SectionHeader
          eyebrow="Cross-Industry Value"
          title="Whatever industry you're in,"
          titleGradient="these outcomes are universal."
          description="The TechD platform delivers the same core impact across every regulated industry we serve."
        />

        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((vp) => {
            const Icon = vp.icon;
            return (
              <StaggerItem key={vp.title}>
                <div
                  className={cn(
                    "h-full rounded-2xl border bg-gradient-to-br p-6 card-hover",
                    vp.accent,
                  )}
                >
                  <Icon className={cn("h-6 w-6 mb-4", vp.iconClass)} />
                  <h3 className="text-base font-semibold mb-2">{vp.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {vp.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <AnimatedSection delay={0.2}>
          <div className="mt-16 rounded-2xl border border-border bg-card/40 p-8 lg:p-10">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCounter value={200} suffix="+" label="Enterprise Customers" />
              <MetricCounter value={43} suffix="+" label="Native Connectors" />
              <MetricCounter value={16} label="Regulations Automated" />
              <MetricCounter value={99} suffix=".99%" label="Platform SLA" />
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          4. CTA
         ───────────────────────────────────────────────────────────────── */}
      <CTASection
        title="Your industry has its own rules."
        titleGradient="So does our platform."
        description="See exactly how TechD PrivacyOps maps to your industry's regulatory reality — connectors, controls, and reports already built."
        primaryCta="Book an Industry Demo"
        primaryHref="/contact"
        secondaryCta="View Platform"
        secondaryHref="/platform"
      />
    </main>
  );
}
