"use client";

import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import { CTASection } from "@/components/shared/cta-section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Building2,
  Globe,
  GitMerge,
  BarChart3,
  Plug,
  Shield,
  Users,
  Database,
  Lock,
  FileSearch,
  Layers,
} from "lucide-react";
import Link from "next/link";

const challenges = [
  {
    icon: Globe,
    title: "Multi-Cloud Discovery",
    description:
      "Discover and classify sensitive data across AWS, Azure, GCP, on-premises databases, and SaaS applications from a single pane of glass.",
    glowColor: "blue" as const,
  },
  {
    icon: FileSearch,
    title: "Global Compliance",
    description:
      "Orchestrate compliance across GDPR, CCPA, HIPAA, DPDP, LGPD, and 10+ regulations simultaneously with automated control mapping.",
    glowColor: "cyan" as const,
  },
  {
    icon: GitMerge,
    title: "M&A Data Due Diligence",
    description:
      "Rapidly assess data risk posture during mergers and acquisitions by scanning target infrastructure for sensitive data exposure.",
    glowColor: "purple" as const,
  },
  {
    icon: BarChart3,
    title: "Board-Level Reporting",
    description:
      "Executive dashboards with real-time compliance posture, risk trends, and remediation velocity for board and C-suite presentations.",
    glowColor: "green" as const,
  },
  {
    icon: Plug,
    title: "43+ Connector Ecosystem",
    description:
      "Connect your entire data landscape with pre-built connectors for cloud storage, databases, SaaS, identity providers, and security tools.",
    glowColor: "blue" as const,
  },
  {
    icon: Layers,
    title: "Workflow Automation",
    description:
      "8 Temporal workflow queues automate scanning, DSAR, breach notification, retention, approval, vendor management, and remediation at scale.",
    glowColor: "cyan" as const,
  },
];

const stats = [
  { value: "43+", label: "Connectors", description: "Pre-built integrations" },
  { value: "12", label: "Remediation Actions", description: "Automated response types" },
  { value: "10+", label: "Regulations", description: "Compliance frameworks" },
  { value: "<5min", label: "Time to Insight", description: "From scan to actionable risk" },
];

export default function EnterprisesPage() {
  return (
    <>
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 radial-hero grid-bg">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="default" className="mb-6">
                <Building2 className="h-3 w-3 mr-1.5" /> Enterprise
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
                Enterprise-Scale{" "}
                <span className="gradient-text">Data Intelligence</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
                For organizations with complex, distributed data landscapes. Unified DSPM and PrivacyOps
                across clouds, regions, and business units — powered by AI.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="glow" size="lg" asChild>
                  <Link href="/contact" className="gap-2">
                    Book Executive Demo <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="secondary" size="lg" asChild>
                  <Link href="/platform">Platform Architecture</Link>
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <Section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {stats.map((stat, i) => (
            <AnimatedSection key={stat.label} delay={i * 0.08}>
              <div className="rounded-xl border border-border bg-card p-6 text-center card-hover">
                <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm font-semibold mb-1">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.description}</div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </Section>

      <Section variant="muted">
        <SectionHeader
          badge="Enterprise Challenges"
          title="Built for"
          titleGradient="Enterprise Complexity"
          description="Large organizations need more than point solutions. TechD PrivacyOps provides unified data intelligence across your entire ecosystem."
        />
        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((item) => (
            <StaggerItem key={item.title}>
              <IconCard {...item} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      <Section>
        <SectionHeader
          badge="Enterprise Security"
          title="Security That Scales"
          description="Every layer of TechD PrivacyOps is designed for enterprise-grade security and multi-tenant isolation."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
          {[
            { icon: Lock, title: "7-Layer Auth", desc: "CSRF, JWT, Tenant, RBAC, Feature Gates, ABAC, Approval" },
            { icon: Database, title: "Row-Level Security", desc: "Tenant isolation enforced at database level on 60+ tables" },
            { icon: Shield, title: "Hash Chain Audit", desc: "SHA256 tamper-evident audit trail with advisory locks" },
            { icon: Users, title: "SCIM & SSO", desc: "Enterprise identity federation with SAML, OIDC, and SCIM provisioning" },
          ].map((item, i) => (
            <AnimatedSection key={item.title} delay={i * 0.08}>
              <div className="rounded-xl border border-border bg-card p-5 card-hover">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 w-fit mb-3">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </Section>

      <CTASection
        title="Data Intelligence at"
        titleGradient="Enterprise Scale"
        description="See how TechD PrivacyOps helps the world's largest organizations discover, classify, and remediate data risk across their entire infrastructure."
        primaryCta="Book Executive Demo"
      />
    </>
  );
}
