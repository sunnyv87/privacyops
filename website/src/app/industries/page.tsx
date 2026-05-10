"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTASection } from "@/components/shared/cta-section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import {
  ArrowRight,
  Building2,
  Landmark,
  Heart,
  Globe,
  Factory,
  Shield,
  Monitor,
} from "lucide-react";
import Link from "next/link";

const industries = [
  {
    href: "/industries/bfsi",
    icon: Building2,
    title: "Banking & Financial Services",
    description:
      "PCI DSS compliance, customer data protection, RBI/SEBI framework adherence, and cross-border data flow management.",
    regulations: ["PCI DSS", "RBI", "SEBI CSCRF", "GDPR"],
    color: "blue",
  },
  {
    href: "/industries/healthcare",
    icon: Heart,
    title: "Healthcare",
    description:
      "HIPAA compliance, PHI discovery across EHR systems, breach notification automation, and minimum necessary access enforcement.",
    regulations: ["HIPAA", "HITECH", "GDPR", "SOC 2"],
    color: "cyan",
  },
  {
    href: "/industries/saas",
    icon: Monitor,
    title: "SaaS Companies",
    description:
      "Multi-tenant data isolation, SOC 2 automation, global compliance for GDPR/CCPA, and API-first security integration.",
    regulations: ["SOC 2", "GDPR", "CCPA", "ISO 27001"],
    color: "purple",
  },
  {
    href: "/industries/manufacturing",
    icon: Factory,
    title: "Manufacturing",
    description:
      "OT/IT convergence data security, supply chain data protection, IP classification, and ISO 27001 compliance.",
    regulations: ["ISO 27001", "NIST", "GDPR", "SOC 2"],
    color: "green",
  },
  {
    href: "/industries/government",
    icon: Landmark,
    title: "Government & Public Sector",
    description:
      "Citizen data protection, DPDP Act compliance, data sovereignty enforcement, and tamper-evident audit logging.",
    regulations: ["DPDP", "CERT-In", "ISO 27001", "FedRAMP"],
    color: "blue",
  },
  {
    href: "/industries/enterprises",
    icon: Globe,
    title: "Large Enterprises",
    description:
      "Multi-cloud data discovery, global compliance orchestration, M&A due diligence, and board-level risk reporting.",
    regulations: ["GDPR", "CCPA", "HIPAA", "SOC 2"],
    color: "cyan",
  },
];

const colorMap: Record<string, string> = {
  blue: "bg-blue-500/10 border-blue-500/20 group-hover:border-blue-500/40",
  cyan: "bg-cyan-500/10 border-cyan-500/20 group-hover:border-cyan-500/40",
  purple: "bg-purple-500/10 border-purple-500/20 group-hover:border-purple-500/40",
  green: "bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/40",
};

const iconColorMap: Record<string, string> = {
  blue: "text-blue-400",
  cyan: "text-cyan-400",
  purple: "text-purple-400",
  green: "text-emerald-400",
};

export default function IndustriesPage() {
  return (
    <>
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 radial-hero grid-bg">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center">
              <Badge className="mb-6">
                <Shield className="h-3 w-3 mr-1.5" /> Industries
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
                Purpose-Built for{" "}
                <span className="gradient-text">Your Industry</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Every industry has unique data security and compliance challenges. TechD PrivacyOps
                delivers purpose-built solutions that map to your specific regulatory landscape.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <Section>
        <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => (
            <StaggerItem key={industry.title}>
              <Link href={industry.href} className="group block h-full">
                <div className="h-full rounded-xl border border-border bg-card p-6 card-hover flex flex-col">
                  <div className={`rounded-lg border p-2.5 w-fit mb-4 transition-colors ${colorMap[industry.color]}`}>
                    <industry.icon className={`h-5 w-5 ${iconColorMap[industry.color]}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{industry.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                    {industry.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {industry.regulations.map((reg) => (
                      <span
                        key={reg}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border"
                      >
                        {reg}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center text-sm text-primary font-medium group-hover:gap-2 transition-all gap-1">
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      <CTASection
        title="Data Security for"
        titleGradient="Every Industry"
        description="See how TechD PrivacyOps addresses the unique data security and compliance needs of your industry."
      />
    </>
  );
}
