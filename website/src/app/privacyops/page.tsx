"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import { CTASection } from "@/components/shared/cta-section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
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
  Lock,
} from "lucide-react";

const modules = [
  {
    icon: Fingerprint,
    title: "Consent Management",
    description: "Purpose-based consent collection with a customizable preference center, granular withdrawal workflows, and cross-channel consent synchronization.",
    glow: "blue" as const,
  },
  {
    icon: FileSearch,
    title: "DSAR Management",
    description: "Automated subject data discovery across 43+ connectors, identity verification, fail-closed PII redaction, and legal hold enforcement.",
    glow: "cyan" as const,
  },
  {
    icon: Scale,
    title: "DPIA / Privacy Risk",
    description: "Privacy impact assessments with automated risk scoring, mitigation recommendations, and regulator-ready report generation.",
    glow: "purple" as const,
  },
  {
    icon: ClipboardList,
    title: "RoPA (Records of Processing)",
    description: "Automated records of processing activities with cross-regulation mapping, data flow visualization, and continuous sync.",
    glow: "green" as const,
  },
  {
    icon: Timer,
    title: "Retention Governance",
    description: "Policy-driven retention enforcement with automated tagging, schedule management, legal hold integration, and verified deletion.",
    glow: "blue" as const,
  },
  {
    icon: Building2,
    title: "Vendor / Third-Party Risk",
    description: "Vendor privacy assessments, DPA lifecycle management, ongoing risk monitoring, and automated reassessment scheduling.",
    glow: "cyan" as const,
  },
  {
    icon: AlertTriangle,
    title: "Breach Management",
    description: "Incident detection and triage, 72-hour notification workflows, regulatory filing automation, and post-incident review tracking.",
    glow: "purple" as const,
  },
  {
    icon: Brain,
    title: "AI Governance",
    description: "AI model inventory and risk classification, bias monitoring dashboards, explainability reports, and automated compliance checks.",
    glow: "green" as const,
  },
];

const dsarSteps = [
  { icon: UserCheck, label: "Request Intake", description: "Multi-channel intake via portal, email, or API with automatic categorization" },
  { icon: Fingerprint, label: "Identity Verification", description: "Multi-factor identity verification with configurable assurance levels" },
  { icon: Search, label: "Data Discovery", description: "Automated search across 43+ connectors with parallel execution" },
  { icon: EyeOff, label: "PII Redaction", description: "Fail-closed redaction pipeline ensuring no third-party data leaks" },
  { icon: Gavel, label: "Legal Hold Check", description: "Automated legal hold verification before any data action proceeds" },
  { icon: FileCheck, label: "Response Assembly", description: "Templated response with redacted dataset in portable format" },
  { icon: Send, label: "Delivery", description: "Secure delivery via encrypted portal with download expiry" },
];

