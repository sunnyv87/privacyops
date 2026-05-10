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
  Check,
  X,
  Shield,
  Zap,
  Building2,
  Crown,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
            Pricing
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
            Simple, Transparent{" "}
            <span className="gradient-text">Enterprise Pricing</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Choose the plan that fits your organization. All plans include
            core platform capabilities with enterprise-grade security and
            support.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PRICING TIERS                                                      */
/* ------------------------------------------------------------------ */
const tiers = [
  {
    name: "Starter",
    icon: Zap,
    description: "For growing teams beginning their data security journey.",
    price: "Contact Sales",
    highlighted: false,
    features: [
      "Up to 10 connectors",
      "Core DSPM capabilities",
      "Basic PrivacyOps workflows",
      "Standard data classification",
      "Email support",
      "Community Slack access",
    ],
    cta: "Contact Sales",
    href: "/contact",
  },
  {
    name: "Enterprise",
    icon: Building2,
    description: "For security-forward organizations scaling data protection.",
    price: "Contact Sales",
    highlighted: true,
    badge: "Recommended",
    features: [
      "Unlimited connectors",
      "Full DSPM + PrivacyOps suite",
      "AI Co-Pilot included",
      "Advanced classification & risk scoring",
      "Premium support (24/5)",
      "SSO / SCIM integration",
      "Custom compliance mappings",
      "Dedicated onboarding",
    ],
    cta: "Book Demo",
    href: "/contact",
  },
  {
    name: "Enterprise Plus",
    icon: Crown,
    description: "For regulated industries with the most stringent requirements.",
    price: "Contact Sales",
    highlighted: false,
    features: [
      "Everything in Enterprise",
      "Dedicated instance",
      "Custom SLA (up to 99.99%)",
      "On-premises deployment option",
      "Dedicated Customer Success Manager",
      "SOC 2 evidence package",
      "Custom integrations & API priority",
      "Executive business reviews",
    ],
    cta: "Contact Sales",
    href: "/contact",
  },
];

