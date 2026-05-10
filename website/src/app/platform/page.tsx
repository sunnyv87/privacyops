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
  Layers,
  Cpu,
  Radio,
  Lock,
  Brain,
  Cloud,
  Scan,
  UserCheck,
  AlertTriangle,
  Timer,
  CheckSquare,
  Building2,
  Wrench,
  Trash2,
  ChevronRight,
  Zap,
  RefreshCw,
  ShieldCheck,
  CreditCard,
  Users,
  Database,
  Server,
  Globe,
  Network,
} from "lucide-react";

const taskQueues = [
  { name: "SCAN", icon: Scan, description: "Data discovery and classification across 43+ connectors with incremental scanning", color: "blue" as const },
  { name: "DSAR", icon: UserCheck, description: "Subject access request orchestration with identity verification and redaction", color: "cyan" as const },
  { name: "BREACH", icon: AlertTriangle, description: "Incident detection, 72-hour notification timelines, and regulatory filing", color: "purple" as const },
  { name: "RETENTION", icon: Timer, description: "Policy enforcement, automated tagging, and legal hold integration", color: "green" as const },
  { name: "APPROVAL", icon: CheckSquare, description: "Multi-level approval chains with escalation and SLA tracking", color: "blue" as const },
  { name: "VENDOR", icon: Building2, description: "Third-party risk assessments, DPA tracking, and continuous monitoring", color: "cyan" as const },
  { name: "REMEDIATION", icon: Wrench, description: "Automated risk remediation with rollback capability and audit trails", color: "purple" as const },
  { name: "DATA_DELETION", icon: Trash2, description: "Verified deletion workflows with cryptographic proof of erasure", color: "green" as const },
];

