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
  Map,
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
} from "lucide-react";

const capabilities = [
  {
    icon: Search,
    title: "Data Discovery",
    description:
      "Automated scanning across 43+ connectors to find every data store, structured and unstructured, across cloud, SaaS, and on-prem environments.",
    glowColor: "cyan" as const,
  },
  {
    icon: Tags,
    title: "Data Classification",
    description:
      "AI-powered PII, PHI, and PCI detection with confidence scoring. Multi-layer classification engine with 200+ built-in data identifiers.",
    glowColor: "purple" as const,
  },
  {
    icon: GitBranch,
    title: "Data Graph Intelligence",
    description:
      "Relationship mapping between data, identities, and access. Visualize how sensitive data connects across your entire infrastructure.",
    glowColor: "blue" as const,
  },
  {
    icon: Users,
    title: "Identity-to-Data Access",
    description:
      "Understand who has access to what sensitive data. Map permissions, roles, and sharing across every connected system.",
    glowColor: "green" as const,
  },
  {
    icon: EyeOff,
    title: "Shadow Data Detection",
    description:
      "Find unknown and unmanaged data stores that fall outside your security perimeter. Eliminate blind spots in your data landscape.",
    glowColor: "purple" as const,
  },
  {
    icon: Route,
    title: "Sensitive Data Lineage",
    description:
      "Track data flow and transformations from origin to destination. Understand how sensitive data moves and replicates across systems.",
    glowColor: "cyan" as const,
  },
  {
    icon: Crosshair,
    title: "Attack Path Analysis",
    description:
      "Identify exploitable paths to sensitive data. Model attacker perspective to prioritize vulnerabilities that actually matter.",
    glowColor: "blue" as const,
  },
  {
    icon: Gauge,
    title: "Risk Scoring Engine",
    description:
      "Contextual risk scoring based on sensitivity, exposure, compliance requirements, and access patterns. Dynamic scores that reflect real-time posture.",
    glowColor: "green" as const,
  },
  {
    icon: Wrench,
    title: "Automated Remediation",
    description:
      "12 action types across 11 connector types. Native, catalog-update, and manual execution modes for flexible remediation workflows.",
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
      "Dynamic policies that evolve with your data landscape. Auto-tune thresholds and rules based on observed patterns and feedback.",
    glowColor: "blue" as const,
  },
  {
    icon: ShieldCheck,
    title: "Security Validation",
    description:
      "Continuous verification of security controls. Validate that encryption, access controls, and retention policies are applied correctly.",
    glowColor: "green" as const,
  },
];

const flowSteps = [
  {
    step: "01",
    title: "Connect Data Sources",
    description:
      "Deploy agentless connectors across your cloud, SaaS, and on-prem data stores. 43+ connectors with read-only access and zero performance impact.",
    icon: Database,
  },
  {
    step: "02",
    title: "Discover & Classify",
    description:
      "AI-powered engine scans and classifies every data asset. Identify PII, PHI, PCI, and custom data types with confidence scoring and multi-language support.",
    icon: ScanSearch,
  },
  {
    step: "03",
    title: "Map Access & Risk",
    description:
      "Build a complete data graph linking sensitive data to identities, permissions, and access patterns. Generate contextual risk scores for every finding.",
    icon: Map,
  },
  {
    step: "04",
    title: "Remediate & Monitor",
    description:
      "Execute automated remediations, enforce adaptive policies, and continuously monitor for drift. Close the loop with validation and audit trails.",
    icon: Activity,
  },
];

const remediationActions = [
  { action: "revoke_access", label: "Revoke Access", icon: Lock, mode: "Native" },
  { action: "encrypt", label: "Encrypt", icon: ShieldCheck, mode: "Native" },
  { action: "enable_mfa", label: "Enable MFA", icon: Users, mode: "Native" },
  { action: "apply_retention", label: "Apply Retention", icon: RefreshCw, mode: "Native" },
  { action: "restrict_public", label: "Restrict Public", icon: Globe, mode: "Native" },
  { action: "delete_data", label: "Delete Data", icon: Trash2, mode: "Manual" },
  { action: "mask_data", label: "Mask Data", icon: EyeIcon, mode: "Native" },
  { action: "quarantine", label: "Quarantine", icon: AlertTriangle, mode: "Catalog Update" },
  { action: "rotate_credentials", label: "Rotate Credentials", icon: RotateCw, mode: "Native" },
  { action: "restrict_sharing", label: "Restrict Sharing", icon: Share2, mode: "Native" },
  { action: "disable_public_access", label: "Disable Public Access", icon: Globe, mode: "Native" },
  { action: "enforce_encryption", label: "Enforce Encryption", icon: HardDrive, mode: "Native" },
];

