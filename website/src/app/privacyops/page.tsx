"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import { CTASection } from "@/components/shared/cta-section";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/animated-section";
import { LifecycleOrchestrator } from "@/components/shared/lifecycle-orchestrator";
import { MetricCounter } from "@/components/shared/metric-counter";
import { RegulationRibbon } from "@/components/shared/regulation-ribbon";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Fingerprint,
  FileSearch,
  Scale,
  ClipboardList,
  Timer,
  Building2,
  AlertTriangle,
  Brain,
  ChevronRight,
  UserCheck,
  Search,
  EyeOff,
  Gavel,
  FileCheck,
  Send,
  CheckCircle,
  ToggleLeft,
  Settings,
  XCircle,
  Globe,
  Database,
  KeyRound,
  Layers,
  Activity,
  Sparkles,
  Hash,
  FileDown,
  ShieldCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Module catalog (8 integrated PrivacyOps modules)
// ---------------------------------------------------------------------------
const modules = [
  {
    icon: Fingerprint,
    title: "Consent Management",
    description:
      "Purpose-bound consent, preference center, withdrawal automation, and cross-channel sync across web, mobile, email, and API.",
    glow: "purple" as const,
  },
  {
    icon: FileSearch,
    title: "DSAR Automation",
    description:
      "Identity verification, multi-connector data discovery, fail-closed redaction, and regulator-ready response assembly.",
    glow: "cyan" as const,
  },
  {
    icon: Scale,
    title: "DPIA / Privacy Risk",
    description:
      "Automated risk scoring, regulation-mapped recommendations, and evidence collection that survives auditor scrutiny.",
    glow: "blue" as const,
  },
  {
    icon: ClipboardList,
    title: "RoPA",
    description:
      "Records of Processing Activities auto-generated from live data flow analysis. No spreadsheets, no stale records.",
    glow: "green" as const,
  },
  {
    icon: Timer,
    title: "Retention Governance",
    description:
      "Policy enforcement via Temporal workflows with legal hold integration and verifiable cryptographic deletion proofs.",
    glow: "blue" as const,
  },
  {
    icon: Building2,
    title: "Vendor / Third-Party Risk",
    description:
      "Continuous vendor assessment, DPA tracking, and sub-processor monitoring with automated reassessment scheduling.",
    glow: "cyan" as const,
  },
  {
    icon: AlertTriangle,
    title: "Breach Management",
    description:
      "72-hour notification workflows, regulatory filing automation, and post-incident root-cause tracking in one console.",
    glow: "purple" as const,
  },
  {
    icon: Brain,
    title: "AI Governance",
    description:
      "Model inventory, training data lineage, bias monitoring, and explainability reports for every AI system you operate.",
    glow: "green" as const,
  },
];

// ---------------------------------------------------------------------------
// DSAR end-to-end workflow steps
// ---------------------------------------------------------------------------
const dsarSteps = [
  {
    icon: UserCheck,
    label: "Request Intake",
    description: "Web portal, email, or API with automatic categorization.",
  },
  {
    icon: Fingerprint,
    label: "Identity Verification",
    description: "Fuzzy matching across 12 PII patterns with assurance levels.",
  },
  {
    icon: Search,
    label: "Data Discovery",
    description: "Parallel scan across 43+ connectors in minutes, not weeks.",
  },
  {
    icon: EyeOff,
    label: "PII Redaction",
    description: "Fail-closed engine — blocks delivery on any redaction failure.",
  },
  {
    icon: Gavel,
    label: "Legal Hold Check",
    description: "Active hold detection with deletion blocking and audit trail.",
  },
  {
    icon: FileCheck,
    label: "Response Assembly",
    description: "Multi-format export with hash-chain proof of integrity.",
  },
  {
    icon: Send,
    label: "Delivery",
    description: "Regulation-specific response letters generated automatically.",
  },
];

