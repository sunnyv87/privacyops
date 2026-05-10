"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Landmark,
  CreditCard,
  Globe,
  Users,
  Search,
  FileWarning,
  Bell,
  Handshake,
  Map,
  CheckCircle2,
  ArrowRight,
  Scale,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const challenges = [
  {
    icon: Scale,
    title: "Regulatory Compliance",
    description:
      "Navigate complex regulations including RBI data localization guidelines and SEBI CSCRF framework requirements with automated compliance mapping.",
    glowColor: "cyan" as const,
  },
  {
    icon: CreditCard,
    title: "Customer Data Protection",
    description:
      "Discover and classify PII, PCI, and financial data across core banking systems, payment gateways, and customer-facing applications.",
    glowColor: "blue" as const,
  },
  {
    icon: Globe,
    title: "Cross-Border Data Flows",
    description:
      "Track and govern data transfers across jurisdictions, ensuring compliance with data localization mandates and GDPR obligations.",
    glowColor: "purple" as const,
  },
  {
    icon: Users,
    title: "Third-Party Risk",
    description:
      "Assess and monitor data exposure across fintech partners, payment processors, and outsourced service providers.",
    glowColor: "green" as const,
  },
];

const solutions = [
  {
    icon: Search,
    title: "PII & PCI Discovery",
    description:
      "Automated scanning across databases, data lakes, and cloud storage to find credit card numbers, Aadhaar, PAN, and financial records.",
  },
  {
    icon: FileWarning,
    title: "DSAR Automation",
    description:
      "Fulfill data subject access requests across fragmented banking systems in minutes, not weeks. Full audit trail included.",
  },
  {
    icon: Bell,
    title: "Breach Notification",
    description:
      "Automated incident workflows aligned with RBI's 6-hour reporting mandate and SEBI's breach notification requirements.",
  },
  {
    icon: Handshake,
    title: "Vendor Risk Management",
    description:
      "Continuous monitoring of third-party data processors with automated risk scoring and contract compliance tracking.",
  },
  {
    icon: Map,
    title: "Compliance Mapping",
    description:
      "Map your data landscape against RBI, SEBI, PCI DSS, and GDPR requirements with real-time gap analysis dashboards.",
  },
  {
    icon: Shield,
    title: "Data Classification",
    description:
      "AI-powered classification of financial data by sensitivity level, regulatory category, and business context across all repositories.",
  },
];

const regulations = [
  {
    name: "RBI Guidelines",
    description: "Data localization, payment system security, and cybersecurity framework compliance.",
    badges: ["Data Localization", "Cyber Security"],
  },
  {
    name: "SEBI CSCRF",
    description: "Cyber Security and Cyber Resilience Framework for market infrastructure institutions.",
    badges: ["Cyber Resilience", "Incident Response"],
  },
  {
    name: "PCI DSS",
    description: "Payment Card Industry Data Security Standard for cardholder data protection.",
    badges: ["Cardholder Data", "Network Security"],
  },
  {
    name: "GDPR",
    description: "General Data Protection Regulation for cross-border data transfers and EU customer data.",
    badges: ["Cross-Border", "Data Rights"],
  },
  {
    name: "SOC 2",
    description: "Service Organization Control reports for security, availability, and confidentiality.",
    badges: ["Trust Services", "Audit Ready"],
  },
];

export default function BFSIPage() {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="cyan" className="mb-6">
              BFSI
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Data Security for{" "}
              <span className="gradient-text">Financial Services</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Automate data discovery, classification, and compliance across your
              banking, insurance, and financial technology infrastructure with
              purpose-built DSPM.
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
          title="Addressing the Unique Risks of"
          titleGradient="Financial Services"
          description="BFSI organizations face some of the most stringent data protection requirements in any industry. TechD PrivacyOps is built to address them."
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

      {/* Platform Solutions */}
      <Section variant="muted">
        <SectionHeader
          badge="Platform Solutions"
          title="Purpose-Built for"
          titleGradient="BFSI Compliance"
          description="From PII discovery to breach notification, every capability is designed for the regulatory demands of financial services."
        />
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {solutions.map((solution) => (
            <StaggerItem key={solution.title}>
              <IconCard
                icon={solution.icon}
                title={solution.title}
                description={solution.description}
                glowColor="cyan"
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* Regulation Coverage */}
      <Section>
        <SectionHeader
          badge="Regulation Coverage"
          title="Comprehensive"
          titleGradient="Regulatory Mapping"
          description="TechD PrivacyOps maps your data posture against the regulations that matter most to financial institutions."
        />
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regulations.map((reg) => (
            <StaggerItem key={reg.name}>
              <Card className="card-hover h-full">
                <CardHeader>
                  <div className="mb-2 inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 p-2 w-fit">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <CardTitle>{reg.name}</CardTitle>
                  <CardDescription>{reg.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {reg.badges.map((badge) => (
                      <Badge key={badge} variant="outline">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* CTA */}
      <CTASection
        title="Secure Your Financial"
        titleGradient="Data Today."
        description="See how TechD PrivacyOps helps banks, insurers, and fintechs achieve continuous compliance and protect customer data at scale."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="View Case Studies"
        secondaryHref="/resources"
      />
    </main>
  );
}
