"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/animated-section";
import { CTASection } from "@/components/shared/cta-section";
import { MetricCounter } from "@/components/shared/metric-counter";
import { RegulationRibbon } from "@/components/shared/regulation-ribbon";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  Globe,
  Landmark,
  Heart,
  Fingerprint,
  Lock,
  ServerCog,
  CreditCard,
  Scale,
  Building2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  Map,
  FolderSearch,
  Activity,
  Hash,
  FileCheck,
  Download,
  Users,
  FileText,
  Cpu,
  Flag,
  Network,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Regulation {
  name: string;
  jurisdiction: string;
  region: "India" | "EU" | "US" | "Global" | "Other";
  icon: LucideIcon;
  badgeVariant: "cyan" | "purple" | "green" | "default" | "amber" | "dpdpa";
  articles: string;
  automationLevel: number;
}

const REGULATIONS: Regulation[] = [
  // India (DPDPA-first positioning)
  { name: "DPDPA", jurisdiction: "India", region: "India", icon: Fingerprint, badgeVariant: "dpdpa", articles: "Sections 4-17, 27-29 mapped", automationLevel: 87 },
  { name: "SEBI CSCRF", jurisdiction: "India · Capital Markets", region: "India", icon: Building2, badgeVariant: "amber", articles: "Cybersecurity & Resilience Framework", automationLevel: 84 },
  { name: "RBI Guidelines", jurisdiction: "India · Banking", region: "India", icon: Landmark, badgeVariant: "amber", articles: "Cybersecurity & Data Localisation", automationLevel: 82 },
  // EU
  { name: "GDPR", jurisdiction: "European Union", region: "EU", icon: Globe, badgeVariant: "purple", articles: "Articles 5-49 fully mapped", automationLevel: 94 },
  { name: "EU AI Act", jurisdiction: "European Union", region: "EU", icon: Cpu, badgeVariant: "purple", articles: "Articles 6-15, 50-56 (high-risk AI)", automationLevel: 78 },
  { name: "NIS2", jurisdiction: "European Union", region: "EU", icon: Network, badgeVariant: "purple", articles: "Articles 20-23 (governance & reporting)", automationLevel: 81 },
  // US
  { name: "CCPA / CPRA", jurisdiction: "California, US", region: "US", icon: Scale, badgeVariant: "cyan", articles: "Sections 1798.100-1798.199", automationLevel: 91 },
  { name: "HIPAA", jurisdiction: "US Healthcare", region: "US", icon: Heart, badgeVariant: "cyan", articles: "164.302-164.318 Security Rule", automationLevel: 89 },
  { name: "HITECH", jurisdiction: "US Healthcare", region: "US", icon: ShieldCheck, badgeVariant: "cyan", articles: "Subtitle D · Breach Notification", automationLevel: 86 },
  { name: "PCI DSS", jurisdiction: "Global Payments", region: "US", icon: CreditCard, badgeVariant: "cyan", articles: "All 12 requirements (v4.0)", automationLevel: 88 },
  { name: "FedRAMP", jurisdiction: "US Federal", region: "US", icon: Flag, badgeVariant: "cyan", articles: "Moderate baseline · 325 controls", automationLevel: 76 },
  // Global standards
  { name: "ISO 27001", jurisdiction: "International", region: "Global", icon: ShieldCheck, badgeVariant: "green", articles: "Annex A · 93 controls", automationLevel: 92 },
  { name: "ISO 27701", jurisdiction: "International", region: "Global", icon: Lock, badgeVariant: "green", articles: "PIMS extension · 49 controls", automationLevel: 85 },
  { name: "SOC 2 Type II", jurisdiction: "International", region: "Global", icon: ServerCog, badgeVariant: "green", articles: "All 5 Trust Service Criteria", automationLevel: 95 },
  // Other regions
  { name: "LGPD", jurisdiction: "Brazil", region: "Other", icon: Globe, badgeVariant: "default", articles: "Articles 6, 18, 33, 46-47", automationLevel: 86 },
  { name: "POPIA", jurisdiction: "South Africa", region: "Other", icon: Globe, badgeVariant: "default", articles: "8 Conditions for Processing", automationLevel: 80 },
  { name: "PIPL", jurisdiction: "China", region: "Other", icon: Globe, badgeVariant: "default", articles: "Articles 13-29, 38-43", automationLevel: 74 },
  { name: "PDPA", jurisdiction: "Singapore", region: "Other", icon: Globe, badgeVariant: "default", articles: "9 Data Protection Obligations", automationLevel: 83 },
];