// ---------------------------------------------------------------------------
// Consent capabilities + lifecycle steps
// ---------------------------------------------------------------------------
const consentCapabilities = [
  {
    icon: ToggleLeft,
    title: "Purpose-Bound Collection",
    desc: "Define consent purposes with legal basis mapping. Each purpose tracks granular opt-in state per data subject and per channel.",
  },
  {
    icon: Settings,
    title: "Preference Center",
    desc: "White-labeled preference center embeddable in any application. Granular channel, frequency, and category controls.",
  },
  {
    icon: XCircle,
    title: "Withdrawal Automation",
    desc: "Withdrawal triggers downstream cascades: deletion, processing cessation, third-party notification, and audit logging.",
  },
  {
    icon: Globe,
    title: "Cross-Channel Sync",
    desc: "Real-time consent state across web, mobile, email, and API via NATS event bus with deterministic conflict resolution.",
  },
];

const consentLifecycle = [
  { step: "Collect", detail: "Purpose, legal basis, and version captured." },
  { step: "Store", detail: "Immutable consent record written to ledger." },
  { step: "Enforce", detail: "Processing gated by real-time consent state." },
  { step: "Update", detail: "Preference updates ripple across all channels." },
  { step: "Audit", detail: "Full versioned history with timestamped proofs." },
];

// ---------------------------------------------------------------------------
// Regulation cards
// ---------------------------------------------------------------------------
const regulations = [
  {
    name: "DPDPA",
    region: "India",
    articles: "Data Principal Rights · Consent Manager · Data Fiduciary obligations",
    automation: "98%",
    badge: "dpdpa" as const,
    accent: "border-orange-500/30 bg-orange-500/[0.04] text-orange-300",
    iconAccent: "text-orange-400",
    isPrimary: true,
  },
  {
    name: "GDPR",
    region: "European Union",
    articles: "Art. 6, 7, 13–22, 25, 28, 30, 33–36",
    automation: "96%",
    badge: "default" as const,
    accent: "border-blue-500/30 bg-blue-500/[0.04] text-blue-300",
    iconAccent: "text-blue-400",
    isPrimary: false,
  },
  {
    name: "CCPA / CPRA",
    region: "California, USA",
    articles: "§ 1798.100–199 · Right to Delete, Opt-Out, Know, Correct",
    automation: "94%",
    badge: "cyan" as const,
    accent: "border-cyan-500/30 bg-cyan-500/[0.04] text-cyan-300",
    iconAccent: "text-cyan-400",
    isPrimary: false,
  },
  {
    name: "HIPAA",
    region: "US Healthcare",
    articles: "Privacy Rule · Security Rule · Breach Notification Rule",
    automation: "92%",
    badge: "purple" as const,
    accent: "border-purple-500/30 bg-purple-500/[0.04] text-purple-300",
    iconAccent: "text-purple-400",
    isPrimary: false,
  },
  {
    name: "LGPD",
    region: "Brazil",
    articles: "Art. 7–16 · Data Subject Rights · DPO requirements",
    automation: "93%",
    badge: "green" as const,
    accent: "border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-300",
    iconAccent: "text-emerald-400",
    isPrimary: false,
  },
];

// ---------------------------------------------------------------------------
// Hash-chained audit features
// ---------------------------------------------------------------------------
const auditFeatures = [
  {
    icon: Hash,
    title: "SHA-256 Hash Chain",
    desc: "Every audit event includes the SHA-256 hash of the previous event. Tampering with any record breaks the entire chain — and is detectable in milliseconds.",
    color: "purple" as const,
  },
  {
    icon: KeyRound,
    title: "Postgres Advisory Locks",
    desc: "Append operations are serialized via Postgres advisory locks. The chain stays mathematically consistent under concurrent writes from any module.",
    color: "blue" as const,
  },
  {
    icon: FileDown,
    title: "One-Click Evidence Export",
    desc: "Export regulator-ready evidence bundles with the full hash chain, public verification keys, and time-anchored proofs in a single click.",
    color: "cyan" as const,
  },
];

const colorMap: Record<
  "purple" | "blue" | "cyan" | "green",
  { border: string; bg: string; text: string; ring: string }
> = {
  purple: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    ring: "ring-purple-500/20",
  },
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    ring: "ring-blue-500/20",
  },
  cyan: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    ring: "ring-cyan-500/20",
  },
  green: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    ring: "ring-emerald-500/20",
  },
};

