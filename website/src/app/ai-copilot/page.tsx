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
import { MetricCounter } from "@/components/shared/metric-counter";
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
  Lock,
  ChevronRight,
  AlertTriangle,
  Eye,
  CircuitBoard,
  Server,
  BookOpen,
  Database,
  Hash,
  Cpu,
  Layers,
  EyeOff,
  ShieldAlert,
  FileWarning,
  Network,
} from "lucide-react";

// ---------------------------------------------------------------------------
// The trust problem (3 cards — red/amber framing)
// ---------------------------------------------------------------------------
const trustProblems = [
  {
    icon: ShieldAlert,
    title: "Data leakage",
    description:
      "Most AI tools forward raw enterprise data straight to LLM providers. PII, PHI, secrets — all of it leaves your boundary, often without anyone noticing.",
  },
  {
    icon: FileWarning,
    title: "No accountability",
    description:
      "Black-box outputs with no audit trail. When the model says something wrong, harmful, or non-compliant, there's no record of how the answer was produced.",
  },
  {
    icon: Network,
    title: "No governance",
    description:
      "Per-prompt safety controls don't exist in legacy tools. There's no circuit breaker, no tenant isolation, and no per-feature kill switch when things go wrong.",
  },
];

// ---------------------------------------------------------------------------
// 3-pillar architecture
// ---------------------------------------------------------------------------
const pillars = [
  {
    icon: Lock,
    title: "Fail-Closed PII Redaction",
    subtitle: "Pre-LLM sanitization · zero data leakage",
    description:
      "Every prompt passes through a 12-pattern PII redactor BEFORE reaching the LLM. If redaction fails — for any reason — the request is blocked. Period.",
    bullets: [
      "12 PII patterns (SSN, email, card, MRN, more)",
      "Hard fail-closed on redaction error",
      "Zero raw data to LLM — ever",
      "Configurable per-tenant rules",
    ],
    accent: "cyan",
  },
  {
    icon: CircuitBoard,
    title: "Circuit Breaker Protection",
    subtitle: "Auto-disable on cascading failure",
    description:
      "5 failures in 60 seconds auto-disables AI per-tenant. No cascading failures, no rogue model behavior, and graceful degradation to non-AI workflows.",
    bullets: [
      "5 failures in 60s triggers shutoff",
      "Per-tenant breaker state",
      "Auto-recovery with health checks",
      "Operator alert on activation",
    ],
    accent: "purple",
  },
  {
    icon: Server,
    title: "Tenant Isolation",
    subtitle: "Per-tenant feature gates · zero cross-talk",
    description:
      "Per-tenant feature gates (`ai_llm_enrichment`). Data never crosses tenant boundaries. Customer data, customer's AI — and nothing in between.",
    bullets: [
      "Feature gate: ai_llm_enrichment",
      "Isolated model context per tenant",
      "No shared state between tenants",
      "Independent audit trails",
    ],
    accent: "emerald",
  },
];

