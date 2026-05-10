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
  Search,
  Tags,
  FileCheck,
  ToggleRight,
  Wrench,
  Scale,
  Bot,
  Activity,
  Database,
  Cloud,
  Server,
  Globe,
  Lock,
  ChevronRight,
  Layers,
  Brain,
  Zap,
  CheckCircle2,
  Quote,
  Star,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  1. HERO SECTION                                                    */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 radial-hero" />
      <div className="absolute inset-0 grid-bg" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-24 pb-16 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <Badge variant="cyan" className="mb-6">
              AI-Native DSPM + PrivacyOps Platform
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Discover, Classify, and Remediate Data Risk{" "}
              <span className="gradient-text">Automatically.</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed mb-8">
              The enterprise platform that unifies Data Security Posture
              Management and Privacy Operations — powered by AI to find
              sensitive data, score risk, and drive remediation across your
              entire infrastructure.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/platform">Explore Platform</Link>
              </Button>
            </div>

            {/* Trust bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex items-center gap-3 text-xs text-muted-foreground"
            >
              <Shield className="h-4 w-4 text-primary" />
              <span>Trusted by Fortune 500 enterprises, global banks, and healthcare leaders</span>
            </motion.div>
          </motion.div>

          {/* Right — Animated dashboard preview */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="animate-float">
              <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 glow-border">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-sm font-medium">Risk Overview</span>
                  <Badge variant="green">Live</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {[
                    { label: "Data Sources", value: "43+", color: "text-blue-400" },
                    { label: "PII Records", value: "2.4M", color: "text-cyan-400" },
                    { label: "Risk Score", value: "94/100", color: "text-emerald-400" },
                    { label: "Remediations", value: "1,247", color: "text-purple-400" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-background/60 border border-border p-3">
                      <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                      <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: "82%" }}
                    transition={{ duration: 1.5, delay: 0.8 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">82% of sensitive data remediated</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2. TRUSTED BY                                                      */
/* ------------------------------------------------------------------ */
const logos = [
  "Global Bank", "Healthcare Corp", "Fortune Tech", "FinServ Group",
  "InsureCo", "Retail Giant", "CloudFirst Inc", "DataSec Ltd",
];

function TrustedBySection() {
  return (
    <Section variant="muted" className="py-16 lg:py-20">
      <AnimatedSection>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Trusted by security-forward enterprises worldwide
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6">
          {logos.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center h-12 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground font-medium"
            >
              {name}
            </div>
          ))}
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  3. PLATFORM OVERVIEW                                               */
/* ------------------------------------------------------------------ */
const pillars = [
  {
    icon: Shield,
    title: "DSPM",
    subtitle: "Data Security Posture Management",
    description:
      "Continuously discover and classify sensitive data across your cloud, databases, and SaaS. Quantify risk posture and surface misconfigurations before they become breaches.",
    href: "/dspm",
    color: "blue" as const,
  },
  {
    icon: Scale,
    title: "PrivacyOps",
    subtitle: "Privacy Operations Automation",
    description:
      "Automate DSARs, manage consent, and maintain compliance workflows. Turn complex privacy regulations into executable, auditable processes.",
    href: "/privacyops",
    color: "cyan" as const,
  },
  {
    icon: Brain,
    title: "AI Intelligence",
    subtitle: "AI Co-Pilot & Governance",
    description:
      "Natural-language co-pilot for security teams, auto-generated compliance narratives, and AI governance controls to manage model risk.",
    href: "/ai-copilot",
    color: "purple" as const,
  },
];

const pillarBorderMap = {
  blue: "hover:border-blue-500/40",
  cyan: "hover:border-cyan-500/40",
  purple: "hover:border-purple-500/40",
};

const pillarIconBg = {
  blue: "bg-blue-500/10 text-blue-400",
  cyan: "bg-cyan-500/10 text-cyan-400",
  purple: "bg-purple-500/10 text-purple-400",
};

function PlatformOverviewSection() {
  return (
    <Section variant="radial">
      <SectionHeader
        badge="Platform"
        title="One Platform."
        titleGradient="Complete Data Intelligence."
        description="Three integrated pillars that give your security and privacy teams a single source of truth."
      />
      <StaggerContainer className="grid md:grid-cols-3 gap-8">
        {pillars.map((p) => (
          <StaggerItem key={p.title}>
            <Link href={p.href} className="block h-full">
              <Card className={`h-full card-hover ${pillarBorderMap[p.color]}`}>
                <CardHeader>
                  <div className={`inline-flex rounded-lg p-2.5 mb-3 ${pillarIconBg[p.color]}`}>
                    <p.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{p.title}</CardTitle>
                  <CardDescription>{p.subtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {p.description}
                  </p>
                  <span className="inline-flex items-center text-sm text-primary font-medium gap-1 group-hover:gap-2 transition-all">
                    Learn more <ChevronRight className="h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  4. FEATURE GRID                                                    */
/* ------------------------------------------------------------------ */
const features = [
  { icon: Search, title: "Data Discovery", description: "Scan structured and unstructured data stores to build a comprehensive data map across your entire infrastructure.", glowColor: "blue" as const },
  { icon: Tags, title: "Classification", description: "AI-powered classifiers identify PII, PHI, PCI, and custom data types with enterprise-grade accuracy.", glowColor: "cyan" as const },
  { icon: FileCheck, title: "DSAR Automation", description: "Fulfill data subject access requests in minutes instead of weeks with automated discovery and packaging.", glowColor: "purple" as const },
  { icon: ToggleRight, title: "Consent Management", description: "Centralized consent lifecycle management with real-time enforcement across all downstream systems.", glowColor: "green" as const },
  { icon: Wrench, title: "Remediation Engine", description: "12 built-in remediation actions — from masking and encryption to access revocation and data deletion.", glowColor: "blue" as const },
  { icon: Scale, title: "Compliance Automation", description: "Continuous monitoring mapped to GDPR, CCPA, HIPAA, and eight additional regulatory frameworks.", glowColor: "cyan" as const },
  { icon: Bot, title: "AI Co-Pilot", description: "Ask questions in plain English. Get instant insights, generate reports, and trigger actions conversationally.", glowColor: "purple" as const },
  { icon: Activity, title: "Real-time Monitoring", description: "Live dashboards and alerting for data access anomalies, policy violations, and posture drift.", glowColor: "green" as const },
];

function FeatureGridSection() {
  return (
    <Section>
      <SectionHeader
        badge="Capabilities"
        title="Everything You Need to"
        titleGradient="Secure Sensitive Data"
        description="A comprehensive feature set purpose-built for enterprise data security and privacy teams."
      />
      <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f) => (
          <StaggerItem key={f.title}>
            <IconCard
              icon={f.icon}
              title={f.title}
              description={f.description}
              glowColor={f.glowColor}
            />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  5. ARCHITECTURE VISUALIZATION                                      */
/* ------------------------------------------------------------------ */
const archStages = [
  { label: "Connectors", sub: "43+ Sources", color: "border-blue-500/50", bg: "bg-blue-500/10", text: "text-blue-400" },
  { label: "Ingestion", sub: "Real-time", color: "border-cyan-500/50", bg: "bg-cyan-500/10", text: "text-cyan-400" },
  { label: "Classification", sub: "AI Engine", color: "border-purple-500/50", bg: "bg-purple-500/10", text: "text-purple-400" },
  { label: "Risk Engine", sub: "Scoring", color: "border-emerald-500/50", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  { label: "AI Layer", sub: "Co-Pilot", color: "border-purple-500/50", bg: "bg-purple-500/10", text: "text-purple-400" },
  { label: "Dashboard", sub: "Insights", color: "border-blue-500/50", bg: "bg-blue-500/10", text: "text-blue-400" },
];

function ArchitectureSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Architecture"
        title="Enterprise-Grade"
        titleGradient="Architecture"
        description="A multi-layered pipeline from ingestion to insight — built for scale, security, and speed."
      />
      <AnimatedSection>
        <div className="relative rounded-xl border border-border bg-card/50 p-8 lg:p-12 overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-40" />

          {/* Desktop flow */}
          <div className="relative hidden md:flex items-center justify-between gap-2">
            {archStages.map((stage, i) => (
              <div key={stage.label} className="flex items-center gap-2 flex-1">
                <div className={`flex-1 rounded-lg border ${stage.color} ${stage.bg} p-4 text-center`}>
                  <p className={`text-sm font-semibold ${stage.text}`}>{stage.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stage.sub}</p>
                  <div className="mt-2 mx-auto h-1 w-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse-glow" />
                </div>
                {i < archStages.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Mobile stack */}
          <div className="relative flex flex-col gap-3 md:hidden">
            {archStages.map((stage, i) => (
              <div key={stage.label}>
                <div className={`rounded-lg border ${stage.color} ${stage.bg} p-4 text-center`}>
                  <p className={`text-sm font-semibold ${stage.text}`}>{stage.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stage.sub}</p>
                </div>
                {i < archStages.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="h-4 w-px bg-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  6. REMEDIATION STORY                                               */
/* ------------------------------------------------------------------ */
const remediationSteps = [
  {
    step: 1,
    title: "Discover",
    description: "Scan and discover sensitive data across 43+ connectors — cloud, databases, SaaS, and on-prem.",
    icon: Search,
    color: "text-blue-400",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
  },
  {
    step: 2,
    title: "Classify & Score",
    description: "AI classifies data types (PII, PHI, PCI) and assigns contextual risk scores automatically.",
    icon: Brain,
    color: "text-cyan-400",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
  },
  {
    step: 3,
    title: "Remediate",
    description: "Trigger automated remediation — masking, encryption, access revocation — or guided manual actions.",
    icon: Wrench,
    color: "text-emerald-400",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
  },
];

function RemediationSection() {
  return (
    <Section variant="radial">
      <SectionHeader
        badge="How It Works"
        title="From Detection to Remediation"
        titleGradient="in Minutes"
        description="Three steps to transform your data security posture from reactive to proactive."
      />
      <AnimatedSection>
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-px bg-gradient-to-r from-blue-500/40 via-cyan-500/40 to-emerald-500/40" />

          {remediationSteps.map((s) => (
            <div key={s.step} className="relative text-center">
              <div className={`inline-flex items-center justify-center h-12 w-12 rounded-full border-2 ${s.border} ${s.bg} mb-5 mx-auto`}>
                <span className={`text-lg font-bold ${s.color}`}>{s.step}</span>
              </div>
              <div className={`inline-flex rounded-lg p-2.5 mb-4 ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  7. CONNECTORS OVERVIEW                                             */
/* ------------------------------------------------------------------ */
const connectorCategories = [
  {
    category: "Cloud",
    icon: Cloud,
    items: ["AWS S3", "Azure Blob", "GCP Storage"],
    color: "text-blue-400",
  },
  {
    category: "Databases",
    icon: Database,
    items: ["PostgreSQL", "MySQL", "Snowflake", "BigQuery", "MongoDB", "SQL Server"],
    color: "text-cyan-400",
  },
  {
    category: "SaaS",
    icon: Globe,
    items: ["Salesforce", "Okta"],
    color: "text-purple-400",
  },
  {
    category: "Infrastructure",
    icon: Server,
    items: ["On-Prem File Shares", "APIs", "Data Lakes"],
    color: "text-emerald-400",
  },
];

function ConnectorsSection() {
  return (
    <Section>
      <SectionHeader
        badge="Integrations"
        title="43+ Enterprise"
        titleGradient="Connectors"
        description="Connect to every data store in your stack. New connectors added every month."
      />
      <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {connectorCategories.map((cat) => (
          <StaggerItem key={cat.category}>
            <Card className="card-hover h-full">
              <CardHeader>
                <cat.icon className={`h-5 w-5 mb-2 ${cat.color}`} />
                <CardTitle>{cat.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((item) => (
                    <Badge key={item} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
      <AnimatedSection delay={0.2}>
        <div className="text-center">
          <Badge variant="cyan" className="text-sm px-5 py-1.5">
            43+ connectors and growing
          </Badge>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  8. COMPLIANCE COVERAGE                                             */
/* ------------------------------------------------------------------ */
const regulations = [
  { name: "GDPR", region: "EU" },
  { name: "CCPA / CPRA", region: "California" },
  { name: "HIPAA", region: "US Healthcare" },
  { name: "ISO 27001", region: "International" },
  { name: "SOC 2", region: "International" },
  { name: "PCI DSS", region: "Payment Industry" },
  { name: "DPDP", region: "India" },
  { name: "LGPD", region: "Brazil" },
];

function ComplianceSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Compliance"
        title="Continuous Compliance"
        titleGradient="Monitoring"
        description="Map your data posture to major regulatory frameworks automatically. Stay audit-ready 24/7."
      />
      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {regulations.map((reg) => (
          <StaggerItem key={reg.name}>
            <div className="rounded-xl border border-border bg-card p-5 text-center card-hover">
              <Lock className="h-5 w-5 text-primary mx-auto mb-3" />
              <p className="font-semibold text-sm mb-1">{reg.name}</p>
              <p className="text-xs text-muted-foreground">{reg.region}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
      <AnimatedSection delay={0.3}>
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Continuous compliance monitoring across all frameworks
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  9. METRICS / STATS                                                 */
/* ------------------------------------------------------------------ */
const stats = [
  { value: "43+", label: "Connectors", color: "text-blue-400" },
  { value: "12", label: "Remediation Actions", color: "text-cyan-400" },
  { value: "60+", label: "RLS-Protected Tables", color: "text-purple-400" },
  { value: "99.9%", label: "Uptime SLA", color: "text-emerald-400" },
];

function MetricsSection() {
  return (
    <Section>
      <AnimatedSection>
        <div className="rounded-xl border border-border bg-card/50 glow-border p-10 lg:p-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <motion.p
                  className={`text-4xl lg:text-5xl font-bold mb-2 ${s.color}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, type: "spring" }}
                >
                  {s.value}
                </motion.p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
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
      "TechD PrivacyOps cut our DSAR response time from three weeks to under 48 hours. The AI classification accuracy is unlike anything we have evaluated before.",
    name: "Sarah Chen",
    title: "CISO",
    company: "Fortune 500 Financial Services",
  },
  {
    quote:
      "We achieved continuous HIPAA compliance across 200+ data stores within the first quarter. The remediation engine alone justified the investment.",
    name: "Michael Torres",
    title: "VP of Data Security",
    company: "National Healthcare Network",
  },
];

function TestimonialSection() {
  return (
    <Section variant="radial">
      <SectionHeader
        badge="Customers"
        title="Trusted by"
        titleGradient="Security Leaders"
      />
      <StaggerContainer className="grid md:grid-cols-2 gap-8">
        {testimonials.map((t) => (
          <StaggerItem key={t.name}>
            <Card className="h-full card-hover">
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/30 mb-4" />
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.title}, {t.company}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5 mt-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
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
    <>
      <HeroSection />
      <TrustedBySection />
      <PlatformOverviewSection />
      <FeatureGridSection />
      <ArchitectureSection />
      <RemediationSection />
      <ConnectorsSection />
      <ComplianceSection />
      <MetricsSection />
      <TestimonialSection />
      <CTASection
        title="Ready to Secure Your Data?"
        titleGradient="Automatically."
        description="Join enterprises worldwide who trust TechD PrivacyOps to discover, classify, and remediate data risk across their entire infrastructure."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Explore Platform"
        secondaryHref="/platform"
      />
    </>
  );
}
