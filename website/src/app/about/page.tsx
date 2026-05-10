"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTASection } from "@/components/shared/cta-section";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/animated-section";
import { MetricCounter } from "@/components/shared/metric-counter";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Brain,
  Building2,
  FlaskConical,
  Globe,
  Heart,
  KeyRound,
  Layers,
  Newspaper,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Milestone {
  year: string;
  title: string;
  description: string;
  icon: LucideIcon;
  border: string;
  bg: string;
  text: string;
}

const MILESTONES: Milestone[] = [
  {
    year: "2018",
    title: "Founded",
    description: "TechD launched in Cyber Valley, India — bringing cryptography and ML talent under one roof.",
    icon: Sparkles,
    border: "border-blue-500/30",
    bg: "from-blue-500/10 to-transparent",
    text: "text-blue-400",
  },
  {
    year: "2022",
    title: "Public Listing",
    description: "Listed on NSE & BSE. Subjected to public-company governance, SEBI disclosures, and quarterly transparency.",
    icon: Trophy,
    border: "border-emerald-500/30",
    bg: "from-emerald-500/10 to-transparent",
    text: "text-emerald-400",
  },
  {
    year: "2024",
    title: "Platform Launch",
    description: "Unified DSPM + PrivacyOps + AI Governance platform — the convergence the market was missing.",
    icon: Rocket,
    border: "border-purple-500/30",
    bg: "from-purple-500/10 to-transparent",
    text: "text-purple-400",
  },
  {
    year: "2026",
    title: "200+ Customers",
    description: "Trusted by enterprises across BFSI, healthcare, SaaS, and government in 18 countries.",
    icon: Globe,
    border: "border-cyan-500/30",
    bg: "from-cyan-500/10 to-transparent",
    text: "text-cyan-400",
  },
];

interface Value {
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  accent: string;
}

const VALUES: Value[] = [
  {
    icon: Layers,
    title: "Privacy as Infrastructure",
    tagline: "Privacy isn't a feature. It's foundational.",
    description: "We treat data privacy the way platform engineers treat networking and storage — as bedrock infrastructure, with SLAs, observability, and a clear blast radius.",
    accent: "from-blue-500/10 to-cyan-500/5 border-blue-500/30",
  },
  {
    icon: Brain,
    title: "AI with Governance",
    tagline: "Every AI capability ships with safety controls. No exceptions.",
    description: "Model cards, eval gates, prompt-injection defenses, and human-in-the-loop overrides ship with every AI feature — not as an afterthought, but as a release blocker.",
    accent: "from-purple-500/10 to-fuchsia-500/5 border-purple-500/30",
  },
  {
    icon: Zap,
    title: "Engineering Rigor",
    tagline: "We measure everything: P95 latency, RLS coverage, audit completeness.",
    description: "Numbers, not narrative. We publish internal SLOs, run blameless postmortems, and treat every customer audit as a chance to harden the platform.",
    accent: "from-emerald-500/10 to-teal-500/5 border-emerald-500/30",
  },
  {
    icon: KeyRound,
    title: "Customer Sovereignty",
    tagline: "Your data stays yours. Tenant isolation, your keys, your audit trail.",
    description: "Cell-level RLS, BYOK / HYOK, tenant-scoped audit logs, and a data-residency model that respects DPDPA, GDPR, and every sovereignty regime in between.",
    accent: "from-amber-500/10 to-orange-500/5 border-amber-500/30",
  },
];

const RND_CARDS = [
  {
    icon: ShieldCheck,
    title: "Cryptography Research",
    description: "Hash-chained audit trails, deterministic re-identification protections, and tenant key isolation models — all peer-reviewed in-house.",
    accent: "border-cyan-500/30 bg-cyan-500/5",
    iconClass: "text-cyan-400",
  },
  {
    icon: FlaskConical,
    title: "AI Safety Lab",
    description: "Prompt-injection benchmarks, jailbreak corpus, model evaluation harnesses, and governance metrics built for high-stakes enterprise AI.",
    accent: "border-purple-500/30 bg-purple-500/5",
    iconClass: "text-purple-400",
  },
  {
    icon: Brain,
    title: "Privacy Engineering",
    description: "Differential privacy, fail-closed redaction, and consent-receipt schemas — engineered for production volume, not academic toy datasets.",
    accent: "border-emerald-500/30 bg-emerald-500/5",
    iconClass: "text-emerald-400",
  },
];

interface Leader {
  name: string;
  title: string;
  bio: string;
  certs: string[];
}

