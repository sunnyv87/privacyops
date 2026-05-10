"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import { CTASection } from "@/components/shared/cta-section";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/animated-section";
import { DataGraphVisual } from "@/components/shared/data-graph-visual";
import { AttackPathFlow } from "@/components/shared/attack-path-flow";
import { CompareTable } from "@/components/shared/compare-table";
import { MetricCounter } from "@/components/shared/metric-counter";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Tags,
  GitBranch,
  Users,
  EyeOff,
  Route,
  Crosshair,
  Gauge,
  Wrench,
  Radar,
  RefreshCw,
  ShieldCheck,
  Database,
  ScanSearch,
  Map as MapIcon,
  Activity,
  Lock,
  Trash2,
  EyeIcon,
  AlertTriangle,
  RotateCw,
  Share2,
  Globe,
  HardDrive,
  Zap,
  BookOpen,
  Hand,
  ChevronRight,
  Layers,
  Network,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  KeyRound,
  Sparkles,
  Workflow,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  1. HERO                                                            */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden pt-28 pb-20">
      <div className="absolute inset-0 radial-hero" />
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-1/4 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="absolute bottom-0 -right-40 h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="mb-6">
              <Badge variant="cyan">Data Security Posture Management</Badge>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-balance mb-6">
              See <span className="gradient-text">every risk</span>.
              <br />
              Stop <span className="gradient-text">every path</span>.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed text-pretty mb-10">
              DSPM that reveals the unknown — shadow data, misconfigured
              access, exploitable paths to your crown-jewel data. Then closes
              the gap automatically.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Button variant="gradient" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  See Live Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="#compare">Compare DSPM Platforms</Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                43+ Connectors
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                12 Native Actions
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Hash-chained audit
              </Badge>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="rounded-2xl border border-border/60 glass-card-elevated p-6 lg:p-8 overflow-hidden">
              <div className="absolute inset-0 grid-bg-dense opacity-30" />
              <div className="relative">
                <DataGraphVisual />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2. THE PROBLEM                                                     */
/* ------------------------------------------------------------------ */
const problems = [
  {
    icon: EyeOff,
    title: "Shadow Data",
    description:
      "60-80% of cloud data is unknown and unmanaged. Every undiscovered store is a regulatory and breach risk waiting to happen.",
    accent: "amber",
  },
  {
    icon: KeyRound,
    title: "Access Sprawl",
    description:
      "Service accounts and stale permissions create hidden attack paths. Most orgs can't answer who has access to crown-jewel data.",
    accent: "orange",
  },
  {
    icon: ShieldAlert,
    title: "Reactive Security",
    description:
      "Traditional DLP and SIEM tools alert AFTER a breach. DSPM prevents — by closing the misconfiguration before it becomes an incident.",
    accent: "red",
  },
];

const problemAccentMap: Record<string, { bg: string; ring: string; text: string }> = {
  amber: {
    bg: "bg-amber-500/10",
    ring: "border-amber-500/30",
    text: "text-amber-400",
  },
  orange: {
    bg: "bg-orange-500/10",
    ring: "border-orange-500/30",
    text: "text-orange-400",
  },
  red: {
    bg: "bg-red-500/10",
    ring: "border-red-500/30",
    text: "text-red-400",
  },
};

