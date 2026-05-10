"use client";

import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import { CTASection } from "@/components/shared/cta-section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ArrowRight,
  Users,
  FileCheck,
  Lock,
  Globe,
  Eye,
  Database,
  Landmark,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const challenges = [
  {
    icon: Users,
    title: "Citizen Data Protection",
    description:
      "Safeguard personally identifiable information of citizens across government databases, portals, and digital services.",
    glowColor: "blue" as const,
  },
  {
    icon: Scale,
    title: "Regulatory Compliance",
    description:
      "Meet DPDP Act, RTI Act, and national cybersecurity framework requirements with automated evidence collection.",
    glowColor: "cyan" as const,
  },
  {
    icon: Globe,
    title: "Data Sovereignty",
    description:
      "Ensure citizen data remains within jurisdictional boundaries with cross-border transfer controls and monitoring.",
    glowColor: "purple" as const,
  },
  {
    icon: Lock,
    title: "Zero-Trust Security",
    description:
      "7-layer authentication guard pipeline with RBAC, ABAC, and row-level security across 60+ database tables.",
    glowColor: "green" as const,
  },
  {
    icon: Eye,
    title: "Tamper-Evident Audit",
    description:
      "SHA256 hash chain audit logging with Postgres advisory locks ensures complete transparency and accountability.",
    glowColor: "blue" as const,
  },
  {
    icon: FileCheck,
    title: "DSAR & RTI Automation",
    description:
      "Automated subject access requests with fail-closed PII redaction, legal hold checks, and regulatory deadline tracking.",
    glowColor: "cyan" as const,
  },
];

const regulations = [
  { name: "DPDP Act", region: "India" },
  { name: "RTI Act", region: "India" },
  { name: "CERT-In", region: "India" },
  { name: "ISO 27001", region: "Global" },
  { name: "SOC 2", region: "Global" },
  { name: "GDPR", region: "Cross-Border" },
];

export default function GovernmentPage() {
  return (
    <>
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 radial-hero grid-bg">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="green" className="mb-6">
                <Landmark className="h-3 w-3 mr-1.5" /> Government & Public Sector
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
                Data Security for{" "}
                <span className="gradient-text">Government & Public Sector</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
                Protect citizen data, ensure regulatory compliance, and maintain data sovereignty
                with an AI-native platform built for the unique requirements of government agencies.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="glow" size="lg" asChild>
                  <Link href="/contact" className="gap-2">
                    Request Briefing <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="secondary" size="lg" asChild>
                  <Link href="/security">Security Posture</Link>
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <Section variant="muted">
        <SectionHeader
          badge="Challenges"
          title="Purpose-Built for"
          titleGradient="Public Sector Security"
          description="Government agencies face unique data protection challenges — from citizen privacy to national security. TechD PrivacyOps addresses them all."
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
          badge="Compliance"
          title="Regulation Coverage"
          description="Automated compliance mapping and continuous monitoring across government-specific frameworks."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {regulations.map((reg, i) => (
            <AnimatedSection key={reg.name} delay={i * 0.05}>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 card-hover">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{reg.name}</div>
                  <div className="text-xs text-muted-foreground">{reg.region}</div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </Section>

      <Section variant="muted">
        <AnimatedSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">FedRAMP-Ready Architecture</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              TechD PrivacyOps is designed with FedRAMP readiness in mind — tenant isolation via RLS,
              tamper-evident audit logging, encryption at rest and in transit, and a 7-layer
              authentication pipeline that exceeds federal security requirements.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { stat: "60+", label: "RLS Tables" },
                { stat: "7", label: "Auth Layers" },
                { stat: "SHA256", label: "Audit Chain" },
                { stat: "99.9%", label: "Uptime SLA" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-2xl font-bold text-primary">{item.stat}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </Section>

      <CTASection
        title="Secure Citizen Data with"
        titleGradient="Confidence"
        description="See how TechD PrivacyOps helps government agencies protect citizen data while meeting the strictest compliance requirements."
        primaryCta="Request Briefing"
      />
    </>
  );
}
