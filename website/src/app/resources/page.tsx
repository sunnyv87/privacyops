"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTASection } from "@/components/shared/cta-section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Building2,
  BookOpen,
  Code2,
  Video,
  Shield,
  ChevronRight,
  Download,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  HERO                                                               */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative min-h-[60vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 radial-hero" />
      <div className="absolute inset-0 grid-bg" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-16 w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <Badge variant="cyan" className="mb-6">
            Learn
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
            Resource{" "}
            <span className="gradient-text">Center</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Everything you need to master data security and privacy operations
            — whitepapers, case studies, compliance guides, and technical
            documentation.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */
interface ResourceCategory {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  count: number;
  color: string;
  borderColor: string;
  bgColor: string;
  items: string[];
}

const categories: ResourceCategory[] = [
  {
    icon: FileText,
    title: "Whitepapers",
    description: "In-depth research and analysis on data security trends, threats, and best practices.",
    count: 8,
    color: "text-blue-400",
    borderColor: "hover:border-blue-500/40",
    bgColor: "bg-blue-500/10",
    items: [
      "Shadow Data: The Hidden Risk in Enterprise Environments",
      "The Enterprise Guide to Data Classification at Scale",
      "Zero Trust Architecture for Data Security",
      "AI Governance: Frameworks for Responsible Deployment",
    ],
  },
  {
    icon: Building2,
    title: "Case Studies",
    description: "Real-world success stories from enterprises that transformed their data security posture.",
    count: 6,
    color: "text-cyan-400",
    borderColor: "hover:border-cyan-500/40",
    bgColor: "bg-cyan-500/10",
    items: [
      "Fortune 500 Bank Achieves Continuous Compliance",
      "Healthcare Network Reduces DSAR Time by 95%",
      "Global Retailer Secures 2M+ Customer Records",
      "Insurance Provider Automates CCPA Workflows",
    ],
  },
  {
    icon: Shield,
    title: "Compliance Guides",
    description: "Step-by-step guides for achieving and maintaining compliance with major regulations.",
    count: 10,
    color: "text-purple-400",
    borderColor: "hover:border-purple-500/40",
    bgColor: "bg-purple-500/10",
    items: [
      "GDPR Compliance Automation Playbook",
      "HIPAA Data Security Requirements Guide",
      "CCPA/CPRA Implementation Checklist",
      "SOC 2 Evidence Collection with TechD",
    ],
  },
  {
    icon: BookOpen,
    title: "Technical Documentation",
    description: "Comprehensive platform documentation, architecture guides, and deployment references.",
    count: 25,
    color: "text-emerald-400",
    borderColor: "hover:border-emerald-500/40",
    bgColor: "bg-emerald-500/10",
    items: [
      "Platform Architecture Overview",
      "Connector Configuration Guide",
      "Classification Engine Deep-Dive",
      "Role-Based Access Control Setup",
    ],
  },
  {
    icon: Video,
    title: "Webinars",
    description: "On-demand webinars featuring product demos, expert panels, and security workshops.",
    count: 12,
    color: "text-blue-400",
    borderColor: "hover:border-blue-500/40",
    bgColor: "bg-blue-500/10",
    items: [
      "Live Demo: DSPM in Action (45 min)",
      "Panel: The Future of Privacy Engineering",
      "Workshop: Building a Data Security Program",
      "Fireside Chat: AI Co-Pilot for Security Teams",
    ],
  },
  {
    icon: Code2,
    title: "API Documentation",
    description: "Full API reference, SDKs, and integration guides for developers building on TechD.",
    count: 15,
    color: "text-cyan-400",
    borderColor: "hover:border-cyan-500/40",
    bgColor: "bg-cyan-500/10",
    items: [
      "REST API Reference (v2)",
      "Python SDK Quickstart",
      "Webhook Configuration Guide",
      "Custom Connector Development Kit",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  CATEGORIES GRID                                                    */
/* ------------------------------------------------------------------ */
function CategoriesSection() {
  return (
    <Section>
      <SectionHeader
        badge="Browse Resources"
        title="Explore by"
        titleGradient="Category"
        description="Curated resources to help your team implement, optimize, and scale enterprise data security."
      />
      <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {categories.map((cat) => (
          <StaggerItem key={cat.title}>
            <Card className={`h-full card-hover ${cat.borderColor}`}>
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex rounded-lg border border-border p-2.5 ${cat.bgColor}`}>
                    <cat.icon className={`h-5 w-5 ${cat.color}`} />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {cat.count} resources
                  </Badge>
                </div>
                <CardTitle className="text-lg">{cat.title}</CardTitle>
                <CardDescription>{cat.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {cat.items.map((item) => (
                    <li key={item}>
                      <button className="flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group/item w-full text-left cursor-pointer">
                        <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50 group-hover/item:text-primary transition-colors" />
                        <span className="leading-snug">{item}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  FEATURED RESOURCES                                                 */
/* ------------------------------------------------------------------ */
const featured = [
  {
    badge: "Whitepaper",
    badgeVariant: "cyan" as const,
    title: "The 2026 State of DSPM Report",
    description: "Our annual analysis of data security posture management trends, challenges, and predictions based on data from 500+ enterprises.",
    cta: "Download Report",
  },
  {
    badge: "Guide",
    badgeVariant: "green" as const,
    title: "Getting Started with TechD PrivacyOps",
    description: "A comprehensive onboarding guide covering initial setup, connector configuration, classification tuning, and first-week milestones.",
    cta: "Read Guide",
  },
  {
    badge: "Case Study",
    badgeVariant: "purple" as const,
    title: "Enterprise Deployment Playbook",
    description: "Lessons learned from deploying TechD PrivacyOps across Fortune 500 organizations, including timelines, team structures, and success metrics.",
    cta: "View Case Study",
  },
];

function FeaturedSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Featured"
        title="Most Popular"
        titleGradient="Resources"
      />
      <StaggerContainer className="grid md:grid-cols-3 gap-8">
        {featured.map((item) => (
          <StaggerItem key={item.title}>
            <Card className="h-full card-hover">
              {/* Placeholder cover */}
              <div className="h-40 bg-gradient-to-br from-primary/5 to-accent/5 border-b border-border flex items-center justify-center">
                <Download className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <CardHeader className="pb-2">
                <Badge variant={item.badgeVariant} className="mb-2 w-fit text-xs">
                  {item.badge}
                </Badge>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {item.description}
                </p>
                <Button variant="outline" size="sm" className="gap-2">
                  {item.cta} <ArrowRight className="h-3 w-3" />
                </Button>
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
export default function ResourcesPage() {
  return (
    <>
      <HeroSection />
      <CategoriesSection />
      <FeaturedSection />
      <CTASection
        title="Ready to See It"
        titleGradient="in Action?"
        description="Explore how TechD PrivacyOps can transform your data security and compliance operations with a personalized demo."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Contact Sales"
        secondaryHref="/contact"
      />
    </>
  );
}
