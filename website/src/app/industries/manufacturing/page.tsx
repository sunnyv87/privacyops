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
  Factory,
  Search,
  Network,
  Lock,
  FileCheck,
  Users,
  Boxes,
  Cpu,
  Cog,
  ArrowRight,
  Eye,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const challenges = [
  {
    icon: Network,
    title: "OT/IT Convergence",
    description:
      "As operational technology connects to IT networks, sensitive industrial data flows across new boundaries. Discover and classify data across converged environments.",
    glowColor: "cyan" as const,
  },
  {
    icon: Boxes,
    title: "Supply Chain Data Protection",
    description:
      "Protect proprietary designs, pricing data, and logistics information shared across complex supply chain networks and vendor portals.",
    glowColor: "blue" as const,
  },
  {
    icon: Lock,
    title: "IP Classification",
    description:
      "Automatically discover and classify intellectual property including trade secrets, manufacturing processes, formulations, and design specifications.",
    glowColor: "purple" as const,
  },
  {
    icon: Users,
    title: "Vendor Risk Management",
    description:
      "Assess and monitor data exposure across contract manufacturers, logistics providers, and technology vendors in your supply chain.",
    glowColor: "green" as const,
  },
];

const solutions = [
  {
    icon: Search,
    title: "Industrial Data Discovery",
    description:
      "Scan SCADA systems, MES platforms, ERP databases, and cloud repositories to find sensitive industrial and customer data.",
    glowColor: "cyan" as const,
  },
  {
    icon: Cpu,
    title: "OT Environment Scanning",
    description:
      "Purpose-built connectors for industrial control systems, historians, and operational databases without disrupting production workloads.",
    glowColor: "blue" as const,
  },
  {
    icon: Eye,
    title: "Data Flow Mapping",
    description:
      "Visualize how sensitive data moves between OT and IT environments, across facilities, and to external partners.",
    glowColor: "purple" as const,
  },
  {
    icon: Shield,
    title: "Trade Secret Protection",
    description:
      "AI-powered classification identifies proprietary formulations, manufacturing processes, and competitive intelligence across all data stores.",
    glowColor: "green" as const,
  },
  {
    icon: FileCheck,
    title: "ISO 27001 Compliance",
    description:
      "Automated control monitoring and evidence collection for ISO 27001 certification, with continuous gap analysis and remediation guidance.",
    glowColor: "cyan" as const,
  },
  {
    icon: Cog,
    title: "Automated Remediation",
    description:
      "Policy-driven workflows to automatically restrict access, encrypt exposed data, or trigger alerts when IP or customer data is at risk.",
    glowColor: "blue" as const,
  },
];

const complianceFrameworks = [
  { name: "ISO 27001", description: "Information security management system certification" },
  { name: "ISO 27701", description: "Privacy information management system" },
  { name: "NIST CSF", description: "Cybersecurity framework for critical infrastructure" },
  { name: "GDPR", description: "EU data protection for global manufacturers" },
  { name: "ITAR / EAR", description: "Export control compliance for defense-adjacent manufacturing" },
  { name: "SOC 2", description: "Service organization controls for SaaS-enabled manufacturing" },
];

export default function ManufacturingPage() {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="cyan" className="mb-6">
              Manufacturing
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Securing Industrial{" "}
              <span className="gradient-text">Data Assets</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover and protect sensitive data across OT/IT environments,
              supply chains, and manufacturing operations with purpose-built
              data security posture management.
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

      {/* Key Challenges */}
      <Section>
        <SectionHeader
          badge="Industry Challenges"
          title="Data Security for"
          titleGradient="Modern Manufacturing"
          description="Manufacturing organizations face unique data protection challenges as digital transformation blurs the line between OT and IT environments."
        />
        <StaggerContainer className="grid md:grid-cols-2 gap-6">
          {challenges.map((challenge) => (
            <StaggerItem key={challenge.title}>
              <IconCard
                icon={challenge.icon}
                title={challenge.title}
                description={challenge.description}
                glowColor={challenge.glowColor}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* Solutions */}
      <Section variant="muted">
        <SectionHeader
          badge="Platform Solutions"
          title="Purpose-Built for"
          titleGradient="Industrial Environments"
          description="From OT network scanning to IP classification, every capability is designed for the unique requirements of manufacturing."
        />
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {solutions.map((solution) => (
            <StaggerItem key={solution.title}>
              <IconCard
                icon={solution.icon}
                title={solution.title}
                description={solution.description}
                glowColor={solution.glowColor}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* Compliance Frameworks */}
      <Section>
        <SectionHeader
          badge="Compliance"
          title="Industry Standards"
          titleGradient="& Certifications"
          description="Automate compliance across the standards that matter most to manufacturing organizations."
        />
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {complianceFrameworks.map((framework) => (
            <StaggerItem key={framework.name}>
              <div className="group rounded-xl border border-border bg-card p-6 card-hover text-center">
                <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 p-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold mb-1">{framework.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {framework.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* CTA */}
      <CTASection
        title="Protect Your Industrial"
        titleGradient="Data Assets."
        description="See how manufacturers use TechD PrivacyOps to secure data across OT/IT environments, protect IP, and achieve ISO 27001 compliance."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="View Platform"
        secondaryHref="/platform"
      />
    </main>
  );
}