const DPDPA_FEATURES = [
  {
    icon: CheckCircle2,
    title: "Consent Manager",
    section: "Section 6",
    description:
      "Granular, purpose-bound consent capture with cryptographic withdrawal proof. Per-purpose receipts, timestamped revocations, and a full consent ledger ready for audit.",
  },
  {
    icon: Users,
    title: "Data Principal Rights",
    section: "Sections 11-14",
    description:
      "Automated DSAR fulfillment for access, correction, erasure, and grievance — with fail-closed redaction and SLA tracking baked in. No spreadsheet juggling.",
  },
  {
    icon: ShieldCheck,
    title: "Significant Data Fiduciary",
    section: "Section 10",
    description:
      "DPIA automation, DPO workflows, periodic audit packs, and independent data auditor evidence — every SDF obligation handled in one place.",
  },
  {
    icon: Globe,
    title: "Cross-Border Transfer",
    section: "Section 16",
    description:
      "Country whitelist enforcement, transfer audit trails, and automated blocking when data attempts to flow to a non-permitted jurisdiction.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: Map,
    step: "01",
    title: "Map Controls",
    description:
      "Auto-map platform controls to regulation requirements across DPDPA sections, GDPR articles, HIPAA rules, and more. Mapping tables stay current as regulations evolve.",
    glowColor: "cyan" as const,
    points: ["Pre-built crosswalks", "Custom control mapping", "Versioned regulation library"],
  },
  {
    icon: FolderSearch,
    step: "02",
    title: "Collect Evidence",
    description:
      "Continuous evidence gathering from audit logs, configurations, and scan results. Replace screenshot-chasing with cryptographically signed evidence packets.",
    glowColor: "purple" as const,
    points: ["Audit log streaming", "Config snapshots", "Scan result archival"],
  },
  {
    icon: Activity,
    step: "03",
    title: "Monitor & Report",
    description:
      "Real-time drift detection, scheduled executive reports, and one-click auditor exports. Know the moment a control fails — and prove the moment it was fixed.",
    glowColor: "green" as const,
    points: ["Drift alerting", "Exec PDF reports", "Auditor evidence packs"],
  },
];

const AUDIT_FEATURES = [
  {
    icon: Hash,
    title: "SHA-256 Hash Chain Audit Log",
    description: "Every event linked via SHA-256 hash chain — a tamper-evident, cryptographically verifiable ledger of every privacy and security action.",
  },
  {
    icon: FileCheck,
    title: "Tamper-Evident Logs",
    description: "Append-only storage with integrity verification. Any modification is instantly detectable and surfaced as a critical compliance finding.",
  },
  {
    icon: Download,
    title: "One-Click Evidence Export",
    description: "Generate complete, auditor-ready evidence packages in PDF, CSV, and structured JSON — bundled by framework, scoped to date ranges.",
  },
  {
    icon: FileText,
    title: "Auditor-Friendly Report Templates",
    description: "30+ pre-formatted templates aligned to each regulation's structure. Auditors get exactly what they expect, in the format they expect it.",
  },
];

const RECENT_EVENTS = [
  { time: "12:04", text: "DPDPA Section 6 consent receipt issued for principal #DP-29841", level: "info" as const },
  { time: "11:47", text: "GDPR Article 32 control passed: encryption at rest verified across 412 buckets", level: "ok" as const },
  { time: "11:02", text: "Drift detected: SOC 2 CC6.1 — 1 IAM role missing MFA enforcement", level: "warn" as const },
  { time: "10:33", text: "HIPAA evidence pack exported · 3,184 audit events · SHA-256 verified", level: "ok" as const },
  { time: "09:58", text: "Cross-border transfer blocked: PIPL whitelist violation on /exports/cn-2", level: "warn" as const },
];