// ---------------------------------------------------------------------------
// Privacy-safe pipeline (5 steps)
// ---------------------------------------------------------------------------
const pipelineSteps = [
  {
    step: "01",
    title: "User Query",
    description:
      "Analyst submits a natural-language question about risk, compliance, or remediation.",
    icon: MessageSquareText,
    color: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
  },
  {
    step: "02",
    title: "PII Redaction",
    description:
      "12-pattern redactor scrubs PII before any data leaves the tenant boundary. Fail-closed on error.",
    icon: EyeOff,
    color: "text-cyan-400",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
  },
  {
    step: "03",
    title: "AI Processing",
    description:
      "Sanitized context only is processed by the LLM. No raw tenant data reaches the model — ever.",
    icon: Brain,
    color: "text-purple-400",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
  },
  {
    step: "04",
    title: "Response with Citations",
    description:
      "Every insight includes citations to source findings, assets, and policies. Zero hallucination risk.",
    icon: BookOpen,
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
  },
  {
    step: "05",
    title: "Hash-Chained Audit",
    description:
      "Every prompt, redaction, response, and user action lands in an immutable SHA-256 hash chain.",
    icon: Hash,
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
];

// ---------------------------------------------------------------------------
// 6 AI Capabilities
// ---------------------------------------------------------------------------
const aiCapabilities = [
  {
    icon: MessageSquareText,
    title: "AI Narratives",
    description:
      "Natural-language explanations of findings, risks, and recommendations. Translate posture into stakeholder-ready summaries instantly.",
    glowColor: "cyan" as const,
  },
  {
    icon: Lightbulb,
    title: "AI Explainability",
    description:
      "Every recommendation traces back to evidence. Understand why a finding was flagged, how risk was scored, and what supports each action.",
    glowColor: "purple" as const,
  },
  {
    icon: Wrench,
    title: "AI-Assisted Remediation",
    description:
      "Context-aware action suggestions ranked by impact and confidence — built from finding context, history, and organizational policy.",
    glowColor: "blue" as const,
  },
  {
    icon: Scale,
    title: "AI Compliance Intelligence",
    description:
      "Auto-map findings to 16+ regulatory frameworks. Continuous gap analysis with remediation guidance — no manual control mapping.",
    glowColor: "green" as const,
  },
  {
    icon: BarChart3,
    title: "AI Risk Understanding",
    description:
      "Multi-factor risk synthesis across access, sensitivity, exposure, and threat landscape. Focus your team on what actually matters.",
    glowColor: "cyan" as const,
  },
  {
    icon: Fingerprint,
    title: "AI Governance Module",
    description:
      "Inventory all AI/ML models in your organization, monitor for drift, and govern model usage with the same rigor you apply to data.",
    glowColor: "purple" as const,
  },
];

// ---------------------------------------------------------------------------
// Model transparency cards
// ---------------------------------------------------------------------------
const transparencyCards = [
  {
    icon: Cpu,
    title: "Model Choice",
    description:
      "Enterprise-tier Anthropic Claude (Sonnet 4 / Opus 4) for narratives. Our own classifiers handle PII detection and risk scoring.",
    accent: "purple",
  },
  {
    icon: Database,
    title: "No Training on Your Data",
    description:
      "Zero data retention agreements with model providers. Your prompts and our responses never enter any training set — contractually guaranteed.",
    accent: "cyan",
  },
  {
    icon: Layers,
    title: "Provider Audit Trail",
    description:
      "Every call to every provider is logged with model version, request hash, and response hash. You always know exactly which model produced each answer.",
    accent: "emerald",
  },
];

// ---------------------------------------------------------------------------
// Color helper
// ---------------------------------------------------------------------------
const accentMap: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    ring: string;
    softText: string;
  }
> = {
  cyan: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    ring: "ring-cyan-500/30",
    softText: "text-cyan-300",
  },
  purple: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    ring: "ring-purple-500/30",
    softText: "text-purple-300",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    ring: "ring-emerald-500/30",
    softText: "text-emerald-300",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    ring: "ring-amber-500/30",
    softText: "text-amber-300",
  },
};