const riskFactors = [
  {
    factor: "Data Sensitivity",
    description: "Classification level, data type, volume of sensitive records",
    weight: "Critical",
    color: "text-red-400",
  },
  {
    factor: "Exposure Level",
    description: "Public access, overprivileged users, misconfigured sharing",
    weight: "High",
    color: "text-orange-400",
  },
  {
    factor: "Compliance Requirements",
    description: "GDPR, HIPAA, PCI-DSS, SOX regulatory obligations",
    weight: "High",
    color: "text-yellow-400",
  },
  {
    factor: "Access Patterns",
    description: "Anomalous behavior, excessive access, dormant permissions",
    weight: "Medium",
    color: "text-cyan-400",
  },
];

export default function DSPMPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="cyan" className="mb-6">
              DSPM
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl mb-6">
              Data Security Posture Management{" "}
              <span className="gradient-text">Reimagined</span>
            </h1>
            <p className="max-w-3xl mx-auto text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10">
              Continuous data security across your entire infrastructure. Discover, classify,
              and protect sensitive data with automated remediation and adaptive policies that
              scale with the enterprise.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/platform">Explore Platform</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <Section variant="muted">
        <SectionHeader
          badge="12 Modules"
          title="Core DSPM"
          titleGradient="Capabilities"
          description="A complete data security posture management platform. Each module works independently and as part of a unified system."
        />
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {capabilities.map((cap) => (
            <StaggerItem key={cap.title}>
              <IconCard
                icon={cap.icon}
                title={cap.title}
                description={cap.description}
                glowColor={cap.glowColor}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* How DSPM Works */}
      <Section>
        <SectionHeader
          badge="How It Works"
          title="From Connectors to"
          titleGradient="Continuous Protection"
          description="A four-step lifecycle that transforms raw data infrastructure into a governed, secure, and compliant data estate."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {flowSteps.map((step, i) => (
            <AnimatedSection key={step.step} delay={i * 0.1}>
              <div className="relative group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 group-hover:border-primary/40 transition-colors">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  {i < flowSteps.length - 1 && (
                    <ChevronRight className="hidden lg:block absolute -right-5 top-3 h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <span className="text-xs font-mono text-primary/60 mb-2 block">
                  STEP {step.step}
                </span>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </Section>

      {/* Remediation Engine */}
      <Section variant="muted">
        <SectionHeader
          badge="Remediation Engine"
          title="12 Action Types."
          titleGradient="3 Execution Modes."
          description="Automated, auditable, and adaptive remediation across every connected data store. Choose native automation, metadata updates, or guided manual workflows."
        />
        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {[
              {
                title: "Native",
                subtitle: "Automated Execution",
                description:
                  "Direct API calls to the target system. Fully automated with rollback capability. Applied in real time with audit trail.",
                icon: Zap,
                color: "cyan",
              },
              {
                title: "Catalog Update",
                subtitle: "Metadata Sync",
                description:
                  "Updates the data catalog and governance metadata. Flags findings for downstream tooling without modifying source systems.",
                icon: BookOpen,
                color: "purple",
              },
              {
                title: "Manual",
                subtitle: "Guided Workflows",
                description:
                  "Step-by-step instructions for actions requiring human review. Includes pre-built runbooks, approval flows, and completion tracking.",
                icon: Hand,
                color: "green",
              },
            ].map((mode) => (
              <div
                key={mode.title}
                className="rounded-xl border border-border bg-card p-6 card-hover"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`inline-flex rounded-lg border p-2.5 ${
                      mode.color === "cyan"
                        ? "bg-cyan-500/10 border-cyan-500/20"
                        : mode.color === "purple"
                        ? "bg-purple-500/10 border-purple-500/20"
                        : "bg-emerald-500/10 border-emerald-500/20"
                    }`}
                  >
                    <mode.icon
                      className={`h-5 w-5 ${
                        mode.color === "cyan"
                          ? "text-cyan-400"
                          : mode.color === "purple"
                          ? "text-purple-400"
                          : "text-emerald-400"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{mode.title}</h3>
                    <p className="text-xs text-muted-foreground">{mode.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {mode.description}
                </p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.15}>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-3 gap-px bg-border text-xs font-semibold text-muted-foreground">
              <div className="bg-card px-5 py-3">Action Type</div>
              <div className="bg-card px-5 py-3">Description</div>
              <div className="bg-card px-5 py-3">Execution Mode</div>
            </div>
            {remediationActions.map((item, i) => (
              <div
                key={item.action}
                className="grid grid-cols-3 gap-px bg-border text-sm"
              >
                <div className="bg-card px-5 py-3 flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <code className="text-xs text-primary/80">{item.action}</code>
                </div>
                <div className="bg-card px-5 py-3 text-muted-foreground">
                  {item.label}
                </div>
                <div className="bg-card px-5 py-3">
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
              </div>
            ))}
          </div>
        </AnimatedSection>
      </Section>

      {/* Risk Intelligence */}
      <Section>
        <SectionHeader
          badge="Risk Intelligence"
          title="Contextual Risk"
          titleGradient="Scoring"
          description="Every finding is scored against multiple contextual factors. Prioritize what matters based on real-world risk, not just severity labels."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <AnimatedSection>
            <div className="space-y-6">
              {riskFactors.map((factor) => (
                <div
                  key={factor.factor}
                  className="rounded-xl border border-border bg-card p-5 card-hover"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold">{factor.factor}</h3>
                    <span className={`text-xs font-medium ${factor.color}`}>
                      {factor.weight}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {factor.description}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.15}>
            <div className="rounded-xl border border-border bg-card p-8">
              <h3 className="text-lg font-semibold mb-6">Risk Matrix</h3>
              <div className="grid grid-cols-4 gap-2">
                {/* Y-axis labels */}
                <div className="flex items-end justify-end pr-2 pb-1">
                  <span className="text-[10px] text-muted-foreground font-mono">EXPOSURE</span>
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

                {/* High sensitivity row */}
                <div className="flex items-center justify-end pr-2">
                  <span className="text-[10px] text-muted-foreground font-mono">HIGH</span>
                </div>
                <div className="h-16 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-yellow-400">Medium</span>
                </div>
                <div className="h-16 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-orange-400">High</span>
                </div>
                <div className="h-16 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-red-400">Critical</span>
                </div>

                {/* Medium sensitivity row */}
                <div className="flex items-center justify-end pr-2">
                  <span className="text-[10px] text-muted-foreground font-mono">MED</span>
                </div>
                <div className="h-16 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-emerald-400">Low</span>
                </div>
                <div className="h-16 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-yellow-400">Medium</span>
                </div>
                <div className="h-16 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-orange-400">High</span>
                </div>

                {/* Low sensitivity row */}
                <div className="flex items-center justify-end pr-2">
                  <span className="text-[10px] text-muted-foreground font-mono">LOW</span>
                </div>
                <div className="h-16 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-blue-400">Info</span>
                </div>
                <div className="h-16 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-emerald-400">Low</span>
                </div>
                <div className="h-16 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <span className="text-xs font-medium text-yellow-400">Medium</span>
                </div>

                {/* X-axis label */}
                <div />
                <div className="col-span-3 text-center pt-1">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    SENSITIVITY
                  </span>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </Section>

      {/* CTA */}
      <CTASection
        title="Take Control of Your Data Security"
        titleGradient="Posture."
        description="Deploy DSPM across your entire infrastructure in hours, not months. Discover sensitive data, map risk, and automate remediation from day one."
        primaryCta="Start a Free Assessment"
        primaryHref="/contact"
        secondaryCta="View All Connectors"
        secondaryHref="/connectors"
      />
    </main>
  );
}