function PricingTiersSection() {
  return (
    <Section>
      <StaggerContainer className="grid md:grid-cols-3 gap-8 items-start">
        {tiers.map((tier) => (
          <StaggerItem key={tier.name}>
            <Card
              className={cn(
                "h-full relative",
                tier.highlighted
                  ? "glow-border border-primary/40"
                  : "card-hover"
              )}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="cyan">{tier.badge}</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="inline-flex rounded-lg bg-primary/10 border border-primary/20 p-2.5 mb-3">
                  <tier.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription className="min-h-[40px]">
                  {tier.description}
                </CardDescription>
                <p className="text-2xl font-bold mt-4 text-foreground">
                  {tier.price}
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.highlighted ? "glow" : "secondary"}
                  size="lg"
                  className="w-full"
                  asChild
                >
                  <Link href={tier.href} className="gap-2">
                    {tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
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
/*  FEATURE COMPARISON TABLE                                           */
/* ------------------------------------------------------------------ */
type FeatureValue = boolean | string;

interface ComparisonCategory {
  category: string;
  features: {
    name: string;
    starter: FeatureValue;
    enterprise: FeatureValue;
    enterprisePlus: FeatureValue;
  }[];
}

const comparison: ComparisonCategory[] = [
  {
    category: "DSPM",
    features: [
      { name: "Data Discovery", starter: true, enterprise: true, enterprisePlus: true },
      { name: "Data Classification", starter: "Basic", enterprise: "Advanced AI", enterprisePlus: "Advanced AI" },
      { name: "Risk Scoring", starter: true, enterprise: true, enterprisePlus: true },
      { name: "Data Lineage", starter: false, enterprise: true, enterprisePlus: true },
      { name: "Shadow Data Detection", starter: false, enterprise: true, enterprisePlus: true },
    ],
  },
  {
    category: "PrivacyOps",
    features: [
      { name: "DSAR Automation", starter: "Basic", enterprise: "Full", enterprisePlus: "Full" },
      { name: "Consent Management", starter: false, enterprise: true, enterprisePlus: true },
      { name: "Workflow Queues", starter: "2", enterprise: "8", enterprisePlus: "Unlimited" },
      { name: "Remediation Actions", starter: "4", enterprise: "12", enterprisePlus: "12 + Custom" },
      { name: "Compliance Mapping", starter: "3 frameworks", enterprise: "10+ frameworks", enterprisePlus: "10+ + Custom" },
    ],
  },
  {
    category: "AI",
    features: [
      { name: "AI Co-Pilot", starter: false, enterprise: true, enterprisePlus: true },
      { name: "Natural Language Queries", starter: false, enterprise: true, enterprisePlus: true },
      { name: "Auto-Generated Reports", starter: false, enterprise: true, enterprisePlus: true },
      { name: "AI Governance Controls", starter: false, enterprise: true, enterprisePlus: true },
    ],
  },
  {
    category: "Platform",
    features: [
      { name: "Connectors", starter: "Up to 10", enterprise: "Unlimited", enterprisePlus: "Unlimited" },
      { name: "API Access", starter: "Read-only", enterprise: "Full", enterprisePlus: "Full + Priority" },
      { name: "Custom Dashboards", starter: false, enterprise: true, enterprisePlus: true },
      { name: "Webhooks & Integrations", starter: "Basic", enterprise: "Advanced", enterprisePlus: "Advanced + Custom" },
    ],
  },
  {
    category: "Security",
    features: [
      { name: "SSO / SAML", starter: false, enterprise: true, enterprisePlus: true },
      { name: "SCIM Provisioning", starter: false, enterprise: true, enterprisePlus: true },
      { name: "Role-Based Access (RBAC)", starter: "Basic", enterprise: "Advanced", enterprisePlus: "Advanced" },
      { name: "Audit Logs", starter: "30 days", enterprise: "1 year", enterprisePlus: "Unlimited" },
      { name: "Dedicated Instance", starter: false, enterprise: false, enterprisePlus: true },
      { name: "On-Prem Deployment", starter: false, enterprise: false, enterprisePlus: true },
    ],
  },
  {
    category: "Support",
    features: [
      { name: "Email Support", starter: true, enterprise: true, enterprisePlus: true },
      { name: "Priority Support (24/5)", starter: false, enterprise: true, enterprisePlus: true },
      { name: "24/7 Support", starter: false, enterprise: false, enterprisePlus: true },
      { name: "Dedicated CSM", starter: false, enterprise: false, enterprisePlus: true },
      { name: "Custom SLA", starter: false, enterprise: false, enterprisePlus: true },
      { name: "SOC 2 Evidence Package", starter: false, enterprise: false, enterprisePlus: true },
    ],
  },
];

function renderValue(value: FeatureValue) {
  if (value === true) {
    return <Check className="h-4 w-4 text-emerald-400 mx-auto" />;
  }
  if (value === false) {
    return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  }
  return (
    <span className="text-xs text-muted-foreground">{value}</span>
  );
}

function ComparisonSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Compare Plans"
        title="Feature"
        titleGradient="Comparison"
        description="A detailed breakdown of what is included in each plan."
      />
      <AnimatedSection>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground w-[40%]">
                    Feature
                  </th>
                  <th className="text-center p-4 text-sm font-medium w-[20%]">
                    Starter
                  </th>
                  <th className="text-center p-4 text-sm font-medium text-primary w-[20%]">
                    Enterprise
                  </th>
                  <th className="text-center p-4 text-sm font-medium w-[20%]">
                    Enterprise Plus
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((cat) => (
                  <>
                    <tr key={cat.category} className="border-b border-border bg-muted/30">
                      <td
                        colSpan={4}
                        className="p-4 text-sm font-semibold text-foreground"
                      >
                        {cat.category}
                      </td>
                    </tr>
                    {cat.features.map((f) => (
                      <tr
                        key={f.name}
                        className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                      >
                        <td className="p-4 text-sm text-muted-foreground">
                          {f.name}
                        </td>
                        <td className="p-4 text-center">
                          {renderValue(f.starter)}
                        </td>
                        <td className="p-4 text-center bg-primary/[0.02]">
                          {renderValue(f.enterprise)}
                        </td>
                        <td className="p-4 text-center">
                          {renderValue(f.enterprisePlus)}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */
function PricingFAQ() {
  return (
    <Section>
      <SectionHeader
        badge="FAQ"
        title="Pricing"
        titleGradient="Questions"
      />
      <AnimatedSection>
        <div className="max-w-3xl mx-auto grid gap-6">
          {[
            {
              q: "How is pricing determined?",
              a: "Pricing is based on the number of data sources, volume of records processed, and the feature tier you choose. Contact our sales team for a custom quote tailored to your environment.",
            },
            {
              q: "Can I upgrade my plan later?",
              a: "Absolutely. You can upgrade at any time and your existing configuration, policies, and data will carry over seamlessly.",
            },
            {
              q: "Is there a free trial or POC?",
              a: "Yes. We offer a 14-day proof-of-concept engagement with full platform access and guided onboarding from our solutions engineering team.",
            },
            {
              q: "What payment methods do you accept?",
              a: "We support annual and multi-year contracts with invoicing. Payment via ACH, wire transfer, or credit card.",
            },
          ].map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function PricingPage() {
  return (
    <>
      <HeroSection />
      <PricingTiersSection />
      <ComparisonSection />
      <PricingFAQ />
      <CTASection
        title="Ready to Get Started?"
        titleGradient="Talk to Our Team."
        description="Our solutions engineers will help you find the right plan and build a deployment strategy tailored to your infrastructure."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Contact Sales"
        secondaryHref="/contact"
      />
    </>
  );
}