export default function PrivacyOpsPage() {
  return (
    <main className="relative overflow-hidden">
      {/* ------------------------------------------------------------------
          1. HERO — Privacy Operations, Orchestrated.
      -------------------------------------------------------------------*/}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left — copy */}
            <AnimatedSection>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-400 mb-4">
                PrivacyOps Suite
              </div>
              <Badge variant="purple" className="mb-6">
                8 Integrated Modules
              </Badge>
              <h1 className="font-display text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl mb-6 leading-[1.05]">
                <span className="gradient-text">Privacy Operations</span>,
                <br />
                Orchestrated.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground leading-relaxed mb-10 text-pretty">
                From consent collection to erasure certification — every privacy
                workflow automated, every regulation mapped, every action audit-ready.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button variant="gradient" size="xl" asChild>
                  <Link href="/contact" className="gap-2">
                    Book Demo <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="secondary" size="xl" asChild>
                  <Link href="#compliance">View Compliance Coverage</Link>
                </Button>
              </div>
            </AnimatedSection>

            {/* Right — privacy lifecycle preview card (NOT the orchestrator) */}
            <AnimatedSection delay={0.2}>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-cyan-500/20 blur-3xl opacity-60" />
                <div className="relative glass-card-elevated rounded-2xl p-6 lg:p-7">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-mono text-muted-foreground">
                        privacyops.live
                      </span>
                    </div>
                    <Badge variant="live" className="text-[10px]">
                      Live
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        icon: Fingerprint,
                        label: "Consent collected",
                        meta: "marketing · analytics",
                        color: "text-purple-400",
                        bg: "bg-purple-500/10",
                        border: "border-purple-500/30",
                      },
                      {
                        icon: FileSearch,
                        label: "DSAR auto-discovery",
                        meta: "43 connectors scanned",
                        color: "text-cyan-400",
                        bg: "bg-cyan-500/10",
                        border: "border-cyan-500/30",
                      },
                      {
                        icon: EyeOff,
                        label: "PII redaction passed",
                        meta: "12 patterns · fail-closed",
                        color: "text-blue-400",
                        bg: "bg-blue-500/10",
                        border: "border-blue-500/30",
                      },
                      {
                        icon: Hash,
                        label: "Audit chain extended",
                        meta: "SHA-256 · #00482a",
                        color: "text-emerald-400",
                        bg: "bg-emerald-500/10",
                        border: "border-emerald-500/30",
                      },
                    ].map((row, i) => (
                      <motion.div
                        key={row.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                      >
                        <div
                          className={`shrink-0 rounded-md border ${row.border} ${row.bg} p-2`}
                        >
                          <row.icon className={`h-4 w-4 ${row.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight">
                            {row.label}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                            {row.meta}
                          </p>
                        </div>
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-mono">
                      8 modules · 1 audit chain
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Healthy
                    </span>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ------------------------------------------------------------------
          2. LIFECYCLE ORCHESTRATOR (signature section)
      -------------------------------------------------------------------*/}
      <Section variant="radial" pattern="grid">
        <SectionHeader
          eyebrow="Lifecycle Orchestrator"
          badge="The signature workflow"
          badgeVariant="purple"
          title="The"
          titleGradient="full privacy lifecycle in one platform."
          description="Most tools cover one or two stages. TechD orchestrates every stage — from initial consent through erasure certification with cryptographic proof."
        />
        <AnimatedSection>
          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-cyan-500/10 blur-3xl opacity-70 pointer-events-none" />
            <div className="relative">
              <LifecycleOrchestrator />
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ------------------------------------------------------------------
          3. EIGHT MODULES GRID
      -------------------------------------------------------------------*/}
      <Section variant="muted">
        <SectionHeader
          badge="The PrivacyOps Suite"
          badgeVariant="cyan"
          title="Eight integrated modules."
          titleGradient="Zero handoffs."
          description="Each module shares a unified data model, workflow engine, and tamper-evident audit chain — so privacy operations stay coherent end-to-end."
        />
        <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <StaggerItem key={mod.title}>
              <IconCard
                icon={mod.icon}
                title={mod.title}
                description={mod.description}
                glowColor={mod.glow}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection delay={0.3}>
          <div className="mt-12 rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 shrink-0">
              <Layers className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1">
                One workflow engine. One data model. One audit chain.
              </p>
              <p className="text-sm text-muted-foreground">
                A withdrawal in Consent triggers downstream actions in DSAR,
                Retention, and Vendor modules — automatically and atomically.
                Nothing falls through the cracks.
              </p>
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ------------------------------------------------------------------
          4. DSAR DEEP DIVE — signature workflow
      -------------------------------------------------------------------*/}
      <Section pattern="grid-dense">
        <SectionHeader
          badge="DSAR Automation"
          badgeVariant="cyan"
          title="DSAR completion in"
          titleGradient="minutes, not months."
          description="A deterministic, fail-closed pipeline: identity verification, parallel data discovery, redaction, legal hold checks, and regulator-ready response — all chained, all audited."
        />

        <AnimatedSection>
          {/* Horizontal flow on desktop */}
          <div className="hidden lg:block">
            <div className="flex items-stretch gap-2">
              {dsarSteps.map((step, i) => (
                <div key={step.label} className="flex items-stretch flex-1">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="flex flex-col items-center text-center w-full"
                  >
                    <div className="rounded-xl border border-border bg-card p-4 w-full card-hover h-full flex flex-col">
                      <div className="mx-auto mb-3 inline-flex rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                        <step.icon className="h-5 w-5 text-cyan-400" />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/70 mb-1">
                        STEP {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="text-xs font-semibold mb-1">{step.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                  {i < dsarSteps.length - 1 && (
                    <div className="flex items-center pt-12 shrink-0 px-1">
                      <ChevronRight className="h-4 w-4 text-cyan-500/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vertical flow on mobile/tablet */}
          <div className="lg:hidden space-y-3">
            {dsarSteps.map((step, i) => (
              <div key={step.label}>
                <div className="flex gap-4 rounded-xl border border-border bg-card p-4 card-hover">
                  <div className="shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                    <step.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground/70">
                      STEP {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm font-semibold mb-0.5">{step.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                {i < dsarSteps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="h-3 w-px bg-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* DSAR metric counters */}
        <AnimatedSection delay={0.3}>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <MetricCounter
              value={94}
              suffix="%"
              label="DSAR Automation"
            />
            <MetricCounter
              value={30}
              suffix=" day"
              label="SLA Compliance"
            />
            <MetricCounter
              value={12}
              label="PII Patterns Detected"
            />
          </div>
        </AnimatedSection>
      </Section>

      {/* ------------------------------------------------------------------
          5. CONSENT MANAGEMENT DETAIL
      -------------------------------------------------------------------*/}
      <Section variant="muted">
        <SectionHeader
          badge="Consent Engine"
          badgeVariant="purple"
          title="Consent that"
          titleGradient="scales globally."
          description="Granular, purpose-driven consent with real-time preference synchronization across every channel — and an immutable audit trail underneath."
        />

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-start">
          {/* Left — capabilities */}
          <StaggerContainer className="space-y-4">
            {consentCapabilities.map((item) => (
              <StaggerItem key={item.title}>
                <div className="flex gap-4 rounded-xl border border-border bg-card p-5 card-hover">
                  <div className="shrink-0 rounded-lg border border-purple-500/20 bg-purple-500/10 p-2.5">
                    <item.icon className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-base font-semibold mb-1.5">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Right — 5-step lifecycle visualization */}
          <AnimatedSection delay={0.2}>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/15 to-blue-500/15 blur-3xl opacity-60 pointer-events-none" />
              <div className="relative rounded-2xl border border-border bg-card p-6 lg:p-7">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm font-semibold">Consent Lifecycle</p>
                  <Badge variant="purple" className="text-[10px]">
                    Real-time
                  </Badge>
                </div>
                <div className="space-y-2">
                  {consentLifecycle.map((item, i) => (
                    <div key={item.step}>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: i * 0.08 }}
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/15 ring-1 ring-purple-500/30 text-xs font-bold text-purple-300">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{item.step}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.detail}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-purple-400/50 shrink-0" />
                      </motion.div>
                      {i < consentLifecycle.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <div className="h-2 w-px bg-purple-500/30" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">
                    NATS event bus
                  </span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Signed & versioned
                  </span>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </Section>

      {/* ------------------------------------------------------------------
          6. COMPLIANCE AUTOMATION
      -------------------------------------------------------------------*/}
      <Section id="compliance" variant="radial">
        <SectionHeader
          badge="Regulation Coverage"
          badgeVariant="emerald"
          title="Every workflow,"
          titleGradient="automatically compliant."
          description="PrivacyOps modules ship with pre-built mappings for DPDPA, GDPR, CCPA/CPRA, HIPAA, and LGPD — compliance evidence is generated as you operate."
        />

        {/* Optional ribbon visual */}
        <AnimatedSection>
          <div className="mb-10">
            <RegulationRibbon />
          </div>
        </AnimatedSection>

        <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {regulations.map((reg) => (
            <StaggerItem key={reg.name}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className={`relative rounded-xl border bg-card p-6 card-hover h-full flex flex-col ${
                  reg.isPrimary ? "ring-1 ring-orange-500/30" : ""
                }`}
              >
                {reg.isPrimary && (
                  <div className="absolute -top-2 -right-2">
                    <Badge variant="dpdpa">Primary Market</Badge>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div className={`rounded-lg border p-2.5 ${reg.accent}`}>
                    <Shield className={`h-5 w-5 ${reg.iconAccent}`} />
                  </div>
                  <Badge variant={reg.badge}>{reg.name}</Badge>
                </div>
                <h3 className="text-xl font-semibold mb-1">{reg.name}</h3>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
                  {reg.region}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                  {reg.articles}
                </p>
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Articles automated
                  </span>
                  <span className={`text-2xl font-bold ${reg.iconAccent}`}>
                    {reg.automation}
                  </span>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* ------------------------------------------------------------------
          7. HASH-CHAINED AUDIT — cryptographic proof
      -------------------------------------------------------------------*/}
      <Section variant="emerald" pattern="dots">
        <SectionHeader
          badge="Cryptographic Audit"
          badgeVariant="emerald"
          title="Every action"
          titleGradient="cryptographically proven."
          description="Tamper-evident audit log with SHA-256 hash chaining. Every event linked to the previous. Any modification breaks the entire chain — and is detectable in milliseconds."
        />

        <StaggerContainer className="grid gap-6 lg:grid-cols-3">
          {auditFeatures.map((feature) => {
            const c = colorMap[feature.color];
            return (
              <StaggerItem key={feature.title}>
                <div className="relative rounded-xl border border-border bg-card p-6 card-hover h-full">
                  <div
                    className={`mb-5 inline-flex rounded-lg border ${c.border} ${c.bg} p-3`}
                  >
                    <feature.icon className={`h-6 w-6 ${c.text}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Hash-chain visualization */}
        <AnimatedSection delay={0.3}>
          <div className="mt-12 rounded-2xl border border-emerald-500/20 bg-card p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                <Database className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Audit chain (live preview)</p>
                <p className="text-xs text-muted-foreground font-mono">
                  3 of 1,284,302 events
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold">
                  Chain verified
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {[
                {
                  hash: "a72fe1b9…",
                  prev: "00000000…",
                  event: "consent.collected",
                  time: "2026-05-10T09:14:02Z",
                },
                {
                  hash: "c41b88d2…",
                  prev: "a72fe1b9…",
                  event: "dsar.discovered",
                  time: "2026-05-10T09:14:18Z",
                },
                {
                  hash: "e9aa20f7…",
                  prev: "c41b88d2…",
                  event: "retention.executed",
                  time: "2026-05-10T09:14:35Z",
                },
              ].map((event, i) => (
                <motion.div
                  key={event.hash}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                  className="grid grid-cols-12 gap-3 items-center rounded-lg border border-border bg-background/40 p-3 font-mono text-xs"
                >
                  <span className="col-span-2 text-emerald-400 font-semibold">
                    {event.hash}
                  </span>
                  <span className="col-span-2 text-muted-foreground">
                    ← {event.prev}
                  </span>
                  <span className="col-span-4 text-foreground">{event.event}</span>
                  <span className="col-span-3 text-muted-foreground">
                    {event.time}
                  </span>
                  <span className="col-span-1 flex justify-end">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  </span>
                </motion.div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <p className="text-xs text-muted-foreground">
                SHA-256 · Postgres advisory locks · Time-anchored
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/contact" className="gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Export evidence bundle
                </Link>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ------------------------------------------------------------------
          8. CTA
      -------------------------------------------------------------------*/}
      <CTASection
        title="Orchestrate your privacy operations,"
        titleGradient="end-to-end."
        description="See how TechD PrivacyOps unifies consent, DSAR, retention, vendor risk, breach, and AI governance in a single platform with cryptographic audit underneath."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Explore the Platform"
        secondaryHref="/platform"
      />
    </main>
  );
}
