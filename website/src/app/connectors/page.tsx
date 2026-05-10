"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/section";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/animated-section";
import { CTASection } from "@/components/shared/cta-section";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Cloud,
  Database,
  Users,
  GitBranch,
  ShieldCheck,
  HardDrive,
  ArrowRight,
  CheckCircle2,
  Clock,
  Plug,
  Lock,
  FlaskConical,
  Layers,
  Activity,
  Server,
  Mail,
  MessageSquare,
  Ticket,
  Headphones,
  KeyRound,
  Code2,
  BarChart3,
  Radio,
  Workflow,
  Box,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type ConnectorStatus = "ga" | "coming_soon";
type Capability = "Discovery" | "Classification" | "Remediation" | "DSAR";
type Category =
  | "Cloud Storage"
  | "Databases"
  | "SaaS"
  | "Identity"
  | "DevOps"
  | "Security"
  | "Data";

interface Connector {
  name: string;
  icon: LucideIcon;
  category: Category;
  capabilities: Capability[];
  status: ConnectorStatus;
}

const CONNECTORS: Connector[] = [
  // Cloud Storage
  { name: "AWS S3", icon: Cloud, category: "Cloud Storage", capabilities: ["Discovery", "Classification", "Remediation", "DSAR"], status: "ga" },
  { name: "Azure Blob Storage", icon: Cloud, category: "Cloud Storage", capabilities: ["Discovery", "Classification", "Remediation", "DSAR"], status: "ga" },
  { name: "GCP Cloud Storage", icon: Cloud, category: "Cloud Storage", capabilities: ["Discovery", "Classification", "Remediation"], status: "ga" },
  // Databases
  { name: "PostgreSQL", icon: Database, category: "Databases", capabilities: ["Discovery", "Classification", "Remediation", "DSAR"], status: "ga" },
  { name: "MySQL", icon: Database, category: "Databases", capabilities: ["Discovery", "Classification", "Remediation", "DSAR"], status: "ga" },
  { name: "SQL Server", icon: Database, category: "Databases", capabilities: ["Discovery", "Classification", "Remediation", "DSAR"], status: "ga" },
  { name: "Snowflake", icon: Database, category: "Databases", capabilities: ["Discovery", "Classification", "Remediation"], status: "ga" },
  { name: "BigQuery", icon: BarChart3, category: "Databases", capabilities: ["Discovery", "Classification", "Remediation"], status: "ga" },
  { name: "MongoDB", icon: Database, category: "Databases", capabilities: ["Discovery", "Classification", "DSAR"], status: "ga" },
  // SaaS
  { name: "Salesforce", icon: Users, category: "SaaS", capabilities: ["Discovery", "Classification", "DSAR"], status: "ga" },
  { name: "Microsoft 365", icon: Mail, category: "SaaS", capabilities: ["Discovery", "Classification", "Remediation", "DSAR"], status: "ga" },
  { name: "Google Workspace", icon: Mail, category: "SaaS", capabilities: ["Discovery", "Classification", "DSAR"], status: "ga" },
  { name: "Slack", icon: MessageSquare, category: "SaaS", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "Jira", icon: Ticket, category: "SaaS", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "ServiceNow", icon: Headphones, category: "SaaS", capabilities: ["Discovery", "Classification", "DSAR"], status: "ga" },
  { name: "HubSpot", icon: Users, category: "SaaS", capabilities: ["Discovery", "Classification", "DSAR"], status: "ga" },
  { name: "Zendesk", icon: Headphones, category: "SaaS", capabilities: ["Discovery", "Classification", "DSAR"], status: "ga" },
  // Identity
  { name: "Okta", icon: KeyRound, category: "Identity", capabilities: ["Discovery", "Classification", "Remediation"], status: "ga" },
  { name: "Azure AD", icon: KeyRound, category: "Identity", capabilities: ["Discovery", "Classification", "Remediation"], status: "ga" },
  { name: "Auth0", icon: KeyRound, category: "Identity", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "OneLogin", icon: KeyRound, category: "Identity", capabilities: ["Discovery", "Classification"], status: "ga" },
  // DevOps
  { name: "GitHub", icon: Code2, category: "DevOps", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "GitLab", icon: GitBranch, category: "DevOps", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "Bitbucket", icon: GitBranch, category: "DevOps", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "AWS CodeCommit", icon: Code2, category: "DevOps", capabilities: ["Discovery", "Classification"], status: "ga" },
  // Security
  { name: "CrowdStrike", icon: ShieldCheck, category: "Security", capabilities: ["Discovery", "Remediation"], status: "ga" },
  { name: "SentinelOne", icon: ShieldCheck, category: "Security", capabilities: ["Discovery", "Remediation"], status: "ga" },
  { name: "Splunk", icon: Activity, category: "Security", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "Elastic", icon: Activity, category: "Security", capabilities: ["Discovery", "Classification"], status: "ga" },
  // Data
  { name: "Databricks", icon: Layers, category: "Data", capabilities: ["Discovery", "Classification", "Remediation"], status: "ga" },
  { name: "Kafka", icon: Radio, category: "Data", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "Redis", icon: Server, category: "Data", capabilities: ["Discovery", "Classification"], status: "ga" },
  { name: "Elasticsearch", icon: Activity, category: "Data", capabilities: ["Discovery", "Classification", "DSAR"], status: "ga" },
  // Coming Soon
  { name: "Oracle DB", icon: Database, category: "Databases", capabilities: ["Discovery", "Classification", "Remediation", "DSAR"], status: "coming_soon" },
  { name: "SAP", icon: Workflow, category: "SaaS", capabilities: ["Discovery", "Classification", "DSAR"], status: "coming_soon" },
  { name: "Workday", icon: Users, category: "SaaS", capabilities: ["Discovery", "Classification", "DSAR"], status: "coming_soon" },
  { name: "Box", icon: Box, category: "Cloud Storage", capabilities: ["Discovery", "Classification", "Remediation"], status: "coming_soon" },
  { name: "Dropbox", icon: HardDrive, category: "Cloud Storage", capabilities: ["Discovery", "Classification", "Remediation"], status: "coming_soon" },
];

