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
  Heart,
  Search,
  Bell,
  FileCheck,
  Lock,
  UserCheck,
  Database,
  Activity,
  ClipboardCheck,
  ArrowRight,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const hipaaCapabilities = [
  {
    icon: Search,
    title: "PHI Discovery",
    description:
      "Automated scanning across EHR systems, cloud storage, databases, and email to locate all protected health information in your environment.",
    glowColor: "cyan" as const,
  },
  {
    icon: Lock,
    title: "Access Safeguards",
    description:
      "Enforce minimum necessary access controls, track user permissions, and identify over-privileged accounts accessing PHI.",
    glowColor: "blue" as const,
  },
  {
    icon: Bell,
    title: "Breach Notification",
    description:
      "Automated 60-day HHS breach notification workflows with pre-built templates, affected individual tracking, and regulatory filing support.",
    glowColor: "purple" as const,
  },
  {
    icon: FileCheck,
    title: "BAA Management",
    description:
      "Track Business Associate Agreements across all vendors, monitor compliance obligations, and automate renewal workflows.",
    glowColor: "green" as const,
  },
];

const phiSources = [
  { name: "Electronic Health Records", icon: Activity },
  { name: "Cloud Storage (AWS, Azure, GCP)", icon: Database },
  { name: "On-Premises File Servers", icon: Database },
  { name: "Email & Communication Systems", icon: FileCheck },
  { name: "Medical Imaging Archives", icon: Eye },
  { name: "Third-Party SaaS Applications", icon: Shield },
];

const complianceFeatures = [
  {
    icon: ShieldCheck,
    title: "HIPAA Privacy Rule",
    description:
      "Automated controls for use and disclosure limitations, patient rights management, and minimum necessary standard enforcement.",
    glowColor: "cyan" as const,
  },
  {
    icon: Lock,
    title: "HIPAA Security Rule",
    description:
      "Technical, administrative, and physical safeguard assessment with continuous monitoring and gap analysis reporting.",
    glowColor: "blue" as const,
  },
  {
    icon: Bell,
    title: "Breach Notification Rule",
    description:
      "Risk assessment tools to determine notification requirements, with automated workflows for HHS, media, and individual notifications.",
    glowColor: "purple" as const,
  },
  {
    icon: ClipboardCheck,
    title: "Audit & Documentation",
    description:
      "Continuous compliance evidence collection with audit-ready reports, policy documentation, and risk assessment templates.",
    glowColor: "green" as const,
  },
  {
    icon: UserCheck,
    title: "Minimum Necessary Access",
    description:
      "Automated identification of over-privileged users and role-based access recommendations aligned with job functions.",
    glowColor: "cyan" as const,
  },
  {
    icon: Heart,
    title: "Patient Rights Automation",
    description:
      "Streamline access requests, amendment tracking, and accounting of disclosures with self-service patient portals.",
    glowColor: "green" as const,
  },
];

export default function HealthcarePage() {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="cyan" className="mb-6">
              Healthcare
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Protecting Patient Data with{" "}
              <span className="gradient-text">Intelligent Automation</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover, classify, and protect PHI across your entire healthcare
              infrastructure. Achieve and maintain HIPAA compliance with
              automated controls and continuous monitoring.
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

      {/* HIPAA Capabilities */}
      <Section>
        <SectionHeader
          badge="Core Capabilities"
          title="End-to-End"
          titleGradient="HIPAA Compliance"
          description="From PHI discovery to breach notification, TechD PrivacyOps automates the most critical aspects of healthcare data protection."
        />
        <StaggerContainer className="grid md:grid-cols-2 gap-6">
          {hipaaCapabilities.map((cap) => (
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

      {/* PHI Discovery Sources */}
      <Section variant="muted">
        <SectionHeader
          badge="Data Discovery"
          title="Find PHI Across"
          titleGradient="Every System"
          description="TechD PrivacyOps connects to your complete healthcare IT ecosystem to ensure no protected health information goes undiscovered."
        />
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {phiSources.map((source) => {
            const Icon = source.icon;
            return (
              <StaggerItem key={source.name}>
                <Card className="card-hover text-center p-6">
                  <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2.5">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <p className="text-sm font-medium">{source.name}</p>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* Compliance Features */}
      <Section>
        <SectionHeader
          badge="Compliance Automation"
          title="Comprehensive HIPAA"
          titleGradient="Rule Coverage"
          description="Automated controls and continuous monitoring across every HIPAA rule, with audit-ready documentation and evidence collection."
        />
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {complianceFeatures.map((feature) => (
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

      {/* CTA */}
      <CTASection
        title="Protect Patient Data"
        titleGradient="Automatically."
        description="See how healthcare organizations use TechD PrivacyOps to achieve continuous HIPAA compliance and protect PHI at scale."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="View Platform"
        secondaryHref="/platform"
      />
    </main>
  );
}
