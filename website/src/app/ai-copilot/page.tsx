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
  Brain,
  MessageSquareText,
  Lightbulb,
  Wrench,
  Scale,
  BarChart3,
  Fingerprint,
  ShieldCheck,
  Zap,
  Lock,
  Users,
  ChevronRight,
  FileSearch,
  Target,
  AlertTriangle,
  ClipboardCheck,
  Siren,
  BookOpen,
  Eye,
  CircuitBoard,
  Server,
} from "lucide-react";

const aiCapabilities = [
  {
    icon: MessageSquareText,
    title: "AI Narratives",
    description:
      "Natural language explanations of findings and risks. Transform complex data security posture into clear, actionable summaries for any stakeholder.",
    glowColor: "cyan" as const,
  },
  {
    icon: Lightbulb,
    title: "AI Explainability",
    description:
      "Transparent reasoning behind every recommendation. Understand why a finding was flagged, how risk was scored, and what evidence supports each action.",
    glowColor: "purple" as const,
  },
  {
    icon: Wrench,
    title: "AI-Powered Remediation",
    description:
      "Intelligent remediation suggestions based on context, historical outcomes, and best practices. Ranked by impact and confidence.",
    glowColor: "blue" as const,
  },
  {
    icon: Scale,
    title: "AI Compliance Intelligence",
    description:
      "Automated regulation mapping and gap analysis. Map data findings to GDPR, HIPAA, PCI-DSS, and 50+ frameworks with precision.",
    glowColor: "green" as const,
  },
  {
    icon: BarChart3,
    title: "AI Risk Understanding",
    description:
      "Contextual risk analysis across your entire data landscape. Correlate signals from access patterns, sensitivity, and exposure for true risk prioritization.",
    glowColor: "cyan" as const,
  },
  {
    icon: Fingerprint,
    title: "AI Governance",
    description:
      "Complete model inventory, bias monitoring, and audit trails. Govern your AI usage with the same rigor you apply to your data.",
    glowColor: "purple" as const,
  },
];

const pipelineSteps = [
  {
    step: "01",
    title: "User Query",
    description:
      "Analyst submits a natural language question about data risk, compliance posture, or remediation options.",
    icon: MessageSquareText,
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
  },
  {
    step: "02",
    title: "PII Redaction",
    description:
      "All personally identifiable information is stripped before data leaves the tenant boundary. Fail-closed: if redaction fails, the request is blocked.",
    icon: Lock,
    color: "text-cyan-400",
    borderColor: "border-cyan-500/30",
    bgColor: "bg-cyan-500/10",
  },
  {
    step: "03",
    title: "AI Processing",
    description:
      "Sanitized context is processed by the AI model. No raw tenant data is sent to the LLM. Responses are generated from redacted metadata only.",
    icon: Brain,
    color: "text-purple-400",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/10",
  },
  {
    step: "04",
    title: "Response with Citations",
    description:
      "Every AI-generated insight includes citations back to source findings, data assets, and policies. Full traceability, zero hallucination risk.",
    icon: BookOpen,
    color: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/10",
  },
  {
    step: "05",
    title: "Audit Log",
    description:
      "Every query, redaction event, model response, and user action is recorded in an immutable audit trail for compliance and governance.",
    icon: Eye,
    color: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/10",
  },
];

const safetyPillars = [
  {
    title: "Privacy-First Architecture",
    subtitle: "Pre-Send PII Redaction",
    description:
      "Every piece of data is scanned and redacted before it leaves your tenant boundary. The system operates fail-closed: if the redaction engine cannot confirm successful sanitization, the request is blocked entirely. No data leaks, ever.",
    icon: Lock,
    color: "cyan",
    details: [
      "Pre-send PII/PHI/PCI redaction",
      "Fail-closed on redaction failure",
      "Zero raw data sent to LLM",
      "Configurable redaction rules",
    ],
  },
  {
    title: "Circuit Breaker",
    subtitle: "Automatic Safety Shutoff",
    description:
      "Built-in circuit breaker monitors AI processing health in real time. If 5 failures occur within a 60-second window, the AI enrichment pipeline automatically disables itself. Protects against cascading failures and unexpected model behavior.",
    icon: CircuitBoard,
    color: "purple",
    details: [
      "5 failures in 60s triggers disable",
      "Automatic recovery with health checks",
      "Graceful degradation to non-AI mode",
      "Alert on circuit breaker activation",
    ],
  },
  {
    title: "Tenant Isolation",
    subtitle: "Zero Cross-Tenant Contamination",
    description:
      "AI enrichment is gated per-tenant via the ai_llm_enrichment feature flag. Each tenant operates in complete isolation. Data, context, model state, and audit logs never cross tenant boundaries under any circumstances.",
    icon: Server,
    color: "green",
    details: [
      "Per-tenant feature gate (ai_llm_enrichment)",
      "Isolated model context per tenant",
      "No shared state between tenants",
      "Independent audit trails per tenant",
    ],
  },
];