const FILTER_TABS = [
  { label: "All", value: "all" },
  { label: "Cloud Storage", value: "Cloud Storage" },
  { label: "Databases", value: "Databases" },
  { label: "SaaS", value: "SaaS" },
  { label: "Identity", value: "Identity" },
  { label: "DevOps / Security", value: "DevOps/Security" },
  { label: "Data", value: "Data" },
] as const;

const CAPABILITY_BADGE: Record<Capability, "cyan" | "purple" | "green" | "default"> = {
  Discovery: "cyan",
  Classification: "purple",
  Remediation: "green",
  DSAR: "default",
};

const MATRIX_ROWS = [
  { category: "Cloud Storage", discovery: true, classification: true, access: true, remediationNative: true, remediationCatalog: true, remediationManual: false, dsar: true },
  { category: "Databases", discovery: true, classification: true, access: true, remediationNative: true, remediationCatalog: true, remediationManual: false, dsar: true },
  { category: "SaaS", discovery: true, classification: true, access: true, remediationNative: false, remediationCatalog: true, remediationManual: true, dsar: true },
  { category: "Identity", discovery: true, classification: true, access: true, remediationNative: true, remediationCatalog: false, remediationManual: false, dsar: false },
  { category: "DevOps", discovery: true, classification: true, access: false, remediationNative: false, remediationCatalog: false, remediationManual: true, dsar: false },
  { category: "Security", discovery: true, classification: false, access: true, remediationNative: false, remediationCatalog: false, remediationManual: true, dsar: false },
  { category: "Data", discovery: true, classification: true, access: true, remediationNative: true, remediationCatalog: true, remediationManual: false, dsar: true },
];

