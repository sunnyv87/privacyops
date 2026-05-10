"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconCard } from "@/components/ui/icon-card";
import { CTASection } from "@/components/shared/cta-section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Eye,
  Lightbulb,
  FlaskConical,
  Heart,
  Lock,
  Scale,
  Brain,
  Users,
  Globe,
  Award,
  Building2,
  Target,
  CheckCircle2,
  Handshake,
  BookOpen,
  Layers,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  HERO                                                               */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative min-h-[70vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 radial-hero" />
      <div className="absolute inset-0 grid-bg" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-16 w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <Badge variant="cyan" className="mb-6">
            About TechD
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
            Securing the World&apos;s Data with{" "}
            <span className="gradient-text">Intelligent Automation</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            TechD is an AI-native cybersecurity company building the future of
            enterprise data protection and privacy operations.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  COMPANY VISION                                                     */
/* ------------------------------------------------------------------ */
function VisionSection() {
  return (
    <Section>
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <AnimatedSection>
          <Badge variant="default" className="mb-4">
            Our Vision
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            An AI-Native Approach to{" "}
            <span className="gradient-text">Data Security</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            TechD was founded on a simple premise: data security and privacy
            should not be separate disciplines. By unifying Data Security Posture
            Management with Privacy Operations in a single AI-native platform,
            we give security teams complete visibility and automated control
            over their most sensitive assets.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Our platform is purpose-built for the enterprise, designed to scale
            across hybrid and multi-cloud environments, and powered by
            intelligent automation that reduces manual effort by orders of
            magnitude.
          </p>
        </AnimatedSection>
        <AnimatedSection delay={0.2}>
          <div className="rounded-xl border border-border bg-card/50 p-8 glow-border">
            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: Eye, label: "Full Visibility", color: "text-blue-400" },
                { icon: Brain, label: "AI-Powered", color: "text-cyan-400" },
                { icon: Shield, label: "Enterprise-Grade", color: "text-purple-400" },
                { icon: Layers, label: "Unified Platform", color: "text-emerald-400" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="inline-flex rounded-lg bg-secondary/50 border border-border p-3 mb-3">
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  CYBER VALLEY                                                       */
/* ------------------------------------------------------------------ */
function CyberValleySection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="Innovation Hub"
        title="Born in"
        titleGradient="Cyber Valley"
        description="Our roots in one of Europe's leading AI and cybersecurity research clusters drive our research-first approach to data security."
      />
      <AnimatedSection>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: FlaskConical,
              title: "Research-Driven",
              description: "Our classification and risk-scoring models are informed by cutting-edge research in NLP, graph analytics, and privacy-preserving computation.",
              color: "blue" as const,
            },
            {
              icon: Lightbulb,
              title: "Innovation First",
              description: "We invest heavily in R&D, continuously pushing the boundaries of what automated data security can achieve at enterprise scale.",
              color: "cyan" as const,
            },
            {
              icon: Handshake,
              title: "Academic Partnerships",
              description: "Close collaboration with leading universities and research institutes keeps our technology at the frontier of AI-driven cybersecurity.",
              color: "purple" as const,
            },
          ].map((item) => (
            <StaggerItem key={item.title}>
              <IconCard
                icon={item.icon}
                title={item.title}
                description={item.description}
                glowColor={item.color}
              />
            </StaggerItem>
          ))}
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  MISSION & VALUES                                                   */
/* ------------------------------------------------------------------ */
const values = [
  {
    icon: Heart,
    title: "Privacy as a Right",
    description: "We believe data privacy is a fundamental right, not a compliance checkbox. Every feature we build starts from this principle.",
  },
  {
    icon: Eye,
    title: "Radical Transparency",
    description: "Open audit logs, explainable AI decisions, and clear documentation. Our customers always know how their data is being protected.",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description: "We hold ourselves to the same rigorous standards we help our customers achieve. SOC 2, ISO 27001, and beyond.",
  },
  {
    icon: Brain,
    title: "AI with Governance",
    description: "We develop AI responsibly, with built-in governance controls, bias monitoring, and human-in-the-loop safeguards for critical decisions.",
  },
];