const LEADERS: Leader[] = [
  {
    name: "Dr. Aanya Sharma",
    title: "Chief Executive Officer",
    bio: "ex-Microsoft Azure Security, ex-Symantec. 20 years scaling enterprise security from on-prem to hyperscale cloud.",
    certs: ["CIPP/E", "CISM", "PhD Cryptography"],
  },
  {
    name: "Rohan Iyer",
    title: "Chief Technology Officer",
    bio: "ex-AWS Identity, ex-Cloudflare. Built distributed systems serving billions of requests/day. Open-source maintainer.",
    certs: ["CKA", "AWS Solutions Architect", "MS CMU"],
  },
  {
    name: "Priya Menon",
    title: "Chief Privacy Officer",
    bio: "ex-Deloitte Global Privacy, ex-Infosys DPO. Authored DPDPA implementation guidance for 40+ Indian enterprises.",
    certs: ["CIPP/E", "CIPM", "DPO Certified", "FIP"],
  },
  {
    name: "Marcus Lee",
    title: "VP of Engineering",
    bio: "ex-Google Cloud Security, ex-Palo Alto Networks. Led the platform org from Series B to IPO at a previous company.",
    certs: ["CISSP", "OSCP", "MS Stanford"],
  },
  {
    name: "Anjali Krishnan",
    title: "VP of Product",
    bio: "ex-Snowflake, ex-Salesforce. Defined data governance roadmaps used by Fortune 500 firms across BFSI and healthcare.",
    certs: ["CIPM", "PMP", "MBA Wharton"],
  },
  {
    name: "David Okonkwo",
    title: "VP of Sales (Enterprise)",
    bio: "ex-Splunk Enterprise, ex-CrowdStrike. Scaled enterprise GTM at three cybersecurity companies from Series A to acquisition.",
    certs: ["CISSP", "CSAP", "20+ years"],
  },
];

