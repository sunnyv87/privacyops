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
import { LogoMarquee } from "@/components/shared/logo-marquee";
import { MetricCounter } from "@/components/shared/metric-counter";
import { CompareTable } from "@/components/shared/compare-table";
import { LiveDashboardMock } from "@/components/shared/live-dashboard-mock";
import { RegulationRibbon } from "@/components/shared/regulation-ribbon";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Brain,
  Scale,
  Layers,
  Cpu,
  Lock,
  Globe,
  Search,
  Tags,
  Map as MapIcon,
  Wrench,
  ChevronRight,
  Quote,
  Sparkles,
  Workflow,
  Database,
  Bot,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  1. HERO                                                            */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 radial-hero" />
      <div className="absolute inset-0 grid-bg" />

      {/* Subtle accent orbs */}
      <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-28 pb-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80 mb-5">
              DSPM · PrivacyOps · AI Governance
            </div>

            <div className="mb-7">
              <Badge variant="live">v1.0 · Production</Badge>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-balance mb-7">
              The Unified{" "}
              <span className="gradient-text">
                DSPM + PrivacyOps + AI Security
              </span>{" "}
              Platform
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed text-pretty mb-9">
              Discover every byte of sensitive data. Map every access path.
              Remediate every risk — automatically. Built for the AI era,
              ready for DPDPA, GDPR, HIPAA, and beyond.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Button variant="gradient" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Book Enterprise Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/platform">Explore Platform</Link>
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="space-y-4"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                Trusted by enterprises across BFSI, Healthcare, Government
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dpdpa">DPDPA 2023</Badge>
                <Badge variant="cyan">GDPR</Badge>
                <Badge variant="purple">HIPAA</Badge>
                <Badge variant="green">SOC 2 Type II</Badge>
                <Badge variant="outline">ISO 27001</Badge>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — Live Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="animate-float">
              <LiveDashboardMock />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2. LOGO MARQUEE                                                    */