const regulations = [
  { name: "GDPR", region: "EU", articles: "Art. 6, 7, 13-22, 25, 28, 30, 33-34, 35-36", color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
  { name: "CCPA/CPRA", region: "California", articles: "Sec. 1798.100-199, Right to Delete, Opt-Out, Know", color: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" },
  { name: "HIPAA", region: "US Healthcare", articles: "Privacy Rule, Security Rule, Breach Notification Rule", color: "bg-purple-500/10 border-purple-500/30 text-purple-400" },
  { name: "DPDP", region: "India", articles: "Data Principal Rights, Consent Manager, Data Fiduciary", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  { name: "LGPD", region: "Brazil", articles: "Art. 7-16, Data Subject Rights, DPO Requirements", color: "bg-orange-500/10 border-orange-500/30 text-orange-400" },
];

export default function PrivacyOpsPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="purple" className="mb-6">PrivacyOps Suite</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Complete Privacy Operations{" "}
              <span className="gradient-text">Automated</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed mb-10">
              End-to-end privacy management across consent, DSARs, breach response, retention,
              vendor risk, and AI governance -- unified in a single platform with full regulatory mapping.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  See PrivacyOps in Action <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/platform">Platform Architecture</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Module Overview */}
      <Section variant="muted">
        <SectionHeader
          badge="All Modules"
          title="Every Privacy Operation,"
          titleGradient="One Platform"
          description="Eight integrated modules covering the full spectrum of privacy operations. Each module shares a unified data model, workflow engine, and audit trail."
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
      </Section>

      {/* DSAR Deep Dive */}
      <Section>
        <SectionHeader
          badge="DSAR Automation"
          title="Subject Access Requests,"
          titleGradient="Fully Automated"
          description="From intake to delivery, every DSAR follows a deterministic workflow with identity verification, fail-closed redaction, and legal hold enforcement."
        />
        <AnimatedSection>
          {/* Horizontal flow on larger screens, vertical on mobile */}
          <div className="hidden lg:block">
            <div className="flex items-start gap-2">
              {dsarSteps.map((step, i) => (
                <div key={step.label} className="flex items-start flex-1">
                  <div className="flex flex-col items-center text-center w-full">
                    <div className="rounded-xl border border-border bg-card p-4 w-full card-hover">
                      <div className="mx-auto mb-3 inline-flex rounded-lg border border-primary/20 bg-primary/10 p-2.5">
                        <step.icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-xs font-semibold mb-1">{step.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                  {i < dsarSteps.length - 1 && (
                    <div className="flex items-center pt-10 shrink-0 px-1">
                      <ChevronRight className="h-4 w-4 text-primary/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Vertical flow on mobile */}
          <div className="lg:hidden space-y-3">
            {dsarSteps.map((step, i) => (
              <div key={step.label}>
                <div className="flex gap-4 rounded-xl border border-border bg-card p-4 card-hover">
                  <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 p-2.5">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5">{step.label}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
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
        <AnimatedSection delay={0.3}>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { stat: "< 48 hrs", label: "Average DSAR Completion" },
              { stat: "100%", label: "Redaction Accuracy (fail-closed)" },
              { stat: "43+", label: "Data Source Connectors" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-2xl font-bold gradient-text">{item.stat}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </Section>

      {/* Consent Management Detail */}
      <Section variant="radial">
        <SectionHeader
          badge="Consent Engine"
          title="Purpose-Based"
          titleGradient="Consent Architecture"
          description="Granular, purpose-driven consent collection with real-time preference synchronization across all channels and touchpoints."
        />
        <AnimatedSection>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {[
                {
                  icon: ToggleLeft,
                  title: "Purpose-Based Collection",
                  desc: "Define consent purposes with legal basis mapping (legitimate interest, contract, consent). Each purpose tracks granular opt-in state per data subject.",
                },
                {
                  icon: Settings,
                  title: "Preference Center",
                  desc: "White-labeled preference center embeddable in any application. Supports granular channel preferences, frequency controls, and category toggles.",
                },
                {
                  icon: XCircle,
                  title: "Withdrawal Automation",
                  desc: "Consent withdrawal triggers downstream workflows: data deletion requests, processing cessation, third-party notification, and audit logging.",
                },
                {
                  icon: Globe,
                  title: "Cross-Channel Sync",
                  desc: "Consent state synchronized in real-time across web, mobile, email, and API channels via NATS event bus with conflict resolution.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border border-border bg-card p-5 card-hover">
                  <div className="shrink-0 rounded-lg border border-purple-500/20 bg-purple-500/10 p-2.5">
                    <item.icon className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
                <p className="text-sm font-semibold mb-4 text-center">Consent Lifecycle</p>
                <div className="space-y-2">
                  {[
                    { step: "Collection", detail: "Purpose + legal basis captured" },
                    { step: "Storage", detail: "Immutable consent record created" },
                    { step: "Enforcement", detail: "Processing gated by consent state" },
                    { step: "Withdrawal", detail: "Cascading downstream workflows" },
                    { step: "Audit", detail: "Full history with timestamps" },
                  ].map((item, i) => (
                    <div key={item.step}>
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{item.step}</p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                      {i < 4 && (
                        <div className="flex justify-center py-0.5">
                          <div className="h-2 w-px bg-border" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* Compliance Automation */}
      <Section>
        <SectionHeader
          badge="Regulatory Mapping"
          title="One Platform,"
          titleGradient="Every Regulation"
          description="PrivacyOps modules automatically map to regulatory requirements. Maintain continuous compliance across GDPR, CCPA, HIPAA, DPDP, and LGPD."
        />
        <AnimatedSection>
          <div className="space-y-4 max-w-3xl mx-auto">
            {regulations.map((reg, i) => (
              <motion.div
                key={reg.name}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center gap-3 ${reg.color}`}
              >
                <div className="flex items-center gap-3 sm:w-48 shrink-0">
                  <Shield className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{reg.name}</p>
                    <p className="text-xs opacity-70">{reg.region}</p>
                  </div>
                </div>
                <div className="h-px sm:h-8 sm:w-px bg-current/20 shrink-0" />
                <p className="text-xs text-muted-foreground flex-1">{reg.articles}</p>
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400 hidden sm:block" />
              </motion.div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Each PrivacyOps module includes pre-built regulatory mappings. Compliance evidence is generated automatically as you operate, eliminating manual audit preparation.
            </p>
          </div>
        </AnimatedSection>
      </Section>

      {/* CTA */}
      <CTASection
        title="Automate Your Privacy Operations"
        titleGradient="Today."
        description="See how TechD PrivacyOps eliminates manual privacy workflows and keeps your organization continuously compliant across every regulation."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Explore Platform"
        secondaryHref="/platform"
      />
    </div>
  );
}