function ProblemSection() {
  return (
    <Section pattern="grid">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <Badge variant="amber" className="mb-6">
          The Problem
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance font-display">
          Your data perimeter is{" "}
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
            invisible.
          </span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
          The hardest part of data security isn't fixing what you can see.
          It's finding what you can't.
        </p>
      </div>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {problems.map((p) => {
          const a = problemAccentMap[p.accent];
          return (
            <StaggerItem key={p.title}>
              <div
                className={`relative rounded-xl border ${a.ring} glass-card p-7 h-full card-hover`}
              >
                <div
                  className={`inline-flex rounded-lg border ${a.ring} ${a.bg} p-3 mb-5`}
                >
                  <p.icon className={`h-6 w-6 ${a.text}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3 font-display">
                  {p.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  3. 12 CAPABILITIES GRID                                            */
/* ------------------------------------------------------------------ */
const capabilities = [
  {
    icon: Search,
    title: "Data Discovery",
    description:
      "Automated scanning across 43+ connectors to find every data store — structured, unstructured, cloud, SaaS, on-prem.",
    glowColor: "cyan" as const,
  },
  {
    icon: Tags,
    title: "Classification",
    description:
      "AI-powered PII, PHI, PCI detection with confidence scoring. 200+ built-in identifiers, multi-language, custom types.",
    glowColor: "purple" as const,
  },
  {
    icon: GitBranch,
    title: "Data Graph Intelligence",
    description:
      "Relationship mapping between data, identities, and access. Visualize how sensitive data connects across infrastructure.",
    glowColor: "blue" as const,
  },
  {
    icon: Users,
    title: "Identity-to-Data Access",
    description:
      "Understand who has access to what. Map permissions, roles, and sharing across every connected system.",
    glowColor: "green" as const,
  },
  {
    icon: EyeOff,
    title: "Shadow Data Detection",
    description:
      "Find unknown and unmanaged data stores that fall outside your security perimeter. Eliminate blind spots.",
    glowColor: "purple" as const,
  },
  {
    icon: Route,
    title: "Sensitive Data Lineage",
    description:
      "Track data flow and transformations from origin to destination. Understand replication and downstream exposure.",
    glowColor: "cyan" as const,
  },
  {
    icon: Crosshair,
    title: "Attack Path Analysis",
    description:
      "Identify exploitable paths to sensitive data. Model attacker perspective and prioritize what actually matters.",
    glowColor: "blue" as const,
  },
  {
    icon: Gauge,
    title: "Risk Scoring Engine",
    description:
      "Contextual scoring on sensitivity, exposure, compliance, and access. Dynamic scores reflect real-time posture.",
    glowColor: "green" as const,
  },
  {
    icon: Wrench,
    title: "Automated Remediation",
    description:
      "12 action types across 11 connector types. Native, catalog-update, and manual execution modes.",
    glowColor: "cyan" as const,
  },
  {
    icon: Radar,
    title: "Threat Hunting",
    description:
      "Proactive anomaly detection in data access patterns. Surface suspicious behavior before it becomes a breach.",
    glowColor: "purple" as const,
  },
  {
    icon: RefreshCw,
    title: "Adaptive Policies",
    description:
      "Dynamic policies that evolve with your data landscape. Auto-tune thresholds and rules based on observed patterns.",
    glowColor: "blue" as const,
  },
  {
    icon: ShieldCheck,
    title: "Security Validation",
    description:
      "Continuous verification of controls. Validate that encryption, access, and retention are applied correctly.",
    glowColor: "green" as const,
  },
];

function CapabilitiesSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="12 Modules"
        title=""
        titleGradient="Twelve capabilities."
        description="One platform. Every module works independently and as part of a unified system. No bolt-ons, no integration tax."
      />
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {capabilities.map((cap) => (
          <StaggerItem key={cap.title}>
            <IconCard
              icon={cap.icon}
              title={cap.title}
              description={cap.description}
              glowColor={cap.glowColor}
              className="h-full"
            />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  4. ATTACK PATH SHOWCASE                                            */
/* ------------------------------------------------------------------ */
const attackPathExplainers = [
  {
    icon: Globe,
    title: "Public asset detected",
    description:
      "An exposed S3 bucket or misconfigured endpoint is identified — the entry point a real attacker would target.",
    accent: "amber",
  },
  {
    icon: Network,
    title: "Path traced through 4 hops",
    description:
      "TechD walks the chain of permissions and trust relationships from the public asset to your most sensitive data.",
    accent: "orange",
  },
  {
    icon: Wrench,
    title: "Automated remediation queued",
    description:
      "Revoke access, rotate keys, or restrict sharing — the right action is queued with full audit trail and rollback.",
    accent: "emerald",
  },
];

const explainerAccentMap: Record<string, { bg: string; ring: string; text: string }> = {
  amber: {
    bg: "bg-amber-500/10",
    ring: "border-amber-500/30",
    text: "text-amber-400",
  },
  orange: {
    bg: "bg-orange-500/10",
    ring: "border-orange-500/30",
    text: "text-orange-400",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    ring: "border-emerald-500/30",
    text: "text-emerald-400",
  },
};

function AttackPathSection() {
  return (
    <Section variant="radial">
      <SectionHeader
        eyebrow="Signature Differentiator"
        badge="Attack Path Analysis"
        badgeVariant="cyan"
        title=""
        titleGradient="Attack path analysis"
        description="See how attackers reach your data. TechD traces the chain of permissions and exposures from any public asset to your most sensitive data."
      />

      <AnimatedSection>
        <div className="rounded-2xl border border-border/60 glass-card-elevated p-6 lg:p-10 mb-12 overflow-hidden">
          <div className="absolute inset-0 grid-bg-dense opacity-30 pointer-events-none" />
          <div className="relative">
            <AttackPathFlow />
          </div>
        </div>
      </AnimatedSection>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {attackPathExplainers.map((e, i) => {
          const a = explainerAccentMap[e.accent];
          return (
            <StaggerItem key={e.title}>
              <div className="relative rounded-xl border border-border/60 glass-card p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`inline-flex rounded-lg border ${a.ring} ${a.bg} p-2.5`}
                  >
                    <e.icon className={`h-5 w-5 ${a.text}`} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    STAGE {i + 1}
                  </span>
                </div>
                <h3 className="text-base font-semibold mb-2">{e.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {e.description}
                </p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  5. REMEDIATION ENGINE                                              */
/* ------------------------------------------------------------------ */
const executionModes = [
  {
    title: "Native",
    subtitle: "Automated Execution",
    description:
      "Direct API calls to the target system. Fully automated with rollback. Applied in real time with audit trail.",
    icon: Zap,
    color: "cyan" as const,
  },
  {
    title: "Catalog Update",
    subtitle: "Metadata Sync",
    description:
      "Updates the data catalog and governance metadata. Flags findings for downstream tooling without modifying source systems.",
    icon: BookOpen,
    color: "purple" as const,
  },
  {
    title: "Manual",
    subtitle: "Guided Workflows",
    description:
      "Step-by-step instructions for actions requiring human review. Pre-built runbooks, approval flows, completion tracking.",
    icon: Hand,
    color: "green" as const,
  },
];

const modeColorMap = {
  cyan: { bg: "bg-cyan-500/10", ring: "border-cyan-500/20", text: "text-cyan-400" },
  purple: {
    bg: "bg-purple-500/10",
    ring: "border-purple-500/20",
    text: "text-purple-400",
  },
  green: {
    bg: "bg-emerald-500/10",
    ring: "border-emerald-500/20",
    text: "text-emerald-400",
  },
};

const remediationActions = [
  {
    action: "revoke_access",
    label: "Revoke Access",
    icon: Lock,
    mode: "Native",
    connectors: "AWS · Azure · GCP · Okta",
  },
  {
    action: "encrypt",
    label: "Encrypt",
    icon: ShieldCheck,
    mode: "Native",
    connectors: "S3 · Blob · GCS · DBs",
  },
  {
    action: "enable_mfa",
    label: "Enable MFA",
    icon: Users,
    mode: "Native",
    connectors: "Okta · Azure AD",
  },
  {
    action: "apply_retention",
    label: "Apply Retention",
    icon: RefreshCw,
    mode: "Native",
    connectors: "Snowflake · BigQuery · S3",
  },
  {
    action: "restrict_public",
    label: "Restrict Public",
    icon: Globe,
    mode: "Native",
    connectors: "S3 · Blob · GCS",
  },
  {
    action: "delete_data",
    label: "Delete Data",
    icon: Trash2,
    mode: "Manual",
    connectors: "All connectors",
  },
  {
    action: "mask_data",
    label: "Mask Data",
    icon: EyeIcon,
    mode: "Native",
    connectors: "Snowflake · Postgres · MySQL",
  },
  {
    action: "quarantine",
    label: "Quarantine",
    icon: AlertTriangle,
    mode: "Catalog Update",
    connectors: "All connectors",
  },
  {
    action: "rotate_credentials",
    label: "Rotate Credentials",
    icon: RotateCw,
    mode: "Native",
    connectors: "AWS · Azure · GCP",
  },
  {
    action: "restrict_sharing",
    label: "Restrict Sharing",
    icon: Share2,
    mode: "Native",
    connectors: "Salesforce · Okta · Drive",
  },
  {
    action: "disable_public_access",
    label: "Disable Public Access",
    icon: Globe,
    mode: "Native",
    connectors: "S3 · Blob · GCS",
  },
  {
    action: "enforce_encryption",
    label: "Enforce Encryption",
    icon: HardDrive,
    mode: "Native",
    connectors: "All databases",
  },
];

function RemediationSection() {
  return (
    <Section>
      <SectionHeader
        badge="Remediation Engine"
        title="Remediation isn't a recommendation."
        titleGradient="It's automated."
        description="12 action types. 3 execution modes. Every remediation is auditable, reversible, and policy-governed."
      />

      <AnimatedSection>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-14">
          {executionModes.map((mode) => {
            const c = modeColorMap[mode.color];
            return (
              <div
                key={mode.title}
                className="rounded-xl border border-border/60 glass-card p-7 card-hover"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={`inline-flex rounded-lg border ${c.ring} ${c.bg} p-2.5`}>
                    <mode.icon className={`h-5 w-5 ${c.text}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{mode.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {mode.subtitle}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {mode.description}
                </p>
              </div>
            );
          })}
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.15}>
        <div className="rounded-xl border border-border/60 glass-card-elevated overflow-hidden">
          <div className="grid grid-cols-12 gap-px bg-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-4 bg-card px-5 py-4">Action</div>
            <div className="col-span-3 bg-card px-5 py-4">Description</div>
            <div className="col-span-2 bg-card px-5 py-4">Mode</div>
            <div className="col-span-3 bg-card px-5 py-4">Connectors</div>
          </div>
          {remediationActions.map((item) => (
            <div
              key={item.action}
              className="grid grid-cols-12 gap-px bg-border/60 text-sm hover:bg-muted/30 transition-colors"
            >
              <div className="col-span-4 bg-card px-5 py-4 flex items-center gap-2.5">
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="text-xs font-mono text-primary/90">
                  {item.action}
                </code>
              </div>
              <div className="col-span-3 bg-card px-5 py-4 text-muted-foreground">
                {item.label}
              </div>
              <div className="col-span-2 bg-card px-5 py-4">
                <Badge
                  variant={
                    item.mode === "Native"
                      ? "cyan"
                      : item.mode === "Catalog Update"
                      ? "purple"
                      : "green"
                  }
                >
                  {item.mode}
                </Badge>
              </div>
              <div className="col-span-3 bg-card px-5 py-4 text-xs text-muted-foreground">
                {item.connectors}
              </div>
            </div>
          ))}
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  6. RISK INTELLIGENCE                                               */
/* ------------------------------------------------------------------ */
const riskFactors = [
  {
    factor: "Sensitivity",
    icon: Layers,
    description:
      "Classification level, data type, and volume of sensitive records (PII, PHI, PCI).",
    weight: "Critical",
    color: "text-red-400",
  },
  {
    factor: "Exposure",
    icon: Globe,
    description:
      "Public access, overprivileged users, misconfigured sharing, third-party connections.",
    weight: "High",
    color: "text-orange-400",
  },
  {
    factor: "Compliance Impact",
    icon: ShieldCheck,
    description:
      "DPDPA, GDPR, HIPAA, PCI-DSS, SOX — regulatory weight applied per finding.",
    weight: "High",
    color: "text-amber-400",
  },
  {
    factor: "Access Patterns",
    icon: Activity,
    description:
      "Anomalous behavior, excessive access, dormant permissions, off-hours queries.",
    weight: "Medium",
    color: "text-cyan-400",
  },
];

function RiskIntelligenceSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Risk Intelligence"
        title=""
        titleGradient="Context-aware risk scoring."
        description="Every finding scored against four contextual factors. Prioritize what matters based on real-world risk, not severity labels alone."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <StaggerContainer className="space-y-5">
          {riskFactors.map((factor) => (
            <StaggerItem key={factor.factor}>
              <div className="rounded-xl border border-border/60 glass-card p-5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-secondary/60 border border-border p-2.5 shrink-0">
                    <factor.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-base font-semibold">
                        {factor.factor}
                      </h3>
                      <span className={`text-xs font-medium ${factor.color}`}>
                        {factor.weight}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {factor.description}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection delay={0.15}>
          <div className="rounded-xl border border-border/60 glass-card-elevated p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Risk Matrix</h3>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                Sensitivity × Exposure
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="flex items-end justify-end pr-2 pb-1">
                <span className="text-[10px] text-muted-foreground font-mono">
                  EXPOSURE
                </span>
              </div>
              <div className="col-span-3 grid grid-cols-3 gap-2">
                <div className="text-center text-[10px] text-muted-foreground font-mono pb-1">
                  LOW
                </div>
                <div className="text-center text-[10px] text-muted-foreground font-mono pb-1">
                  MEDIUM
                </div>
                <div className="text-center text-[10px] text-muted-foreground font-mono pb-1">
                  HIGH
                </div>
              </div>

              <div className="flex items-center justify-end pr-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  HIGH
                </span>
              </div>
              <div className="h-16 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-yellow-400">
                  Medium
                </span>
              </div>
              <div className="h-16 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-orange-400">
                  High
                </span>
              </div>
              <div className="h-16 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-red-400">Critical</span>
              </div>

              <div className="flex items-center justify-end pr-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  MED
                </span>
              </div>
              <div className="h-16 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-emerald-400">
                  Low
                </span>
              </div>
              <div className="h-16 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-yellow-400">
                  Medium
                </span>
              </div>
              <div className="h-16 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-orange-400">
                  High
                </span>
              </div>

              <div className="flex items-center justify-end pr-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  LOW
                </span>
              </div>
              <div className="h-16 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-blue-400">Info</span>
              </div>
              <div className="h-16 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-emerald-400">
                  Low
                </span>
              </div>
              <div className="h-16 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                <span className="text-xs font-medium text-yellow-400">
                  Medium
                </span>
              </div>

              <div />
              <div className="col-span-3 text-center pt-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  SENSITIVITY
                </span>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  7. HOW IT WORKS                                                    */
/* ------------------------------------------------------------------ */
const flowSteps = [
  {
    step: "01",
    icon: Database,
    title: "Connect",
    description:
      "Deploy agentless connectors across cloud, SaaS, and on-prem. 43+ connectors with read-only access and zero performance impact.",
    color: "blue",
  },
  {
    step: "02",
    icon: ScanSearch,
    title: "Discover & Classify",
    description:
      "AI engine scans and classifies every asset. PII, PHI, PCI, and custom types with confidence scoring and multi-language support.",
    color: "cyan",
  },
  {
    step: "03",
    icon: MapIcon,
    title: "Map Access & Risk",
    description:
      "Build the data graph linking assets to identities, permissions, and access patterns. Generate contextual risk scores.",
    color: "purple",
  },
  {
    step: "04",
    icon: Activity,
    title: "Remediate & Monitor",
    description:
      "Execute automated remediations, enforce adaptive policies, and continuously monitor for drift. Close the loop with audit trails.",
    color: "emerald",
  },
];

const flowColorMap: Record<string, { ring: string; bg: string; text: string }> = {
  blue: {
    ring: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  cyan: {
    ring: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
  },
  purple: {
    ring: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
  },
  emerald: {
    ring: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
};

function HowItWorksSection() {
  return (
    <Section pattern="dots">
      <SectionHeader
        badge="How It Works"
        title="From connectors to"
        titleGradient="continuous protection."
        description="Four steps. Hours, not months. Every stage is observable, auditable, and reversible."
      />

      <AnimatedSection>
        <div className="relative">
          <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-blue-500/40 via-cyan-500/40 via-purple-500/40 to-emerald-500/40" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {flowSteps.map((s) => {
              const c = flowColorMap[s.color];
              return (
                <div key={s.step} className="relative text-center">
                  <div
                    className={`relative z-10 inline-flex items-center justify-center h-24 w-24 rounded-full border-2 ${c.ring} ${c.bg} mb-6 mx-auto bg-background`}
                  >
                    <s.icon className={`h-9 w-9 ${c.text}`} />
                  </div>
                  <span
                    className={`text-xs font-mono ${c.text} mb-2 block tracking-wider`}
                  >
                    STEP {s.step}
                  </span>
                  <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  8. WHY TECHD DSPM                                                  */
/* ------------------------------------------------------------------ */
const techDDifferentiators = [
  {
    icon: Crosshair,
    title: "Attack Path Analysis",
    description:
      "Trace exploitable paths from public asset to crown-jewel data. The signature differentiator from legacy DSPM.",
    glowColor: "blue" as const,
  },
  {
    icon: GitBranch,
    title: "Data Graph Intelligence",
    description:
      "Real-time graph of every relationship between data, identities, and permissions. The single source of truth.",
    glowColor: "cyan" as const,
  },
  {
    icon: Wrench,
    title: "12 Action Types",
    description:
      "Native, automated remediation across 11 connector types. Not recommendations — closed-loop fixes.",
    glowColor: "purple" as const,
  },
  {
    icon: Lock,
    title: "Hash-Chained Audit",
    description:
      "Tamper-evident audit log. Every remediation, every policy change, every access decision cryptographically chained.",
    glowColor: "green" as const,
  },
  {
    icon: Layers,
    title: "Multi-Tenant RLS",
    description:
      "60+ Postgres tables with row-level security enforcement. Zero cross-tenant data leakage by construction.",
    glowColor: "blue" as const,
  },
  {
    icon: Workflow,
    title: "Native Connectors",
    description:
      "43+ first-party connectors. No third-party dependency, no broker layer. Direct, observable, fast.",
    glowColor: "cyan" as const,
  },
];

const dspmCompareCategories = [
  {
    category: "Discovery & Visibility",
    rows: [
      {
        feature: "Data Graph Intelligence",
        values: ["yes", "partial", "yes", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Shadow Data Detection",
        values: ["yes", "partial", "partial", "partial"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "43+ Native Connectors",
        values: ["yes", "yes", "partial", "partial"] as ("yes" | "no" | "partial")[],
      },
    ],
  },
  {
    category: "Risk & Attack Paths",
    rows: [
      {
        feature: "Attack Path Analysis",
        values: ["yes", "no", "partial", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Contextual Risk Scoring",
        values: ["yes", "yes", "partial", "partial"] as ("yes" | "no" | "partial")[],
      },
    ],
  },
  {
    category: "Remediation",
    rows: [
      {
        feature: "12 Native Action Types",
        values: ["yes", "partial", "partial", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Hash-Chained Audit Log",
        values: ["yes", "no", "no", "partial"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Multi-Tenant RLS",
        values: ["yes", "partial", "no", "no"] as ("yes" | "no" | "partial")[],
      },
    ],
  },
];

function WhyTechDSection() {
  return (
    <Section variant="radial">
      <SectionHeader
        badge="Why TechD DSPM"
        title="Six differentiators."
        titleGradient="Zero compromises."
        description="Capabilities legacy DSPM can't match. Architectural decisions that show up as outcomes."
      />

      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {techDDifferentiators.map((d) => (
          <StaggerItem key={d.title}>
            <IconCard
              icon={d.icon}
              title={d.title}
              description={d.description}
              glowColor={d.glowColor}
              className="h-full"
            />
          </StaggerItem>
        ))}
      </StaggerContainer>

      <div id="compare">
        <AnimatedSection>
          <CompareTable
            competitors={["TechD", "OneTrust", "Redacto", "FOCTTA"]}
            categories={dspmCompareCategories}
          />
        </AnimatedSection>
      </div>

      <AnimatedSection delay={0.2}>
        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-xl border border-border/60 glass-card p-6 text-center">
            <MetricCounter value={43} suffix="+" label="Connectors" />
          </div>
          <div className="rounded-xl border border-border/60 glass-card p-6 text-center">
            <MetricCounter value={12} label="Action Types" />
          </div>
          <div className="rounded-xl border border-border/60 glass-card p-6 text-center">
            <MetricCounter value={60} suffix="+" label="RLS Tables" />
          </div>
          <div className="rounded-xl border border-border/60 glass-card p-6 text-center">
            <MetricCounter value={200} prefix="<" suffix="ms" label="P95 Latency" />
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function DSPMPage() {
  return (
    <main className="relative overflow-hidden">
      <HeroSection />
      <ProblemSection />
      <CapabilitiesSection />
      <AttackPathSection />
      <RemediationSection />
      <RiskIntelligenceSection />
      <HowItWorksSection />
      <WhyTechDSection />
      <CTASection
        title="See every risk."
        titleGradient="Stop every path."
        description="Deploy TechD DSPM across your data estate in hours. Discover the unknown, surface the exploitable, automate the fix."
        primaryCta="Book Enterprise Demo"
        primaryHref="/contact"
        secondaryCta="View All Connectors"
        secondaryHref="/connectors"
      />
    </main>
  );
}