/* ------------------------------------------------------------------ */
function LogoMarqueeSection() {
  return (
    <section className="relative py-16 border-y border-border/50 bg-muted/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-10">
          Built for security-forward enterprises worldwide
        </p>
        <LogoMarquee />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  3. DIFFERENTIATION PILLARS                                         */
/* ------------------------------------------------------------------ */
const differentiators = [
  {
    icon: Layers,
    title: "Unified — not bolt-on",
    description:
      "One platform for DSPM + PrivacyOps + AI, not 4 acquisitions stapled together. Single data graph, one auth model, zero glue code.",
    glowColor: "blue" as const,
  },
  {
    icon: Cpu,
    title: "Engineered, not assembled",
    description:
      "Temporal workflows, NATS event bus, hash-chained audit, 7-layer auth. Built like infrastructure, runs like a product.",
    glowColor: "cyan" as const,
  },
  {
    icon: Bot,
    title: "Governed AI",
    description:
      "Fail-closed PII redaction, per-tenant gates, every prompt auditable. AI governance baked into the platform — not an afterthought.",
    glowColor: "purple" as const,
  },
  {
    icon: Globe,
    title: "DPDPA-ready + Global",
    description:
      "India-first compliance, GDPR/CCPA/HIPAA from day one. 16+ frameworks. The first DSPM truly built for DPDPA 2023.",
    glowColor: "green" as const,
  },
];

function DifferentiationSection() {
  return (
    <Section variant="default" pattern="grid">
      <SectionHeader
        eyebrow="Why TechD"
        badge="Differentiation"
        title="Built different. Engineered to"
        titleGradient="prove it."
        description="Four foundational decisions that separate TechD from every legacy DSPM and privacy point tool on the market."
      />
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {differentiators.map((d) => (
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
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  4. PRODUCT TRIPTYCH                                                */
/* ------------------------------------------------------------------ */
const triptych = [
  {
    icon: Shield,
    name: "DSPM",
    tagline: "Data Security Posture Management",
    href: "/dspm",
    accent: "blue" as const,
    bullets: [
      "Data Graph Intelligence across 43+ connectors",
      "Attack path analysis surfaces real exposure",
      "12 native remediation actions, fully automated",
      "Shadow data discovery with zero blind spots",
    ],
  },
  {
    icon: Scale,
    name: "PrivacyOps",
    tagline: "Privacy Operations Automation",
    href: "/privacyops",
    accent: "cyan" as const,
    bullets: [
      "DSAR fulfillment in hours, not weeks",
      "Consent + preference orchestration at scale",
      "DPDPA-native workflows out of the box",
      "Hash-chained audit log for every action",
    ],
  },
  {
    icon: Brain,
    name: "AI Co-Pilot",
    tagline: "Governed AI for Security Teams",
    href: "/ai-copilot",
    accent: "purple" as const,
    bullets: [
      "Natural-language risk and policy queries",
      "Fail-closed PII redaction on every prompt",
      "Per-tenant model gates and audit trails",
      "Auto-generated compliance narratives",
    ],
  },
];

const accentMap = {
  blue: {
    border: "hover:border-blue-500/40",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    iconText: "text-blue-400",
    link: "text-blue-400",
    glow: "shadow-blue-500/10",
  },
  cyan: {
    border: "hover:border-cyan-500/40",
    iconBg: "bg-cyan-500/10 border-cyan-500/20",
    iconText: "text-cyan-400",
    link: "text-cyan-400",
    glow: "shadow-cyan-500/10",
  },
  purple: {
    border: "hover:border-purple-500/40",
    iconBg: "bg-purple-500/10 border-purple-500/20",
    iconText: "text-purple-400",
    link: "text-purple-400",
    glow: "shadow-purple-500/10",
  },
};

function ProductTriptychSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Platform"
        title="Three platforms."
        titleGradient="One source of truth."
        description="A single data graph powers all three. Insights flow between products in real time — no integration tax, no duplicated work."
      />
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {triptych.map((p) => {
          const a = accentMap[p.accent];
          return (
            <StaggerItem key={p.name}>
              <Link href={p.href} className="block h-full group">
                <Card
                  className={`h-full glass-card-elevated card-hover transition-all border-border/60 ${a.border} ${a.glow}`}
                >
                  <CardHeader>
                    <div
                      className={`inline-flex rounded-lg border p-3 mb-4 ${a.iconBg}`}
                    >
                      <p.icon className={`h-6 w-6 ${a.iconText}`} />
                    </div>
                    <CardTitle className="text-2xl font-display">
                      {p.name}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {p.tagline}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {p.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed"
                        >
                          <ChevronRight
                            className={`h-4 w-4 mt-0.5 shrink-0 ${a.iconText}`}
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <span
                      className={`inline-flex items-center text-sm font-semibold gap-1.5 transition-all group-hover:gap-2.5 ${a.link}`}
                    >
                      Explore <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  5. DATA GRAPH SHOWCASE                                             */
/* ------------------------------------------------------------------ */
function DataGraphSection() {
  return (
    <Section variant="radial">
      <SectionHeader
        badge="Data Graph Intelligence"
        badgeVariant="cyan"
        title="See"
        titleGradient="every byte. Map every access path."
        description="Data Graph Intelligence reveals exactly who can access what — and traces the path attackers would take. The signature TechD differentiator."
      />

      <AnimatedSection>
        <div className="relative rounded-2xl border border-border/60 glass-card-elevated p-6 lg:p-10 overflow-hidden">
          <div className="absolute inset-0 grid-bg-dense opacity-40" />
          <div className="relative">
            <DataGraphVisual />
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.2}>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="rounded-xl border border-border/60 glass-card p-8 text-center">
            <MetricCounter value={43} suffix="+" label="Connectors" />
          </div>
          <div className="rounded-xl border border-border/60 glass-card p-8 text-center">
            <MetricCounter value={12} label="Remediation Actions" />
          </div>
          <div className="rounded-xl border border-border/60 glass-card p-8 text-center">
            <MetricCounter value={200} prefix="<" suffix="ms" label="P95 Latency" />
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  6. HOW IT WORKS                                                    */
/* ------------------------------------------------------------------ */
const howSteps = [
  {
    step: 1,
    icon: Search,
    title: "Discover",
    description:
      "Connect 43+ sources in minutes. Find every data store — cloud, SaaS, database, on-prem. Including the shadow data you didn't know existed.",
    color: "blue",
  },
  {
    step: 2,
    icon: Tags,
    title: "Classify",
    description:
      "AI engine identifies PII, PHI, PCI, custom types. Multi-language. Confidence-scored. Continuously learning.",
    color: "cyan",
  },
  {
    step: 3,
    icon: MapIcon,
    title: "Map Risk",
    description:
      "Build the data graph. Trace identity-to-data access. Surface attack paths and contextual risk in real time.",
    color: "purple",
  },
  {
    step: 4,
    icon: Wrench,
    title: "Remediate",
    description:
      "Trigger one of 12 native actions. Or queue a guided manual workflow. Hash-chained audit on every step.",
    color: "emerald",
  },
];

const stepColorMap: Record<string, { ring: string; bg: string; text: string }> = {
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
    <Section>
      <SectionHeader
        badge="How It Works"
        title="From discovery to remediation in"
        titleGradient="minutes, not months."
        description="A four-stage lifecycle that turns raw infrastructure into a continuously-governed, audit-ready data estate."
      />

      <AnimatedSection>
        <div className="relative">
          {/* Horizontal connector line for desktop */}
          <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-px bg-gradient-to-r from-blue-500/40 via-cyan-500/40 via-purple-500/40 to-emerald-500/40" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howSteps.map((s) => {
              const c = stepColorMap[s.color];
              return (
                <div key={s.step} className="relative text-center">
                  <div
                    className={`relative z-10 inline-flex items-center justify-center h-24 w-24 rounded-full border-2 ${c.ring} ${c.bg} mb-6 mx-auto bg-background`}
                  >
                    <s.icon className={`h-9 w-9 ${c.text}`} />
                    <span
                      className={`absolute -top-1 -right-1 h-7 w-7 rounded-full bg-background border-2 ${c.ring} flex items-center justify-center text-xs font-bold ${c.text}`}
                    >
                      {s.step}
                    </span>
                  </div>
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
/*  7. COMPARE TABLE                                                   */
/* ------------------------------------------------------------------ */
const compareCategories = [
  {
    category: "Platform Architecture",
    rows: [
      {
        feature: "Unified DSPM + PrivacyOps",
        values: ["yes", "partial", "no", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Hash-Chained Audit Log",
        values: ["yes", "no", "no", "partial"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Multi-Tenant RLS Enforcement",
        values: ["yes", "partial", "no", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Temporal Workflow Engine",
        values: ["yes", "no", "no", "no"] as ("yes" | "no" | "partial")[],
      },
    ],
  },
  {
    category: "DSPM Capabilities",
    rows: [
      {
        feature: "Data Graph Intelligence",
        values: ["yes", "partial", "yes", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Attack Path Analysis",
        values: ["yes", "no", "partial", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Native Remediation Actions",
        values: ["yes", "partial", "partial", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "43+ Native Connectors",
        values: ["yes", "yes", "partial", "partial"] as ("yes" | "no" | "partial")[],
      },
    ],
  },
  {
    category: "PrivacyOps Suite",
    rows: [
      {
        feature: "DPDPA Automation",
        values: ["yes", "partial", "no", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Consent Orchestration",
        values: ["yes", "yes", "no", "partial"] as ("yes" | "no" | "partial")[],
      },
    ],
  },
  {
    category: "AI & Governance",
    rows: [
      {
        feature: "Fail-Closed AI Redaction",
        values: ["yes", "no", "no", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "AI Governance Module",
        values: ["yes", "partial", "no", "no"] as ("yes" | "no" | "partial")[],
      },
      {
        feature: "Cyber Valley R&D",
        values: ["yes", "no", "no", "no"] as ("yes" | "no" | "partial")[],
      },
    ],
  },
];

function CompareSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Comparison"
        title="Why teams choose"
        titleGradient="TechD."
        description="Side-by-side capability comparison against the legacy and challenger DSPM and privacy vendors."
      />
      <AnimatedSection>
        <CompareTable
          competitors={["TechD", "OneTrust", "Redacto", "FOCTTA"]}
          categories={compareCategories}
        />
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  8. METRICS BAR                                                     */
/* ------------------------------------------------------------------ */
function MetricsBarSection() {
  return (
    <Section variant="radial">
      <AnimatedSection>
        <div className="rounded-2xl border border-border/60 glass-card-elevated p-10 lg:p-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
            <MetricCounter value={43} suffix="+" label="Connectors" />
            <MetricCounter value={12} label="Action Types" />
            <MetricCounter value={60} suffix="+" label="RLS Tables" />
            <MetricCounter value={99.99} suffix="%" label="SLA" />
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  9. COMPLIANCE / REGULATION RIBBON                                  */
/* ------------------------------------------------------------------ */
function ComplianceSection() {
  return (
    <Section pattern="dots">
      <SectionHeader
        badge="DPDPA · GDPR · HIPAA · 16+ frameworks"
        badgeVariant="amber"
        title=""
        titleGradient="Globally compliant, locally ready."
        description="From India's DPDPA to EU's GDPR — automated compliance across 16+ frameworks. Continuously mapped, continuously monitored, continuously audit-ready."
      />
      <AnimatedSection>
        <RegulationRibbon />
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  10. TESTIMONIALS                                                   */
/* ------------------------------------------------------------------ */
const testimonials = [
  {
    quote:
      "TechD replaced four separate vendors. The unified data graph alone changed how we run DSARs.",
    role: "VP Engineering",
    org: "Top-3 Indian Bank",
    industry: "BFSI",
  },
  {
    quote:
      "The attack path analysis surfaced 14 high-risk exposures our previous DSPM missed entirely.",
    role: "Director of Data Security",
    org: "Global Healthcare Network",
    industry: "Healthcare",
  },
];

function TestimonialSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Customer Voice"
        title="What security leaders are"
        titleGradient="actually saying."
      />
      <StaggerContainer className="grid md:grid-cols-2 gap-8">
        {testimonials.map((t) => (
          <StaggerItem key={t.org}>
            <Card className="h-full glass-card-elevated card-hover">
              <CardContent className="pt-8 pb-8 px-8">
                <Quote className="h-10 w-10 text-primary/30 mb-6" />
                <p className="text-lg leading-relaxed text-pretty mb-8 font-display">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="pt-6 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{t.role}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.org}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {t.industry}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <HeroSection />
      <LogoMarqueeSection />
      <DifferentiationSection />
      <ProductTriptychSection />
      <DataGraphSection />
      <HowItWorksSection />
      <CompareSection />
      <MetricsBarSection />
      <ComplianceSection />
      <TestimonialSection />
      <CTASection
        title="Stop chasing data risk."
        titleGradient="Start fixing it."
        description="See TechD PrivacyOps in action. 30-minute personalized demo with our solutions team."
        primaryCta="Book Enterprise Demo"
        primaryHref="/contact"
        secondaryCta="Explore Platform"
        secondaryHref="/platform"
      />
    </main>
  );
}