function MissionSection() {
  return (
    <Section variant="radial">
      <SectionHeader
        badge="Mission & Values"
        title="What Drives"
        titleGradient="Our Work"
        description="Our mission is to make enterprise data security intelligent, automated, and accessible to every organization."
      />
      <StaggerContainer className="grid sm:grid-cols-2 gap-6">
        {values.map((v) => (
          <StaggerItem key={v.title}>
            <Card className="h-full card-hover">
              <CardHeader>
                <div className="inline-flex rounded-lg bg-primary/10 border border-primary/20 p-2.5 mb-3">
                  <v.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{v.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {v.description}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  LEADERSHIP                                                         */
/* ------------------------------------------------------------------ */
const leaders = [
  { name: "Dr. Alexandra Richter", title: "CEO & Co-Founder", bio: "Former VP of Security at a Fortune 100 enterprise. PhD in Applied Cryptography." },
  { name: "Marcus Chen", title: "CTO & Co-Founder", bio: "Previously led data infrastructure at a hyperscale cloud provider. 15+ years in distributed systems." },
  { name: "Sarah Okonkwo", title: "VP of Engineering", bio: "Built privacy engineering teams at two FAANG companies. Expert in large-scale data processing." },
  { name: "James Park", title: "Chief Privacy Officer", bio: "Former head of global privacy at a top-tier consulting firm. CIPP/E, CIPM certified." },
  { name: "Elena Vasquez", title: "VP of Product", bio: "10+ years defining enterprise security products. Background in threat modeling and compliance automation." },
  { name: "David Osei", title: "VP of Sales", bio: "Scaled enterprise go-to-market at three cybersecurity startups from Series A to acquisition." },
];

function LeadershipSection() {
  return (
    <Section>
      <SectionHeader
        badge="Leadership"
        title="Led by"
        titleGradient="Industry Veterans"
        description="Our leadership team brings decades of experience from enterprise security, cloud infrastructure, and AI research."
      />
      <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {leaders.map((leader) => (
          <StaggerItem key={leader.name}>
            <Card className="h-full card-hover">
              <CardHeader>
                <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary mb-3">
                  {leader.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <CardTitle className="text-base">{leader.name}</CardTitle>
                <CardDescription>{leader.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {leader.bio}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  BY THE NUMBERS                                                     */
/* ------------------------------------------------------------------ */
const stats = [
  { value: "43+", label: "Data Connectors", color: "text-blue-400" },
  { value: "12", label: "Remediation Actions", color: "text-cyan-400" },
  { value: "8", label: "Workflow Queues", color: "text-purple-400" },
  { value: "60+", label: "Protected Tables", color: "text-emerald-400" },
  { value: "10+", label: "Regulations Supported", color: "text-blue-400" },
  { value: "99.9%", label: "Uptime SLA", color: "text-cyan-400" },
];

function StatsSection() {
  return (
    <Section variant="muted">
      <SectionHeader
        badge="By The Numbers"
        title="Platform at"
        titleGradient="a Glance"
      />
      <AnimatedSection>
        <div className="rounded-xl border border-border bg-card/50 glow-border p-10 lg:p-14">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-10 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <motion.p
                  className={`text-4xl lg:text-5xl font-bold mb-2 ${s.color}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, type: "spring" }}
                >
                  {s.value}
                </motion.p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  PARTNERS & CERTIFICATIONS                                          */
/* ------------------------------------------------------------------ */
const certifications = [
  "SOC 2 Type II",
  "ISO 27001",
  "GDPR Compliant",
  "HIPAA Ready",
  "CSA STAR",
  "AWS Partner",
  "Azure Partner",
  "GCP Partner",
];

function PartnersSection() {
  return (
    <Section>
      <SectionHeader
        badge="Trust & Compliance"
        title="Partners &"
        titleGradient="Certifications"
        description="We maintain the industry's highest security and compliance standards."
      />
      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {certifications.map((cert) => (
          <StaggerItem key={cert}>
            <div className="rounded-xl border border-border bg-card p-5 text-center card-hover">
              <Award className="h-5 w-5 text-primary mx-auto mb-3" />
              <p className="font-semibold text-sm">{cert}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function AboutPage() {
  return (
    <>
      <HeroSection />
      <VisionSection />
      <CyberValleySection />
      <MissionSection />
      <LeadershipSection />
      <StatsSection />
      <PartnersSection />
      <CTASection
        title="Join Our Mission to"
        titleGradient="Secure the World's Data."
        description="We are building the future of enterprise data security. See how TechD PrivacyOps can transform your organization's data protection posture."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="View Careers"
        secondaryHref="/contact"
      />
    </>
  );
}
