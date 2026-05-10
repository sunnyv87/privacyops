"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Lock,
  Database,
  Eye,
  UserCheck,
  FileCheck,
  Layers,
  Hash,
  KeyRound,
  ShieldAlert,
  Ban,
  Fingerprint,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const authLayers = [
  { label: "API Gateway Rate Limiting", icon: Shield },
  { label: "JWT Token Validation", icon: KeyRound },
  { label: "Session Verification", icon: Fingerprint },
  { label: "Tenant Context Injection", icon: Database },
  { label: "RBAC Permission Check", icon: UserCheck },
  { label: "ABAC Policy Evaluation", icon: FileCheck },
  { label: "RLS Query Enforcement", icon: Lock },
];

const complianceCerts = [
  { name: "SOC 2 Type II", status: "Certified" },
  { name: "ISO 27001", status: "Certified" },
  { name: "ISO 27701", status: "Certified" },
  { name: "GDPR", status: "Compliant" },
  { name: "HIPAA", status: "Compliant" },
  { name: "PCI DSS", status: "Aligned" },
];

export default function SecurityPage() {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <AnimatedSection>
            <Badge variant="cyan" className="mb-6">
              Security &amp; Trust
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Enterprise Security{" "}
              <span className="gradient-text">By Design</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              TechD PrivacyOps is architected from the ground up with
              defense-in-depth security, ensuring your sensitive data is
              protected at every layer of the stack.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="xl" asChild>
                <Link href="/contact" className="gap-2">
                  Request Security Whitepaper <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link href="/compliance">View Compliance</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Tenant Isolation */}
      <Section>
        <SectionHeader
          badge="Data Isolation"
          title="Complete Tenant Isolation with"
          titleGradient="Row-Level Security"
          description="Every query is scoped to the authenticated tenant. RLS policies enforced across all 60+ database tables ensure zero data leakage between organizations."
        />
        <StaggerContainer className="grid md:grid-cols-3 gap-6">
          <StaggerItem>
            <IconCard
              icon={Database}
              title="60+ RLS Policies"
              description="Every table enforces row-level security. No query can access data outside the tenant boundary, even in complex joins."
              glowColor="cyan"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={Layers}
              title="Namespace Isolation"
              description="Dedicated schema namespaces, storage buckets, and encryption keys per tenant for complete data separation."
              glowColor="blue"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={Eye}
              title="Cross-Tenant Prevention"
              description="Automated testing validates isolation boundaries. Continuous monitoring detects and blocks any anomalous cross-tenant access attempts."
              glowColor="purple"
            />
          </StaggerItem>
        </StaggerContainer>
      </Section>

      {/* 7-Layer Auth Guard */}
      <Section variant="muted">
        <SectionHeader
          badge="Authentication"
          title="7-Layer Auth Guard"
          titleGradient="Pipeline"
          description="Every API request passes through seven sequential security layers before reaching your data. A failure at any layer immediately terminates the request."
        />
        <AnimatedSection>
          <div className="max-w-2xl mx-auto space-y-3">
            {authLayers.map((layer, i) => {
              const Icon = layer.icon;
              return (
                <motion.div
                  key={layer.label}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 card-hover"
                >
                  <div className="flex items-center justify-center rounded-md bg-primary/10 border border-primary/20 h-10 w-10 shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {i + 1}
                    </span>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium">{layer.label}</span>
                </motion.div>
              );
            })}
          </div>
        </AnimatedSection>
      </Section>

      {/* Audit Logging */}
      <Section>
        <SectionHeader
          badge="Audit Trail"
          title="Tamper-Evident"
          titleGradient="Audit Logging"
          description="Every action is recorded with a SHA-256 hash chain, creating an immutable, cryptographically verifiable audit trail for forensics and compliance."
        />
        <StaggerContainer className="grid md:grid-cols-3 gap-6">
          <StaggerItem>
            <IconCard
              icon={Hash}
              title="SHA-256 Hash Chain"
              description="Each audit entry includes a hash of the previous entry, making retroactive tampering computationally infeasible."
              glowColor="green"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={FileCheck}
              title="Complete Event Capture"
              description="Login events, data access, configuration changes, and administrative actions are all logged with full context."
              glowColor="cyan"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={Eye}
              title="Real-Time Monitoring"
              description="Stream audit events to your SIEM. Configurable alerts for high-risk actions like bulk data exports or permission changes."
              glowColor="purple"
            />
          </StaggerItem>
        </StaggerContainer>
      </Section>

      {/* Encryption */}
      <Section variant="muted">
        <SectionHeader
          badge="Encryption"
          title="End-to-End"
          titleGradient="Data Encryption"
          description="Data is encrypted at every stage of its lifecycle, from ingestion to storage to transmission."
        />
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Lock, title: "At Rest (AES-256)", desc: "All stored data encrypted with AES-256. Tenant-specific keys managed via a dedicated KMS." },
            { icon: Shield, title: "In Transit (TLS 1.3)", desc: "All network communication enforced over TLS 1.3 with certificate pinning for internal services." },
            { icon: Hash, title: "HMAC Integrity", desc: "HMAC-SHA256 signatures verify data integrity across all internal service-to-service communication." },
            { icon: KeyRound, title: "Key Rotation", desc: "Automated key rotation with zero-downtime re-encryption. Full key lifecycle management and auditing." },
          ].map((item) => (
            <StaggerItem key={item.title}>
              <IconCard
                icon={item.icon}
                title={item.title}
                description={item.desc}
                glowColor="blue"
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* AI Safety */}
      <Section>
        <SectionHeader
          badge="AI Safety"
          title="Responsible AI with"
          titleGradient="Built-In Guardrails"
          description="Our AI copilot operates within strict safety boundaries, ensuring sensitive data never leaks through AI interactions."
        />
        <StaggerContainer className="grid md:grid-cols-3 gap-6">
          <StaggerItem>
            <IconCard
              icon={ShieldAlert}
              title="PII Redaction Layer"
              description="All data passing through the AI pipeline is automatically scanned and redacted for PII before reaching the language model."
              glowColor="purple"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={Ban}
              title="Circuit Breaker"
              description="Automatic request termination if anomalous AI behavior is detected. Rate limiting and output validation prevent data exfiltration."
              glowColor="cyan"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={Eye}
              title="Prompt Audit Trail"
              description="Every AI interaction is logged with full prompt/response pairs for governance review and compliance auditing."
              glowColor="green"
            />
          </StaggerItem>
        </StaggerContainer>
      </Section>

      {/* Access Control */}
      <Section variant="muted">
        <SectionHeader
          badge="Access Control"
          title="Fine-Grained"
          titleGradient="Authorization"
          description="Combine role-based and attribute-based access control with SCIM provisioning for enterprise-grade identity management."
        />
        <StaggerContainer className="grid md:grid-cols-3 gap-6">
          <StaggerItem>
            <IconCard
              icon={UserCheck}
              title="RBAC + ABAC"
              description="Define roles with granular permissions, then layer attribute-based policies for context-aware access decisions."
              glowColor="blue"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={Fingerprint}
              title="SCIM Provisioning"
              description="Automated user lifecycle management. Sync users and groups from your IdP with SCIM 2.0 for instant provisioning and deprovisioning."
              glowColor="cyan"
            />
          </StaggerItem>
          <StaggerItem>
            <IconCard
              icon={Shield}
              title="SSO & MFA"
              description="SAML 2.0 and OIDC single sign-on with enforced multi-factor authentication for all administrative access."
              glowColor="purple"
            />
          </StaggerItem>
        </StaggerContainer>
      </Section>

      {/* Compliance Certifications */}
      <Section>
        <SectionHeader
          badge="Compliance"
          title="Industry"
          titleGradient="Certifications"
          description="TechD PrivacyOps maintains the certifications and compliance postures your enterprise requires."
        />
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {complianceCerts.map((cert) => (
            <StaggerItem key={cert.name}>
              <Card className="text-center card-hover">
                <CardHeader>
                  <div className="mx-auto mb-2 inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 p-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <CardTitle className="text-base">{cert.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="green">{cert.status}</Badge>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* CTA */}
      <CTASection
        title="See Our Security in"
        titleGradient="Action."
        description="Schedule a security deep-dive with our team to review architecture, certifications, and compliance alignment for your organization."
        primaryCta="Book Security Review"
        primaryHref="/contact"
        secondaryCta="Download Whitepaper"
        secondaryHref="/resources"
      />
    </main>
  );
}