const ARCH_STEPS = [
  { icon: Plug, title: "Connector SDK", description: "Standardised adapter framework with type-safe schemas for every data source." },
  { icon: Lock, title: "Secure Authentication", description: "OAuth 2.0, service accounts, and secrets vault integration. Zero plaintext credentials." },
  { icon: FlaskConical, title: "Data Sampling", description: "Smart sampling engine analyses representative slices without moving bulk data." },
  { icon: Layers, title: "Classification Pipeline", description: "ML-powered classifiers detect PII, PHI, PCI, and custom data types in real time." },
  { icon: Activity, title: "Risk Analysis", description: "Continuous risk scoring correlates access, sensitivity, and exposure signals." },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConnectorsPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const filtered = useMemo(() => {
    return CONNECTORS.filter((c) => {
      const matchesSearch =
        search === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());

      const matchesTab =
        activeTab === "all" ||
        c.category === activeTab ||
        (activeTab === "DevOps/Security" &&
          (c.category === "DevOps" || c.category === "Security"));

      return matchesSearch && matchesTab;
    });
  }, [search, activeTab]);

  return (
    <main className="relative overflow-hidden">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg" />

        <div className="relative mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6">Integrations</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              43+ Enterprise Connectors{" "}
              <span className="gradient-text">Ready to Deploy</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Connect to your entire data landscape in minutes. Pre-built
              connectors for cloud, SaaS, databases, identity providers, and
              developer tools — with automated discovery and classification
              from day one.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Search & Filter ───────────────────────────────────────────── */}
      <Section>
        <AnimatedSection>
          <div className="flex flex-col gap-6">
            {/* Search input */}
            <div className="relative max-w-md mx-auto w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search connectors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap justify-center gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                    activeTab === tab.value
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* ── Connector Grid ─────────────────────────────────────────── */}
        <StaggerContainer className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((connector) => {
            const Icon = connector.icon;
            const isComingSoon = connector.status === "coming_soon";
            return (
              <StaggerItem key={connector.name}>
                <div
                  className={cn(
                    "group relative rounded-xl border border-border bg-card p-5 card-hover flex flex-col gap-3",
                    isComingSoon && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="inline-flex rounded-lg border border-primary/20 bg-primary/5 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {isComingSoon ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Clock className="h-3 w-3" /> Coming Soon
                      </Badge>
                    ) : (
                      <Badge variant="green" className="gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> GA
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold">{connector.name}</h3>

                  <Badge variant="secondary" className="self-start text-[10px]">
                    {connector.category}
                  </Badge>

                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {connector.capabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant={CAPABILITY_BADGE[cap]}
                        className="text-[10px] px-2 py-0.5"
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {filtered.length === 0 && (
          <p className="mt-12 text-center text-muted-foreground">
            No connectors match your search. Try a different term or category.
          </p>
        )}
      </Section>

      {/* ── Capability Matrix ─────────────────────────────────────────── */}
      <Section variant="muted">
        <SectionHeader
          badge="Capabilities"
          title="Connector Capability"
          titleGradient="Matrix"
          description="See at a glance which capabilities each connector category supports."
        />

        <AnimatedSection>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-semibold text-foreground">Category</th>
                  <th className="px-3 py-3 text-center font-semibold text-foreground">Discovery</th>
                  <th className="px-3 py-3 text-center font-semibold text-foreground">Classification</th>
                  <th className="px-3 py-3 text-center font-semibold text-foreground">Access Analysis</th>
                  <th className="px-3 py-3 text-center font-semibold text-foreground" colSpan={3}>
                    Remediation
                    <div className="flex justify-center gap-2 mt-1 text-[10px] font-normal text-muted-foreground">
                      <span>Native</span>
                      <span>Catalog</span>
                      <span>Manual</span>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-foreground">DSAR</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row) => (
                  <tr key={row.category} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground">{row.category}</td>
                    <td className="px-3 py-3 text-center">{row.discovery ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">--</span>}</td>
                    <td className="px-3 py-3 text-center">{row.classification ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">--</span>}</td>
                    <td className="px-3 py-3 text-center">{row.access ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">--</span>}</td>
                    <td className="px-1 py-3 text-center">{row.remediationNative ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">--</span>}</td>
                    <td className="px-1 py-3 text-center">{row.remediationCatalog ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">--</span>}</td>
                    <td className="px-1 py-3 text-center">{row.remediationManual ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">--</span>}</td>
                    <td className="px-3 py-3 text-center">{row.dsar ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">--</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimatedSection>
      </Section>

      {/* ── Integration Architecture ──────────────────────────────────── */}
      <Section>
        <SectionHeader
          badge="Architecture"
          title="How Connectors"
          titleGradient="Work"
          description="A five-stage pipeline that keeps your data in place while extracting the insights you need."
        />

        <div className="relative">
          <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {ARCH_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <StaggerItem key={step.title}>
                  <div className="group relative rounded-xl border border-border bg-card p-6 card-hover text-center">
                    <div className="mb-4 mx-auto inline-flex rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 group-hover:border-cyan-500/40 transition-colors">
                      <StepIcon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30">
                      {i + 1}
                    </div>
                    <h3 className="text-sm font-semibold mb-2">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          {/* connecting line (desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent -z-10" />
        </div>
      </Section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <CTASection
        title="Don't See Your Connector?"
        titleGradient="Contact Us."
        description="Our Connector SDK lets you build custom integrations in days, not months. Or tell us what you need and we'll prioritise it on the roadmap."
        primaryCta="Request a Connector"
        primaryHref="/contact"
        secondaryCta="View Documentation"
        secondaryHref="/resources"
      />
    </main>
  );
}