export default function AICopilotPage() {
  return (
    <main className="relative overflow-hidden">
      {/* ------------------------------------------------------------------
          1. HERO — Governed AI for Enterprise Data Security.
      -------------------------------------------------------------------*/}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 dot-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-400 mb-4">
              AI Co-Pilot · Trustworthy · Explainable
            </div>
            <Badge variant="purple" className="mb-6">
              Tenant-Safe AI
            </Badge>
            <h1 className="font-display text-balance mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl mb-6 leading-[1.05]">
              <span className="gradient-text">Governed AI</span> for Enterprise
              Data Security.
            </h1>
            <p className="mx-auto max-w-3xl text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 text-pretty">
              Not gimmicky AI. Not black-box AI. Production AI with fail-closed
              PII redaction, tenant isolation, circuit breakers, and
              audit-every-prompt accountability.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button variant="gradient" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  See AI in Action <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="#whitepaper">Read AI Safety Whitepaper</Link>
              </Button>
            </div>

            {/* Trust badges row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            >
              {[
                { icon: Lock, label: "Fail-Closed Redaction", color: "cyan" },
                {
                  icon: CircuitBoard,
                  label: "Circuit Breaker",
                  color: "purple",
                },
                {
                  icon: Server,
                  label: "Tenant Isolation",
                  color: "emerald",
                },
              ].map((badge) => {
                const c = accentMap[badge.color];
                return (
                  <div
                    key={badge.label}
                    className={`inline-flex items-center gap-2 rounded-full border ${c.border} ${c.bg} px-4 py-2`}
                  >
                    <badge.icon className={`h-4 w-4 ${c.text}`} />
                    <span className={`text-sm font-medium ${c.softText}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ------------------------------------------------------------------
          2. THE TRUST PROBLEM (red/amber framing)
      -------------------------------------------------------------------*/}
      <Section variant="muted">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <Badge variant="danger" className="mb-6">
            The trust problem
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
            Enterprise AI has a{" "}
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              trust problem.
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
            Most enterprise AI tools were retrofit from consumer chatbots.
            That's why they leak data, can't explain themselves, and have no
            governance controls when something goes wrong.
          </p>
        </div>

        <StaggerContainer className="grid gap-6 lg:grid-cols-3">
          {trustProblems.map((problem) => (
            <StaggerItem key={problem.title}>
              <div className="relative rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.03] via-card to-amber-500/[0.03] p-6 card-hover h-full">
                <div className="mb-5 inline-flex rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <problem.icon className="h-6 w-6 text-red-400" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="text-lg font-semibold">{problem.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {problem.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* ------------------------------------------------------------------
          3. HOW TECHD AI IS DIFFERENT — 3 pillars
      -------------------------------------------------------------------*/}
      <Section pattern="grid">
        <SectionHeader
          badge="The architecture"
          badgeVariant="cyan"
          title="Three pillars."
          titleGradient="No exceptions."
          description="Every AI request flows through three architectural guarantees that don't exist as configuration options — they exist as code paths the request cannot bypass."
        />

        <StaggerContainer className="grid gap-6 lg:grid-cols-3">
          {pillars.map((pillar, i) => {
            const c = accentMap[pillar.accent];
            return (
              <StaggerItem key={pillar.title}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="relative rounded-2xl border border-border bg-card p-7 lg:p-8 card-hover h-full flex flex-col"
                >
                  <div
                    className={`absolute top-7 right-7 text-[10px] font-mono uppercase tracking-wider ${c.softText}`}
                  >
                    Pillar {String(i + 1).padStart(2, "0")}
                  </div>
                  <div
                    className={`mb-6 inline-flex rounded-xl border ${c.border} ${c.bg} p-3.5 w-fit`}
                  >
                    <pillar.icon className={`h-7 w-7 ${c.text}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{pillar.title}</h3>
                  <p className={`text-xs font-medium mb-5 ${c.softText}`}>
                    {pillar.subtitle}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {pillar.description}
                  </p>
                  <ul className="mt-auto space-y-2.5 pt-5 border-t border-border">
                    {pillar.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <ShieldCheck
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${c.text}`}
                        />
                        <span className="text-muted-foreground">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* ------------------------------------------------------------------
          4. PRIVACY-SAFE PIPELINE — 5-step flow
      -------------------------------------------------------------------*/}
      <Section variant="radial">
        <SectionHeader
          badge="The pipeline"
          badgeVariant="purple"
          title="Every prompt."
          titleGradient="Every response. Every byte audited."
          description="Five sequential stages. None of them are optional. None of them can be bypassed. This is what 'governed AI' actually looks like in production."
        />

        <div className="relative">
          {/* Connection line - desktop only */}
          <div className="hidden lg:block absolute top-12 left-[8%] right-[8%] h-px bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-amber-500/40" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {pipelineSteps.map((step, i) => (
              <AnimatedSection key={step.step} delay={i * 0.08}>
                <div className="relative text-center lg:text-left">
                  <div
                    className={`inline-flex items-center justify-center w-14 h-14 rounded-xl border ${step.border} ${step.bg} mb-4 relative z-10 bg-background`}
                  >
                    <step.icon className={`h-6 w-6 ${step.color}`} />
                  </div>
                  <span className="block text-[10px] font-mono text-muted-foreground/70 mb-1 tracking-wider">
                    STEP {step.step}
                  </span>
                  <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Fail-closed callout */}
          <AnimatedSection delay={0.5}>
            <div className="mt-12 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] via-card to-card p-6 lg:p-8 flex flex-col sm:flex-row items-start gap-5">
              <div className="flex-shrink-0 rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3">
                <ShieldCheck className="h-6 w-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-cyan-300 mb-2">
                  Fail-closed by design — not by configuration
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If the PII redaction engine encounters any error, or cannot
                  confirm successful sanitization, the entire request is
                  blocked. The system never falls back to sending unredacted
                  data. This is a hard architectural guarantee enforced in code,
                  not a setting an admin can flip off.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link href="#whitepaper">Read the design doc</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </Section>

      {/* ------------------------------------------------------------------
          5. SIX AI CAPABILITIES
      -------------------------------------------------------------------*/}
      <Section variant="muted">
        <SectionHeader
          badge="What AI Co-Pilot does"
          badgeVariant="cyan"
          title="AI that works"
          titleGradient="for your security team."
          description="Six AI-powered capabilities that augment your team with contextual intelligence, transparent reasoning, and governed automation — every one of them runs through the privacy-safe pipeline."
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

      {/* ------------------------------------------------------------------
          6. MEASURABLE OUTCOMES — 4 metric counters
      -------------------------------------------------------------------*/}
      <Section pattern="grid-dense">
        <SectionHeader
          badge="The numbers"
          badgeVariant="emerald"
          title="Real metrics."
          titleGradient="Real outcomes."
          description="What governed AI actually delivers when it's wired into the data security workflow — measured across production deployments."
        />

        <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <MetricCounter
              value={99.2}
              suffix="%"
              label="Classification Accuracy"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCounter
              value={10}
              suffix="x"
              label="Risk Prioritization Speed"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCounter
              value={73}
              suffix="%"
              label="Auto-Resolved Remediations"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCounter
              value={80}
              suffix="%"
              label="Faster MTTR"
            />
          </StaggerItem>
        </StaggerContainer>

        <AnimatedSection delay={0.3}>
          <div className="mt-10 rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 shrink-0">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm text-muted-foreground flex-1">
              Numbers from production tenants in 2025. Your mileage will vary
              with data volume, connector mix, and policy complexity — full
              methodology available in the whitepaper.
            </p>
            <Button variant="ghost" size="sm" asChild>
              <Link href="#whitepaper" className="gap-1">
                Methodology <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </AnimatedSection>
      </Section>

      {/* ------------------------------------------------------------------
          7. MODEL TRANSPARENCY
      -------------------------------------------------------------------*/}
      <Section id="whitepaper" variant="emerald" pattern="dots">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <Badge variant="green" className="mb-6">
            Model transparency
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
            <span className="gradient-text">Know your model.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
            We use enterprise-tier Anthropic Claude (Sonnet 4 / Opus 4) for
            narratives, with our own classifiers for PII detection. No mystery
            models. No training on your data.
          </p>
        </div>

        <StaggerContainer className="grid gap-6 lg:grid-cols-3">
          {transparencyCards.map((card) => {
            const c = accentMap[card.accent];
            return (
              <StaggerItem key={card.title}>
                <div className="rounded-xl border border-border bg-card p-7 card-hover h-full">
                  <div
                    className={`mb-5 inline-flex rounded-lg border ${c.border} ${c.bg} p-3`}
                  >
                    <card.icon className={`h-6 w-6 ${c.text}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Model card preview */}
        <AnimatedSection delay={0.3}>
          <div className="mt-12 rounded-2xl border border-border bg-card p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5">
                  <Cpu className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Active model configuration
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    /tenant/acme/ai-config.yaml
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold">
                  Visible to you
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
              {[
                { k: "narrative_model", v: "claude-opus-4" },
                { k: "classifier_model", v: "techd-pii-v2.3" },
                { k: "data_retention", v: "0 days (provider)" },
                { k: "training_opt_out", v: "true" },
              ].map((row) => (
                <div
                  key={row.k}
                  className="rounded-lg border border-border bg-background/40 p-3"
                >
                  <p className="text-muted-foreground/70 mb-1">{row.k}</p>
                  <p className="text-emerald-400 font-semibold">{row.v}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ------------------------------------------------------------------
          8. CTA
      -------------------------------------------------------------------*/}
      <CTASection
        title="Governed AI for security teams"
        titleGradient="that can't afford mistakes."
        description="See how TechD AI Co-Pilot delivers production-grade AI with fail-closed redaction, tenant isolation, circuit breakers, and audit-every-prompt accountability."
        primaryCta="Request a Demo"
        primaryHref="/contact"
        secondaryCta="Read the Whitepaper"
        secondaryHref="#whitepaper"
      />
    </main>
  );
}
