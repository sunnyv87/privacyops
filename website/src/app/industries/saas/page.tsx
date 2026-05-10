"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCard } from "@/components/ui/icon-card";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTASection } from "@/components/shared/cta-section";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/animated-section";
import { cn } from "@/lib/utils";
import {
  Shield,
  Layers,
  Search,
  Globe,
  Code2,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  Lock,
  FileCheck,
  Zap,
  Database,
  Users,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const saasFeatures = [
  {
    icon: Layers,
    title: "Multi-Tenant Data Isolation",
    description:
      "Validate that customer data is properly isolated across your SaaS infrastructure. Detect cross-tenant data leakage risks before they become incidents.",
    glowColor: "cyan" as const,
  },
  {
    icon: Search,
    title: "Customer Data Discovery",
    description:
      "Automatically discover and classify customer data across your entire SaaS stack, including databases, object storage, caches, and message queues.",
    glowColor: "blue" as const,
  },
  {
    icon: CheckCircle2,
    title: "SOC 2 Automation",
    description:
      "Continuously collect evidence for SOC 2 Type II audits. Automated control monitoring, gap analysis, and audit-ready report generation.",
    glowColor: "green" as const,
  },
  {
    icon: Globe,
    title: "GDPR & CCPA Compliance",
    description:
      "Serve global customers confidently with automated data mapping, consent management, DSAR fulfillment, and cross-border transfer governance.",
    glowColor: "purple" as const,
  },
];

const technicalCapabilities = [
  {
    icon: Code2,
    title: "API-First Architecture",
    description:
      "Every capability available via REST API. Integrate data security directly into your product workflows, onboarding, and customer-facing dashboards.",
    glowColor: "cyan" as const,
  },
  {
    icon: GitBranch,
    title: "CI/CD Integration",
    description:
      "Shift-left data security with pipeline integrations for GitHub Actions, GitLab CI, and Jenkins. Scan for data exposure in every deployment.",
    glowColor: "blue" as const,
  },
  {
    icon: Zap,
    title: "Real-Time Scanning",
    description:
      "Continuous monitoring of data flows across your infrastructure. Detect new sensitive data exposure within minutes of it appearing.",
    glowColor: "purple" as const,
  },
  {
    icon: Database,
    title: "43+ Connectors",
    description:
      "Native integrations with PostgreSQL, MongoDB, S3, BigQuery, Snowflake, Redis, Elasticsearch, and dozens more data stores your SaaS relies on.",
    glowColor: "green" as const,
  },
];

const complianceFrameworks = [
  {
    icon: Shield,
    title: "SOC 2 Type II",
    description:
      "Automated evidence collection for Trust Services Criteria. Continuous monitoring of all five categories with real-time gap identification.",
    glowColor: "green" as const,
  },
  {
    icon: Globe,
    title: "GDPR",
    description:
      "Full data mapping, lawful basis tracking, DSAR automation, and Data Protection Impact Assessment tooling for EU compliance.",
    glowColor: "blue" as const,
  },
  {
    icon: Lock,
    title: "CCPA / CPRA",
    description:
      "Consumer data inventory, opt-out management, data deletion workflows, and automated disclosure generation for California privacy law.",
    glowColor: "purple" as const,
  },
  {
    icon: FileCheck,
    title: "ISO 27001",
    description:
      "Information security management system support with control mapping, risk assessment tooling, and continuous audit preparation.",
    glowColor: "cyan" as const,
  },
  {
    icon: Users,
    title: "Privacy by Design",
    description:
      "Embed data protection into your product lifecycle with automated data flow mapping, retention policy enforcement, and consent tracking.",
    glowColor: "green" as const,
  },
  {
    icon: Settings,
    title: "Custom Frameworks",
    description:
      "Build custom compliance frameworks for industry-specific or customer-mandated requirements. Map controls to any regulatory standard.",
    glowColor: "cyan" as const,
  },
];

export default function SaaSPage() {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="cyan" className="mb-6">
              SaaS
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              DSPM Built for{" "}
              <span className="gradient-text">SaaS Scale</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover, classify, and protect customer data across your
              multi-tenant infrastructure. Automate SOC 2, GDPR, and CCPA
              compliance without slowing down your engineering team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/platform">View Platform</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Core SaaS Features */}
      <Section>
        <SectionHeader
          badge="SaaS Data Security"
          title="Built for"
          titleGradient="Multi-Tenant Architectures"
          description="TechD PrivacyOps understands the unique data security challenges of SaaS companies serving global customers."
        />
        <StaggerContainer className="grid md:grid-cols-2 gap-6">
          {saasFeatures.map((feature) => (
            <StaggerItem key={feature.title}>
              <IconCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                glowColor={feature.glowColor}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* Technical Capabilities */}
      <Section variant="muted">
        <SectionHeader
          badge="Developer Experience"
          title="API-First"
          titleGradient="Security Platform"
          description="Designed for engineering teams. Integrate data security into your existing workflows and CI/CD pipelines."
        />
        <StaggerContainer className="grid md:grid-cols-2 gap-6">
          {technicalCapabilities.map((cap) => (
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

      {/* Compliance Frameworks */}
      <Section>
        <SectionHeader
          badge="Compliance"
          title="Every Framework Your"
          titleGradient="Customers Require"
          description="Automate compliance across the frameworks your enterprise customers demand during procurement and security reviews."
        />
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {complianceFrameworks.map((framework) => (
            <StaggerItem key={framework.title}>
              <IconCard
                icon={framework.icon}
                title={framework.title}
                description={framework.description}
                glowColor={framework.glowColor}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* CTA */}
      <CTASection
        title="Ship Faster with"
        titleGradient="Built-In Compliance."
        description="See how SaaS companies use TechD PrivacyOps to turn security into a competitive advantage and close enterprise deals faster."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="View Integrations"
        secondaryHref="/connectors"
      />
    </main>
  );
}
