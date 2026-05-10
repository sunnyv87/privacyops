"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Map,
  MonitorPlay,
  TrendingUp,
  Mail,
  Phone,
  Headphones,
  Handshake,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Cloud,
  Server,
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
            Get Started
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
            See TechD PrivacyOps{" "}
            <span className="gradient-text">In Action</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Book a personalized demo with our team and discover how TechD
            PrivacyOps can transform your data security and privacy operations.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DEMO REQUEST FORM                                                  */
/* ------------------------------------------------------------------ */
const companySizes = ["1-50", "51-200", "201-1,000", "1,001-5,000", "5,000+"];

function DemoFormSection() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <Section>
      <div className="grid lg:grid-cols-5 gap-16">
        {/* Form — 3 cols */}
        <AnimatedSection className="lg:col-span-3">
          <Card className="glow-border">
            <CardHeader>
              <CardTitle className="text-2xl">Request a Demo</CardTitle>
              <CardDescription>
                Fill out the form and a member of our team will be in touch
                within one business day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
                  <p className="text-muted-foreground">
                    We&apos;ve received your request and will be in touch shortly.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubmitted(true);
                  }}
                  className="space-y-6"
                >
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        First Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        placeholder="Jane"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Last Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Work Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                      placeholder="jane@company.com"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Company <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        placeholder="Acme Inc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        placeholder="CISO"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Company Size <span className="text-red-400">*</span>
                      </label>
                      <select
                        required
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select company size
                        </option>
                        {companySizes.map((size) => (
                          <option key={size} value={size}>
                            {size} employees
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Country
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                        placeholder="United States"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Message / Requirements
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none"
                      placeholder="Tell us about your data security challenges and what you'd like to see in the demo..."
                    />
                  </div>

                  <Button variant="glow" size="lg" type="submit" className="w-full sm:w-auto">
                    Request Demo <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* Sidebar — 2 cols */}
        <AnimatedSection delay={0.2} className="lg:col-span-2 space-y-6">
          <Card className="card-hover">
            <CardContent className="pt-6">
              <Clock className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-2">What to Expect</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  30-minute personalized walkthrough
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  Live platform demonstration
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  Custom Q&A with a solutions engineer
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  No commitment required
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="pt-6">
              <Mail className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Quick Question?</h3>
              <p className="text-sm text-muted-foreground">
                Reach us directly at{" "}
                <span className="text-primary">enterprise@techd.com</span>
              </p>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  WHY BOOK A DEMO                                                    */
/* ------------------------------------------------------------------ */
const demoReasons = [
  {
    icon: Search,
    title: "See Live Data Discovery",
    description: "Watch our platform scan, discover, and classify sensitive data across multiple connectors in real time.",
    glowColor: "blue" as const,
  },
  {
    icon: Map,
    title: "Custom Compliance Mapping",
    description: "See how your specific regulatory requirements map to automated controls and continuous monitoring.",
    glowColor: "cyan" as const,
  },
  {
    icon: MonitorPlay,
    title: "Architecture Deep-Dive",
    description: "Understand our multi-layer architecture, deployment models, and how we integrate with your existing stack.",
    glowColor: "purple" as const,
  },
  {
    icon: TrendingUp,
    title: "ROI Assessment",
    description: "Get a tailored ROI analysis showing projected time savings, risk reduction, and compliance cost impact.",
    glowColor: "green" as const,
  },
];

function WhyDemoSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Why Book a Demo"
        title="See What TechD PrivacyOps"
        titleGradient="Can Do for You"
      />
      <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {demoReasons.map((r) => (
          <StaggerItem key={r.title}>
            <IconCard
              icon={r.icon}
              title={r.title}
              description={r.description}
              glowColor={r.glowColor}
            />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  CONTACT OPTIONS                                                    */
/* ------------------------------------------------------------------ */
const contactOptions = [
  {
    icon: Mail,
    title: "Sales",
    description: "Talk to our enterprise sales team about pricing, deployment, and custom requirements.",
    email: "enterprise@techd.com",
    color: "text-blue-400",
  },
  {
    icon: Headphones,
    title: "Support",
    description: "Get help with an existing deployment, report issues, or request a feature.",
    email: "support@techd.com",
    color: "text-cyan-400",
  },
  {
    icon: Handshake,
    title: "Partnerships",
    description: "Explore technology partnerships, reseller programs, and integration opportunities.",
    email: "partners@techd.com",
    color: "text-purple-400",
  },
];

function ContactOptionsSection() {
  return (
    <Section>
      <SectionHeader
        badge="Contact Us"
        title="Get in"
        titleGradient="Touch"
        description="Choose the team that best fits your needs."
      />
      <StaggerContainer className="grid md:grid-cols-3 gap-8">
        {contactOptions.map((opt) => (
          <StaggerItem key={opt.title}>
            <Card className="h-full card-hover text-center">
              <CardContent className="pt-8 pb-8">
                <div className="inline-flex rounded-lg bg-secondary/50 border border-border p-3 mb-4">
                  <opt.icon className={`h-6 w-6 ${opt.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{opt.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {opt.description}
                </p>
                <p className="text-sm text-primary font-medium">{opt.email}</p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */
const faqs = [
  {
    question: "How long is the demo?",
    answer: "Our standard demo is 30 minutes, including a live walkthrough of the platform tailored to your use case and time for Q&A. We can extend to 45 minutes for more in-depth technical deep-dives.",
  },
  {
    question: "What do I need to prepare?",
    answer: "Nothing at all. Our team will guide you through everything. If you want to make the session more tailored, you can share your primary data sources and compliance requirements ahead of time.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes. We offer a 14-day proof-of-concept engagement where you can connect your own data sources and experience the full platform capabilities with guided support from our solutions team.",
  },
  {
    question: "What are the deployment options?",
    answer: "TechD PrivacyOps supports cloud-hosted (SaaS), hybrid, and fully on-premises deployments. Our architecture is designed to meet the most stringent data residency and sovereignty requirements.",
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Section variant="muted">
      <SectionHeader
        badge="FAQ"
        title="Common"
        titleGradient="Questions"
        description="Answers to frequently asked pre-demo questions."
      />
      <AnimatedSection>
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/30 transition-colors cursor-pointer"
              >
                <span className="font-medium text-sm">{faq.question}</span>
                {openIndex === i ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
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
export default function ContactPage() {
  return (
    <>
      <HeroSection />
      <DemoFormSection />
      <WhyDemoSection />
      <ContactOptionsSection />
      <FAQSection />
    </>
  );
}
