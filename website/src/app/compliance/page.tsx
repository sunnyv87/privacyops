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
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Regulation {
  name: string;
  jurisdiction: string;
  icon: LucideIcon;
  badgeVariant: "cyan" | "purple" | "green" | "default";
  requirements: string[];
  automationLevel: number;
}

const REGULATIONS: Regulation[] = [
  { name: "GDPR", jurisdiction: "European Union", icon: Globe, badgeVariant: "cyan", automationLevel: 94, requirements: ["Articles 5-49 fully mapped", "DSAR automation", "Breach 72hr notification workflow", "DPO tools & dashboards", "Consent management"] },
  { name: "CCPA / CPRA", jurisdiction: "California", icon: Scale, badgeVariant: "purple", automationLevel: 91, requirements: ["Consumer rights automation", "Opt-out management", "Data broker compliance", "Sale-of-data tracking"] },
  { name: "HIPAA", jurisdiction: "US Healthcare", icon: Heart, badgeVariant: "green", automationLevel: 89, requirements: ["PHI discovery & classification", "Access controls auditing", "Breach notification workflow", "BAA management tracking"] },
  { name: "DPDP Act", jurisdiction: "India", icon: Fingerprint, badgeVariant: "cyan", automationLevel: 85, requirements: ["Data principal rights", "Consent management", "Cross-border transfer controls", "Significant data fiduciary obligations"] },
  { name: "ISO 27001", jurisdiction: "International", icon: ShieldCheck, badgeVariant: "purple", automationLevel: 92, requirements: ["Information security controls mapping", "Continuous evidence collection", "Annex A control coverage", "Risk treatment tracking"] },
  { name: "SOC 2 Type II", jurisdiction: "International", icon: ServerCog, badgeVariant: "green", automationLevel: 90, requirements: ["Trust service criteria mapping", "Automated evidence collection", "Audit readiness dashboard", "Continuous monitoring"] },
  { name: "PCI DSS", jurisdiction: "Global Payments", icon: CreditCard, badgeVariant: "cyan", automationLevel: 87, requirements: ["Cardholder data discovery", "Encryption validation", "Access monitoring", "Network segmentation checks"] },
  { name: "LGPD", jurisdiction: "Brazil", icon: Globe, badgeVariant: "purple", automationLevel: 86, requirements: ["Data subject rights automation", "Legal basis tracking", "International transfer controls", "DPO support tools"] },
  { name: "SEBI CSCRF", jurisdiction: "India - Capital Markets", icon: Building2, badgeVariant: "green", automationLevel: 82, requirements: ["Cybersecurity framework compliance", "Regulated entity controls", "Incident reporting workflows", "Third-party risk assessment"] },
  { name: "RBI Guidelines", jurisdiction: "India - Banking", icon: Landmark, badgeVariant: "default", automationLevel: 80, requirements: ["Banking data protection", "Cybersecurity controls", "Data localisation compliance", "Outsourcing risk management"] },
];

const HOW_IT_WORKS = [
  { icon: Map, title: "Map Controls", description: "Auto-map platform controls to regulation requirements. Our engine keeps mapping tables current as regulations evolve.", glowColor: "cyan" as const },
  { icon: FolderSearch, title: "Collect Evidence", description: "Automated evidence gathering from audit logs, configurations, and scan results. No more screenshot chasing before audits.", glowColor: "purple" as const },
  { icon: Activity, title: "Monitor Continuously", description: "Real-time compliance drift detection and alerts. Know the moment a control fails and remediate before auditors notice.", glowColor: "green" as const },
];