const REGION_LABELS: Record<Regulation["region"], string> = {
  India: "India",
  EU: "Europe",
  US: "United States",
  Global: "Global Standards",
  Other: "Other Regions",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompliancePage() {
  const groupedRegs = (Object.keys(REGION_LABELS) as Regulation["region"][]).map((region) => ({
    region,
    label: REGION_LABELS[region],
    items: REGULATIONS.filter((r) => r.region === region),
  }));

  return (
    <main className="relative overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────
          1. HERO
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 dot-bg" />

        <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-4">
              Compliance Automation
            </div>
            <Badge variant="dpdpa" className="mb-6">
              DPDPA-Ready · GDPR · HIPAA · 13+ Frameworks
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6 text-balance">
              Continuous compliance.{" "}
              <span className="gradient-text">Cryptographic proof.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
              Replace spreadsheet audits with real-time compliance posture across 16+ global frameworks.
              From India&apos;s DPDPA to EU&apos;s AI Act — automated mapping, evidence collection, and
              audit-ready reports.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="gradient" size="xl" asChild>
                <Link href="#dashboard" className="gap-2">
                  See Live Compliance Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/resources/coverage-matrix">Download Coverage Matrix</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          2. DPDPA SPOTLIGHT
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="featured" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5" />
        <div className="relative">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center mb-14">
              <Badge variant="dpdpa" className="mb-6">
                <Flag className="h-3 w-3 mr-1.5" /> India · DPDPA Day-1
              </Badge>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
                Built for{" "}
                <span className="gradient-text-amber">DPDPA Day-1.</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
                India&apos;s Digital Personal Data Protection Act enforcement is here.
                TechD is ready — with consent ledgers, principal-rights workflows, SDF tooling,
                and cross-border controls aligned to every section that matters.
              </p>
            </div>
          </AnimatedSection>

          <StaggerContainer className="grid gap-6 sm:grid-cols-2">
            {DPDPA_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <StaggerItem key={feat.title}>
                  <div className="group relative h-full rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.04] to-amber-500/[0.02] p-7 card-hover">
                    <div className="flex items-start gap-4">
                      <div className="flex-none rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
                        <Icon className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{feat.title}</h3>
                          <span className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300 px-2 py-0.5">
                            {feat.section}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          <AnimatedSection delay={0.2}>
            <div className="mt-12 text-center">
              <Button variant="gradient" size="lg" asChild>
                <Link href="/resources/dpdpa-readiness" className="gap-2">
                  Download DPDPA Readiness Guide <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          3. REGULATION GRID
         ───────────────────────────────────────────────────────────────── */}
      <Section pattern="grid">
        <SectionHeader
          eyebrow="Coverage"
          title="Sixteen frameworks."
          titleGradient="Continuously monitored."
          description="Pre-built control mappings, automated evidence collection, and continuous monitoring for every major data protection regulation — grouped by jurisdiction."
        />

        <div className="space-y-12">
          {groupedRegs.map((group) => (
            <AnimatedSection key={group.region}>
              <div className="mb-5 flex items-center gap-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {group.label}
                </h3>
                <div className="h-px flex-1 divider-gradient" />
                <span className="text-xs text-muted-foreground">
                  {group.items.length} {group.items.length === 1 ? "framework" : "frameworks"}
                </span>
              </div>

              <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((reg) => {
                  const RegIcon = reg.icon;
                  return (
                    <StaggerItem key={reg.name}>
                      <Card className="h-full card-hover">
                        <CardHeader>
                          <div className="flex items-start justify-between mb-3">
                            <div
                              className={cn(
                                "inline-flex rounded-lg border p-2.5",
                                reg.badgeVariant === "dpdpa"
                                  ? "border-orange-500/30 bg-orange-500/10"
                                  : "border-primary/20 bg-primary/5",
                              )}
                            >
                              <RegIcon
                                className={cn(
                                  "h-5 w-5",
                                  reg.badgeVariant === "dpdpa" ? "text-orange-400" : "text-primary",
                                )}
                              />
                            </div>
                            <Badge variant={reg.badgeVariant} className="text-[10px]">
                              {reg.jurisdiction}
                            </Badge>
                          </div>
                          <CardTitle>{reg.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground mb-4 font-mono">
                            {reg.articles}
                          </p>

                          <div className="pt-3 border-t border-border">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">Automation Level</span>
                              <span className="font-semibold text-foreground">
                                {reg.automationLevel}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className={cn(
                                  "h-full rounded-full",
                                  reg.badgeVariant === "dpdpa"
                                    ? "bg-gradient-to-r from-orange-500 to-amber-400"
                                    : "bg-gradient-to-r from-primary to-cyan-400",
                                )}
                                initial={{ width: 0 }}
                                whileInView={{ width: `${reg.automationLevel}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </StaggerItem>
                  );
                })}
              </StaggerContainer>
            </AnimatedSection>
          ))}
        </div>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          4. REGULATION RIBBON
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="muted">
        <AnimatedSection>
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              All frameworks · One platform · Continuous evidence
            </p>
          </div>
          <RegulationRibbon />
        </AnimatedSection>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          5. COMPLIANCE DASHBOARD MOCKUP
         ───────────────────────────────────────────────────────────────── */}
      <Section id="dashboard" variant="radial">
        <SectionHeader
          eyebrow="Live Posture"
          title="Real-time posture."
          titleGradient="Real-time proof."
          description="A single pane of glass for your entire compliance programme — every framework, every control, every evidence packet."
        />

        <AnimatedSection>
          <div className="mx-auto max-w-5xl rounded-2xl glass-card-elevated p-6 lg:p-8">
            {/* Top toolbar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  techd.io / compliance / dashboard
                </span>
              </div>
              <Badge variant="live" className="text-[10px]">
                Live
              </Badge>
            </div>

            {/* Top metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Overall Score", value: "94%", icon: TrendingUp, color: "text-emerald-400", ring: "border-emerald-500/30 bg-emerald-500/5" },
                { label: "Frameworks Active", value: "16", icon: Shield, color: "text-primary", ring: "border-primary/30 bg-primary/5" },
                { label: "Open Findings", value: "7", icon: AlertTriangle, color: "text-amber-400", ring: "border-amber-500/30 bg-amber-500/5" },
                { label: "Days to Audit", value: "14", icon: CalendarClock, color: "text-cyan-400", ring: "border-cyan-500/30 bg-cyan-500/5" },
              ].map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={cn("rounded-xl border p-4", stat.ring)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </p>
                      <StatIcon className={cn("h-4 w-4", stat.color)} />
                    </div>
                    <p className={cn("font-display text-3xl font-bold", stat.color)}>
                      {stat.value}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Per-framework score bars */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold">Per-Framework Posture</h4>
                <span className="text-[11px] text-muted-foreground">Updated 12s ago</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: "GDPR", score: 92, tone: "from-purple-500 to-fuchsia-400" },
                  { name: "DPDPA", score: 87, tone: "from-orange-500 to-amber-400" },
                  { name: "HIPAA", score: 89, tone: "from-cyan-500 to-sky-400" },
                  { name: "SOC 2 Type II", score: 95, tone: "from-emerald-500 to-teal-400" },
                  { name: "ISO 27001", score: 92, tone: "from-emerald-500 to-cyan-400" },
                  { name: "PCI DSS", score: 88, tone: "from-blue-500 to-cyan-400" },
                  { name: "EU AI Act", score: 78, tone: "from-purple-500 to-violet-400" },
                ].map((fw) => (
                  <div key={fw.name} className="flex items-center gap-4">
                    <span className="w-32 text-sm font-medium shrink-0">{fw.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full bg-gradient-to-r", fw.tone)}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${fw.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">
                      {fw.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent events feed */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold">Recent Compliance Events</h4>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Stream · live
                </span>
              </div>
              <ul className="space-y-2.5 font-mono text-xs">
                {RECENT_EVENTS.map((evt, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {evt.time}
                    </span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                        evt.level === "ok" && "bg-emerald-400",
                        evt.level === "warn" && "bg-amber-400",
                        evt.level === "info" && "bg-cyan-400",
                      )}
                    />
                    <span className="text-foreground/90 leading-relaxed">{evt.text}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          6. HOW IT WORKS
         ───────────────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeader
          eyebrow="Process"
          title="From policy to"
          titleGradient="provable compliance."
          description="Three steps. No spreadsheets. No screenshot folders. No fire-drill audit weeks."
        />

        <StaggerContainer className="grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step) => {
            const StepIcon = step.icon;
            return (
              <StaggerItem key={step.title}>
                <div className="relative h-full rounded-2xl border border-border bg-card p-7 card-hover">
                  <div className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30">
                    {step.step}
                  </div>
                  <div
                    className={cn(
                      "mb-4 inline-flex rounded-xl border p-3",
                      step.glowColor === "cyan" && "border-cyan-500/30 bg-cyan-500/10",
                      step.glowColor === "purple" && "border-purple-500/30 bg-purple-500/10",
                      step.glowColor === "green" && "border-emerald-500/30 bg-emerald-500/10",
                    )}
                  >
                    <StepIcon
                      className={cn(
                        "h-5 w-5",
                        step.glowColor === "cyan" && "text-cyan-400",
                        step.glowColor === "purple" && "text-purple-400",
                        step.glowColor === "green" && "text-emerald-400",
                      )}
                    />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {step.description}
                  </p>
                  <ul className="space-y-1.5 pt-4 border-t border-border/60">
                    {step.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          7. AUDIT-READY EVIDENCE
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="emerald" pattern="dots">
        <SectionHeader
          eyebrow="Audit Trail"
          title="Audit prep that used to take "
          titleGradient="months, now takes minutes."
          description="Cryptographically verifiable evidence trails that auditors trust. Every action recorded, every record immutable, every export reproducible."
        />

        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          {AUDIT_FEATURES.map((feat) => (
            <StaggerItem key={feat.title}>
              <IconCard
                icon={feat.icon}
                title={feat.title}
                description={feat.description}
                glowColor="green"
              />
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection>
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent p-8 lg:p-10">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCounter
                value={8000}
                suffix="+"
                label="Evidence Items"
                description="Auto-collected per quarter, per framework"
              />
              <MetricCounter
                value={16}
                label="Frameworks Mapped"
                description="DPDPA, GDPR, HIPAA, SOC 2 + 12 more"
              />
              <MetricCounter
                value={30}
                suffix="+"
                label="Report Templates"
                description="Auditor-ready PDFs out of the box"
              />
              <MetricCounter
                value={30}
                suffix=" days"
                label="Demo to Audit"
                description="From kickoff to production-ready evidence"
              />
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="mt-10 mx-auto max-w-2xl rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-center">
            <Lock className="h-6 w-6 text-cyan-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every audit event is linked via{" "}
              <span className="font-mono text-cyan-400">SHA-256</span> hash chain, creating a
              tamper-evident, cryptographically verifiable log. Export complete evidence
              packages in one click for any supported regulation.
            </p>
          </div>
        </AnimatedSection>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          8. CTA
         ───────────────────────────────────────────────────────────────── */}
      <CTASection
        title="Prove compliance,"
        titleGradient="don't just promise it."
        description="Replace manual evidence collection with automated, continuous compliance monitoring across every regulation that matters to your business — starting with DPDPA Day-1."
        primaryCta="Book a Compliance Demo"
        primaryHref="/contact"
        secondaryCta="View Coverage Matrix"
        secondaryHref="/resources/coverage-matrix"
      />
    </main>
  );
}