const authLayers = [
  { name: "CSRF Protection", description: "Double-submit cookie pattern with origin validation", color: "bg-red-500/10 border-red-500/30 text-red-400" },
  { name: "JWT Verification", description: "RS256 token validation with key rotation and revocation", color: "bg-orange-500/10 border-orange-500/30 text-orange-400" },
  { name: "Tenant Isolation", description: "Request-scoped tenant context with RLS enforcement", color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" },
  { name: "Permissions", description: "RBAC permission checks against role-permission matrix", color: "bg-green-500/10 border-green-500/30 text-green-400" },
  { name: "Feature Gate", description: "Tenant-level feature flags with plan-based access control", color: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" },
  { name: "ABAC Policy", description: "Attribute-based access control with dynamic policy evaluation", color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
  { name: "Approval Chain", description: "Operation-specific approval requirements with quorum rules", color: "bg-purple-500/10 border-purple-500/30 text-purple-400" },
];

const architectureNodes = [
  { label: "Multi-Tenant SaaS", sub: "Tenant Isolation", icon: Cloud },
  { label: "API Gateway", sub: "7-Layer Auth", icon: Shield },
  { label: "NestJS Modules", sub: "Domain Services", icon: Layers },
  { label: "Temporal Workflows", sub: "8 Task Queues", icon: Cpu },
  { label: "NATS Event Bus", sub: "JetStream", icon: Radio },
  { label: "Connectors", sub: "43+ Integrations", icon: Globe },
];

export default function PlatformPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="cyan" className="mb-6">Platform Architecture</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Built for Enterprise Scale{" "}
              <span className="gradient-text">and Security</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed mb-10">
              A hardened, event-driven platform engineered for multi-tenant SaaS at scale.
              Temporal-powered workflows, NATS JetStream eventing, 7-layer authentication,
              and row-level security across every table.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Book Architecture Review <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/security">Security Overview</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Architecture Overview */}
      <Section variant="muted">
        <SectionHeader
          badge="System Architecture"
          title="End-to-End"
          titleGradient="Platform Flow"
          description="Every request flows through a hardened pipeline from ingress to execution, with tenant isolation enforced at every layer."
        />
        <AnimatedSection>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {architectureNodes.map((node, i) => (
              <div key={node.label} className="relative flex flex-col items-center">
                <div className="relative w-full rounded-xl border border-border bg-card p-4 text-center card-hover">
                  <div className="mb-3 mx-auto inline-flex rounded-lg border border-primary/20 bg-primary/10 p-2.5">
                    <node.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">{node.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{node.sub}</p>
                </div>
                {i < architectureNodes.length - 1 && (
                  <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    <ChevronRight className="h-4 w-4 text-primary/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-border bg-card/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Request Flow:</span>{" "}
              Ingress &rarr; CSRF &rarr; JWT &rarr; Tenant Context &rarr; RBAC/ABAC &rarr; Domain Service &rarr; Temporal Workflow &rarr; NATS Event &rarr; Connector Execution &rarr; Audit Log
            </p>
          </div>
        </AnimatedSection>
      </Section>

      {/* Workflow Engine */}
      <Section>
        <SectionHeader
          badge="Workflow Engine"
          title="Temporal-Powered"
          titleGradient="Durable Workflows"
          description="Eight dedicated task queues ensure every privacy operation runs to completion with automatic retries, idempotency, and full audit trails."
        />
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {taskQueues.map((queue) => (
            <StaggerItem key={queue.name}>
              <IconCard
                icon={queue.icon}
                title={queue.name}
                description={queue.description}
                glowColor={queue.color}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
        <AnimatedSection delay={0.3}>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { label: "Retry Policy", value: "Exponential backoff with jitter, configurable per queue" },
              { label: "Idempotency", value: "Workflow-level deduplication with idempotency keys" },
              { label: "Observability", value: "OpenTelemetry traces on every workflow step" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-primary mb-1">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </Section>

      {/* Event-Driven Architecture */}
      <Section variant="radial">
        <SectionHeader
          badge="Event Bus"
          title="Event-Driven with"
          titleGradient="NATS JetStream"
          description="All domain events flow through NATS JetStream with HMAC-signed payloads, dead-letter queues, and exactly-once processing guarantees."
        />
        <AnimatedSection>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {[
                { icon: ShieldCheck, title: "HMAC Signing", desc: "Every event payload is HMAC-SHA256 signed and verified before processing. Tampered events are rejected and logged." },
                { icon: RefreshCw, title: "Exponential Backoff", desc: "Failed consumers retry with exponential backoff and jitter. After max retries, events route to the dead-letter queue." },
                { icon: Zap, title: "Idempotent Processing", desc: "Event handlers enforce idempotency via unique event IDs stored in Redis, preventing duplicate side effects." },
                { icon: Database, title: "Dead-Letter Queue", desc: "Unprocessable events are captured with full context for manual review, replay, or automated remediation." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border border-border bg-card p-5 card-hover">
                  <div className="shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                    <item.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm space-y-3">
                {["Producer", "NATS JetStream", "Consumer Group", "Handler", "Ack / DLQ"].map((step, i) => (
                  <div key={step} className="relative">
                    <div className={`rounded-lg border p-4 text-center text-sm font-medium ${
                      i === 1
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 glow-border-cyan"
                        : "border-border bg-card text-foreground"
                    }`}>
                      {step}
                    </div>
                    {i < 4 && (
                      <div className="flex justify-center py-1">
                        <div className="h-3 w-px bg-border" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* Security Model */}
      <Section>
        <SectionHeader
          badge="Security Model"
          title="7-Layer"
          titleGradient="Auth Guard Pipeline"
          description="Every API request passes through seven sequential guard layers. Failure at any layer immediately rejects the request with zero trust."
        />
        <AnimatedSection>
          <div className="mx-auto max-w-2xl space-y-3">
            {authLayers.map((layer, i) => (
              <motion.div
                key={layer.name}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className={`rounded-xl border p-4 flex items-center gap-4 ${layer.color}`}
              >
                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-current/10 text-xs font-bold opacity-60">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{layer.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{layer.description}</p>
                </div>
                {i < authLayers.length - 1 && (
                  <Lock className="h-3.5 w-3.5 shrink-0 opacity-40" />
                )}
                {i === authLayers.length - 1 && (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              All guard failures produce structured audit events with request context, tenant ID, and correlation trace.
            </p>
          </div>
        </AnimatedSection>
      </Section>

      {/* AI Layer */}
      <Section variant="muted">
        <SectionHeader
          badge="AI Engine"
          title="Tenant-Safe"
          titleGradient="AI Co-Pilot"
          description="LLM-powered intelligence with enterprise guardrails: PII redaction before inference, circuit breaker patterns, and full tenant isolation."
        />
        <AnimatedSection>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Brain, title: "PII Redaction", desc: "All prompts pass through a fail-closed PII redaction pipeline before reaching the LLM. Detected PII is replaced with safe tokens.", glow: "purple" as const },
              { icon: Zap, title: "Circuit Breaker", desc: "Automatic fallback when AI services degrade. Configurable thresholds, half-open probes, and graceful degradation.", glow: "cyan" as const },
              { icon: Shield, title: "Tenant Isolation", desc: "Strict tenant boundaries ensure no cross-tenant data leakage in prompts, embeddings, or cached responses.", glow: "blue" as const },
            ].map((item) => (
              <IconCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                description={item.desc}
                glowColor={item.glow}
              />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="outline" size="lg" asChild>
              <Link href="/ai-copilot" className="gap-2">
                Explore AI Co-Pilot <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </AnimatedSection>
      </Section>

      {/* SaaS Architecture */}
      <Section>
        <SectionHeader
          badge="SaaS Infrastructure"
          title="Enterprise"
          titleGradient="Multi-Tenancy"
          description="Purpose-built for SaaS with row-level security, tenant-scoped billing, SCIM provisioning, and granular access control."
        />
        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Database, title: "Row-Level Security", desc: "RLS policies enforced on 60+ tables. Every query is automatically scoped to the requesting tenant.", glow: "blue" as const },
            { icon: CreditCard, title: "Stripe Billing", desc: "Usage-based metering, plan management, and invoice generation with tenant-level billing isolation.", glow: "green" as const },
            { icon: Users, title: "SCIM Provisioning", desc: "Automated user lifecycle management with SCIM 2.0. Sync users and groups from your IdP.", glow: "cyan" as const },
            { icon: Lock, title: "RBAC + ABAC", desc: "Role-based access control combined with attribute-based policies for fine-grained authorization.", glow: "purple" as const },
          ].map((item) => (
            <StaggerItem key={item.title}>
              <IconCard
                icon={item.icon}
                title={item.title}
                description={item.desc}
                glowColor={item.glow}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
        <AnimatedSection delay={0.3}>
          <div className="mt-12 rounded-xl border border-border bg-card/50 p-6">
            <div className="grid gap-6 sm:grid-cols-3 text-center">
              {[
                { stat: "60+", label: "Tables with RLS" },
                { stat: "99.99%", label: "Uptime SLA" },
                { stat: "<200ms", label: "API P95 Latency" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-3xl font-bold gradient-text">{item.stat}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* CTA */}
      <CTASection
        title="See the Platform"
        titleGradient="In Action."
        description="Schedule an architecture deep-dive with our engineering team. See how TechD PrivacyOps delivers enterprise-grade privacy operations at scale."
        primaryCta="Book Architecture Review"
        primaryHref="/contact"
        secondaryCta="View Security"
        secondaryHref="/security"
      />
    </div>
  );
}