const AUDIT_FEATURES = [
  { icon: Hash, title: "SHA-256 Hash Chain", description: "Every audit event is chained with SHA-256 hashes creating a tamper-evident, cryptographically verifiable log." },
  { icon: FileCheck, title: "Tamper-Evident Logs", description: "Immutable, append-only audit trail with integrity verification. Any modification is instantly detectable." },
  { icon: Download, title: "One-Click Evidence Export", description: "Export complete evidence packages in auditor-ready formats: PDF, CSV, and structured JSON bundles." },
  { icon: Users, title: "Auditor-Friendly Reports", description: "Pre-formatted reports aligned to each regulation's structure. Auditors see exactly what they expect." },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompliancePage() {
  return (
    <main className="relative overflow-hidden">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />

        <div className="relative mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6">Compliance</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Continuous Compliance,{" "}
              <span className="gradient-text">Automated</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Map every control to every regulation automatically. Replace
              spreadsheet audits with real-time compliance posture monitoring
              across 10+ global frameworks.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/platform">Explore Platform</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Regulation Grid ───────────────────────────────────────────── */}
      <Section>
        <SectionHeader
          badge="Frameworks"
          title="10+ Regulations,"
          titleGradient="One Platform"
          description="Pre-built control mappings, automated evidence collection, and continuous monitoring for every major data protection regulation."
        />

        <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REGULATIONS.map((reg) => {
            const RegIcon = reg.icon;
            return (
              <StaggerItem key={reg.name}>
                <Card className="h-full card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-3">
                      <div className="inline-flex rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                        <RegIcon className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant={reg.badgeVariant} className="text-[10px]">
                        {reg.jurisdiction}
                      </Badge>
                    </div>
                    <CardTitle>{reg.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-4">
                      {reg.requirements.map((req) => (
                        <li
                          key={req}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>

                    <div className="pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">
                          Automation Level
                        </span>
                        <span className="font-semibold text-foreground">
                          {reg.automationLevel}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400"
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
      </Section>

      {/* ── Compliance Dashboard Preview ──────────────────────────────── */}
      <Section variant="muted">
        <SectionHeader
          badge="Dashboard"
          title="Compliance Posture"
          titleGradient="at a Glance"
          description="A single pane of glass for your entire compliance programme."
        />

        <AnimatedSection>
          <div className="mx-auto max-w-4xl rounded-xl border border-border bg-card p-6 lg:p-8 glow-border">
            {/* Top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Overall Score", value: "92%", icon: TrendingUp, color: "text-emerald-400" },
                { label: "Frameworks Tracked", value: "10", icon: Shield, color: "text-primary" },
                { label: "Open Findings", value: "7", icon: AlertTriangle, color: "text-amber-400" },
                { label: "Next Deadline", value: "14 days", icon: CalendarClock, color: "text-cyan-400" },
              ].map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border bg-background p-4 text-center"
                  >
                    <StatIcon className={cn("h-5 w-5 mx-auto mb-2", stat.color)} />
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Per-regulation progress bars */}
            <div className="space-y-3">
              {REGULATIONS.slice(0, 5).map((reg) => (
                <div key={reg.name} className="flex items-center gap-4">
                  <span className="w-24 text-sm font-medium shrink-0">
                    {reg.name}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${reg.automationLevel}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold">
                    {reg.automationLevel}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <Section>
        <SectionHeader
          badge="Process"
          title="How It"
          titleGradient="Works"
          description="Three steps from policy document to provable compliance."
        />

        <StaggerContainer className="grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <StaggerItem key={step.title}>
              <div className="relative">
                <div className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 z-10">
                  {i + 1}
                </div>
                <IconCard
                  icon={step.icon}
                  title={step.title}
                  description={step.description}
                  glowColor={step.glowColor}
                />
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* ── Audit Readiness ───────────────────────────────────────────── */}
      <Section variant="radial">
        <SectionHeader
          badge="Audit Trail"
          title="Audit-Ready"
          titleGradient="by Design"
          description="Cryptographically verifiable evidence trails that auditors trust. Every action recorded, every record immutable."
        />

        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIT_FEATURES.map((feat) => (
            <StaggerItem key={feat.title}>
              <IconCard
                icon={feat.icon}
                title={feat.title}
                description={feat.description}
                glowColor="cyan"
              />
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Technical detail callout */}
        <AnimatedSection delay={0.3}>
          <div className="mt-12 mx-auto max-w-2xl rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-center">
            <Lock className="h-6 w-6 text-cyan-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every audit event is linked via{" "}
              <span className="font-mono text-cyan-400">SHA-256</span> hash
              chain, creating a tamper-evident, cryptographically verifiable
              log. Export complete evidence packages in one click for any
              supported regulation.
            </p>
          </div>
        </AnimatedSection>
      </Section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <CTASection
        title="Prove Compliance,"
        titleGradient="Not Just Promise It."
        description="Replace manual evidence collection with automated, continuous compliance monitoring across every regulation that matters to your business."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="View All Connectors"
        secondaryHref="/connectors"
      />
    </main>
  );
}