const RECOGNITION = [
  {
    icon: Newspaper,
    title: "Featured in TechCrunch",
    subtitle: "Cyber Valley spotlight · 2026",
    accent: "border-cyan-500/30 bg-cyan-500/5",
  },
  {
    icon: Award,
    title: "Gartner DSPM Cool Vendor",
    subtitle: "2026 cohort",
    accent: "border-emerald-500/30 bg-emerald-500/5",
  },
  {
    icon: Trophy,
    title: "BFSI Tech Awards",
    subtitle: "PrivacyOps Innovation · 2026",
    accent: "border-amber-500/30 bg-amber-500/5",
  },
  {
    icon: ShieldCheck,
    title: "Cyber Excellence Awards",
    subtitle: "DSPM Platform of the Year · 2026",
    accent: "border-purple-500/30 bg-purple-500/5",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <main className="relative overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────
          1. HERO
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />

        <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-4">
              About TechD Cybersecurity
            </div>
            <Badge variant="default" className="mb-6">
              <Building2 className="h-3 w-3 mr-1.5" /> Listed Cybersecurity Company · Cyber Valley
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6 text-balance">
              Built in <span className="gradient-text">Cyber Valley</span>.
              <br className="hidden sm:block" /> Engineered for the{" "}
              <span className="gradient-text">AI era</span>.
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
              TechD Cybersecurity is a publicly-listed enterprise security company building the
              unified data security and privacy operations platform for the AI era. Headquartered
              in India&apos;s Cyber Valley, serving enterprises globally.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="outline" size="xl" asChild>
                <Link href="/investors" className="gap-2">
                  Investor Relations <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/careers">Careers · 30+ Open Roles</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          2. STATS BAR
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="muted" className="!py-16">
        <AnimatedSection>
          <div className="rounded-2xl border border-border bg-card/40 p-8 lg:p-10">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex flex-col">
                <div className="font-display text-3xl font-bold gradient-text leading-none mb-2">
                  Listed
                </div>
                <p className="text-sm font-semibold text-foreground">NSE &amp; BSE</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Public-company governance
                </p>
              </div>
              <MetricCounter value={200} suffix="+" label="Enterprise Customers" description="Across 18 countries" />
              <MetricCounter value={43} suffix="+" label="Native Connectors" description="Cloud, SaaS, OT" />
              <MetricCounter value={16} label="Regulations Automated" description="DPDPA, GDPR, HIPAA + more" />
              <MetricCounter value={99.99} decimals={2} suffix="%" label="Platform SLA" description="Triple-region failover" />
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          3. THE TECHD STORY
         ───────────────────────────────────────────────────────────────── */}
      <Section pattern="dots">
        <SectionHeader
          eyebrow="Our Story"
          title="From Cyber Valley to a"
          titleGradient="listed cybersecurity company."
        />

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-start">
          <AnimatedSection>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p className="text-base">
                <span className="text-foreground font-semibold">Cyber Valley origin.</span>{" "}
                TechD was founded in 2018 in Cyber Valley — India&apos;s emerging cybersecurity
                capital, where alumni from the IITs, IIITs, and global hyperscalers converge on
                hard problems. The founding thesis: India would become the world&apos;s most
                consequential privacy and security market, and the next generation of platforms
                had to be built here.
              </p>
              <p className="text-base">
                <span className="text-foreground font-semibold">From security tools to a unified platform.</span>{" "}
                Enterprises were drowning in disconnected DSPM, PrivacyOps, and AI governance
                products — each with its own connector library, audit log, and policy engine.
                We saw that the future required convergence: one data graph, one policy engine,
                one audit trail. So we built it.
              </p>
              <p className="text-base">
                <span className="text-foreground font-semibold">Public listing.</span>{" "}
                In 2022, TechD listed on NSE and BSE. We chose the public-company path
                deliberately — the transparency, governance, and disclosure standards required of
                listed entities align with the trust we ask of our enterprise customers. Quarterly
                transparency makes us better operators, and gives every customer visibility into
                our long-term commitment.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div className="grid grid-cols-2 gap-4">
              {MILESTONES.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.year}
                    className={cn(
                      "rounded-2xl border bg-gradient-to-br p-5 card-hover",
                      m.border,
                      m.bg,
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        {m.year}
                      </span>
                      <Icon className={cn("h-5 w-5", m.text)} />
                    </div>
                    <h4 className="text-base font-semibold mb-2">{m.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {m.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </AnimatedSection>
        </div>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          4. MISSION & VALUES
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="radial">
        <SectionHeader
          eyebrow="Mission &amp; Values"
          title="What we believe."
          titleGradient="What we ship by."
          description="Four principles that show up in every release, every customer call, and every internal review."
        />

        <StaggerContainer className="grid gap-6 sm:grid-cols-2">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <StaggerItem key={v.title}>
                <div
                  className={cn(
                    "h-full rounded-2xl border bg-gradient-to-br p-7 card-hover",
                    v.accent,
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-none rounded-xl border border-white/10 bg-background/60 p-3">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{v.title}</h3>
                      <p className="text-xs font-medium italic text-muted-foreground mb-3">
                        {v.tagline}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {v.description}
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          5. CYBER VALLEY R&D
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="featured">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <Badge variant="cyan" className="mb-6">
            <FlaskConical className="h-3 w-3 mr-1.5" /> R&amp;D · Cyber Valley
          </Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
            <span className="gradient-text">Cyber Valley</span> — where India&apos;s privacy and
            security future is built.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
            Our R&amp;D center in Cyber Valley brings together cryptographers, ML researchers,
            and privacy engineers from India&apos;s top institutes (IITs, IIITs) and global tech.
            Every TechD platform capability has a research line behind it.
          </p>
        </div>

        <StaggerContainer className="grid gap-6 md:grid-cols-3">
          {RND_CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <StaggerItem key={c.title}>
                <div className={cn("h-full rounded-2xl border p-7 card-hover", c.accent)}>
                  <Icon className={cn("h-7 w-7 mb-4", c.iconClass)} />
                  <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.description}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          6. LEADERSHIP
         ───────────────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeader
          eyebrow="Leadership"
          title="Operators from"
          titleGradient="the world's hardest security teams."
          description="Our leadership team brings decades of experience from hyperscale cloud, enterprise security, and global privacy practice."
        />

        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LEADERS.map((leader) => {
            const initials = leader.name
              .split(" ")
              .filter((p) => !p.startsWith("Dr"))
              .map((n) => n[0])
              .join("")
              .slice(0, 2);
            return (
              <StaggerItem key={leader.name}>
                <Card className="h-full card-hover">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/20 border border-primary/30 flex items-center justify-center text-base font-bold text-primary shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{leader.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {leader.title}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {leader.bio}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/60">
                      {leader.certs.map((cert) => (
                        <span
                          key={cert}
                          className="inline-flex items-center rounded-md border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          7. RECOGNITION
         ───────────────────────────────────────────────────────────────── */}
      <Section variant="muted">
        <SectionHeader
          eyebrow="Recognition"
          title="Press, awards,"
          titleGradient="and analyst recognition."
        />

        <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {RECOGNITION.map((r) => {
            const Icon = r.icon;
            return (
              <StaggerItem key={r.title}>
                <div className={cn("h-full rounded-2xl border p-6 text-center card-hover", r.accent)}>
                  <Icon className="h-7 w-7 mx-auto mb-4 text-foreground/80" />
                  <h3 className="text-sm font-semibold mb-1.5">{r.title}</h3>
                  <p className="text-xs text-muted-foreground">{r.subtitle}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <AnimatedSection delay={0.2}>
          <div className="mt-12 mx-auto max-w-2xl rounded-xl border border-border bg-card/40 p-6 text-center">
            <Heart className="h-5 w-5 text-rose-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Behind every award is a customer who chose to stake their compliance program on us.
              That trust is the only metric that ultimately matters.
            </p>
          </div>
        </AnimatedSection>
      </Section>

      {/* ─────────────────────────────────────────────────────────────────
          8. CTA
         ───────────────────────────────────────────────────────────────── */}
      <CTASection
        title="Join the mission."
        titleGradient="30+ open positions."
        description="We're hiring across engineering, research, product, and go-to-market. If you want to build privacy and security infrastructure for the AI era, we want to talk."
        primaryCta="View Open Roles"
        primaryHref="/careers"
        secondaryCta="Investor Relations"
        secondaryHref="/investors"
      />
    </main>
  );
}