const aiWorkflows = [
  {
    title: "Classification Accuracy",
    description:
      "AI enhances classification confidence by cross-referencing data patterns, context, and historical decisions. Reduces false positives by up to 85%.",
    icon: FileSearch,
    metric: "99.2%",
    metricLabel: "accuracy",
  },
  {
    title: "Risk Prioritization",
    description:
      "Contextual risk ranking that considers business impact, threat landscape, and compliance obligations. Focus on what matters most.",
    icon: Target,
    metric: "10x",
    metricLabel: "faster triage",
  },
  {
    title: "Remediation Recommendations",
    description:
      "AI suggests the optimal remediation path based on finding type, system capabilities, historical success rates, and organizational policies.",
    icon: Wrench,
    metric: "73%",
    metricLabel: "auto-resolved",
  },
  {
    title: "Compliance Gap Analysis",
    description:
      "Continuous mapping of your data posture against regulatory requirements. Instant identification of gaps with remediation guidance.",
    icon: ClipboardCheck,
    metric: "50+",
    metricLabel: "frameworks",
  },
  {
    title: "Incident Response",
    description:
      "AI-accelerated investigation with automated evidence collection, impact analysis, and response playbook generation for data-related incidents.",
    icon: Siren,
    metric: "80%",
    metricLabel: "faster MTTR",
  },
];

export default function AICopilotPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="purple" className="mb-6">
              AI Co-Pilot
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl mb-6">
              AI-Powered Data Intelligence{" "}
              <span className="gradient-text">You Can Trust</span>
            </h1>
            <p className="max-w-3xl mx-auto text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10">
              Secure, governed, and tenant-safe AI that transforms your data security operations.
              Every insight is explainable, every action is auditable, and no raw data ever
              leaves your boundary.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  See AI in Action <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/platform">View Platform</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* AI Capabilities */}
      <Section variant="muted">
        <SectionHeader
          badge="Capabilities"
          title="Intelligent Data Security"
          titleGradient="at Scale"
          description="Six AI-powered modules that augment your security team with contextual intelligence, transparent reasoning, and governed automation."
        />
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiCapabilities.map((cap) => (
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

      {/* How AI Co-Pilot Works */}
      <Section>
        <SectionHeader
          badge="Architecture"
          title="Privacy-Safe AI"
          titleGradient="Pipeline"
          description="Every AI interaction follows a strict privacy-first pipeline. From query to response, your data is protected at every step."
        />
        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-px bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-emerald-500/30" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {pipelineSteps.map((step, i) => (
              <AnimatedSection key={step.step} delay={i * 0.08}>
                <div className="relative text-center lg:text-left">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border ${step.borderColor} ${step.bgColor} mb-4 relative z-10`}
                  >
                    <step.icon className={`h-5 w-5 ${step.color}`} />
                  </div>
                  <span className="block text-xs font-mono text-muted-foreground/60 mb-1">
                    STEP {step.step}
                  </span>
                  <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Fail-closed callout */}
          <AnimatedSection delay={0.5}>
            <div className="mt-10 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 flex items-start gap-4">
              <div className="flex-shrink-0 rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-cyan-400 mb-1">
                  Fail-Closed by Design
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If the PII redaction engine encounters any error or cannot confirm successful
                  sanitization, the entire request is blocked. The system never falls back to
                  sending unredacted data. This is a hard architectural guarantee, not a
                  configuration option.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </Section>

      {/* Enterprise AI Safety */}
      <Section variant="muted">
        <SectionHeader
          badge="Enterprise Safety"
          title="AI You Can"
          titleGradient="Depend On"
          description="Three architectural pillars ensure your AI-powered data intelligence is safe, isolated, and resilient in production."
        />
        <StaggerContainer className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {safetyPillars.map((pillar) => (
            <StaggerItem key={pillar.title}>
              <div className="rounded-xl border border-border bg-card p-8 card-hover h-full flex flex-col">
                <div
                  className={`inline-flex rounded-lg border p-3 mb-5 w-fit ${
                    pillar.color === "cyan"
                      ? "bg-cyan-500/10 border-cyan-500/20"
                      : pillar.color === "purple"
                      ? "bg-purple-500/10 border-purple-500/20"
                      : "bg-emerald-500/10 border-emerald-500/20"
                  }`}
                >
                  <pillar.icon
                    className={`h-6 w-6 ${
                      pillar.color === "cyan"
                        ? "text-cyan-400"
                        : pillar.color === "purple"
                        ? "text-purple-400"
                        : "text-emerald-400"
                    }`}
                  />
                </div>
                <h3 className="text-xl font-semibold mb-1">{pillar.title}</h3>
                <p
                  className={`text-xs font-medium mb-4 ${
                    pillar.color === "cyan"
                      ? "text-cyan-400"
                      : pillar.color === "purple"
                      ? "text-purple-400"
                      : "text-emerald-400"
                  }`}
                >
                  {pillar.subtitle}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {pillar.description}
                </p>
                <ul className="mt-auto space-y-2">
                  {pillar.details.map((detail) => (
                    <li
                      key={detail}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <ShieldCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* AI-Powered Workflows */}
      <Section>
        <SectionHeader
          badge="Workflows"
          title="AI-Enhanced"
          titleGradient="Operations"
          description="See how AI Co-Pilot transforms every stage of your data security workflow with measurable, quantifiable results."
        />
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiWorkflows.map((workflow) => (
            <StaggerItem key={workflow.title}>
              <div className="rounded-xl border border-border bg-card p-6 card-hover h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex rounded-lg border bg-primary/10 border-primary/20 p-2.5">
                    <workflow.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-bold gradient-text">
                      {workflow.metric}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {workflow.metricLabel}
                    </span>
                  </div>
                </div>
                <h3 className="text-base font-semibold mb-2">{workflow.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {workflow.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* CTA */}
      <CTASection
        title="Experience AI-Powered Data"
        titleGradient="Intelligence."
        description="See how TechD PrivacyOps AI Co-Pilot transforms data security operations with governed, explainable, and tenant-safe artificial intelligence."
        primaryCta="Request a Demo"
        primaryHref="/contact"
        secondaryCta="Learn About DSPM"
        secondaryHref="/dspm"
      />
    </main>
  );
}
