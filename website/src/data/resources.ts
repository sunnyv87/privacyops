export interface Resource {
  slug: string;
  title: string;
  description: string;
  type: "Whitepaper" | "Case Study" | "Guide" | "Webinar" | "Report" | "Template";
  category: string;
  pages?: number;
  downloadSize?: string;
  duration?: string;
  date: string;
  featured?: boolean;
  abstract: string;
  keyTakeaways: string[];
}

export const resources: Resource[] = [
  {
    slug: "dpdpa-compliance-readiness-2026",
    title: "DPDPA Compliance Readiness Guide 2026",
    description:
      "A practitioner-grade walkthrough of India's Digital Personal Data Protection Act, mapped to operational controls every Data Fiduciary needs in production.",
    type: "Whitepaper",
    category: "Compliance",
    pages: 28,
    downloadSize: "4.2 MB",
    date: "May 2026",
    featured: true,
    abstract:
      "The Digital Personal Data Protection Act has moved from policy debate to active enforcement, and the gap between paper compliance and operational compliance has never been wider. This whitepaper translates Sections 11 through 14 of the Act into concrete engineering requirements, covers consent management at scale, addresses Significant Data Fiduciary designation, and provides a 90-day readiness roadmap based on lessons learned from early-mover deployments at Indian banks, healthcare networks, and large consumer platforms.",
    keyTakeaways: [
      "Operationalize the Right to Access, Correction, Erasure, and Nomination (Sections 11-14) with automated workflows",
      "Build a consent architecture that supports granular withdrawal, version-bound notices, and Consent Manager integration",
      "Prepare for Significant Data Fiduciary obligations including DPO appointment, independent audits, and DPIAs",
      "Map cross-border transfer obligations to your data fabric, including the negative-list framework",
      "Implement grievance redressal with verified identity and SLA tracking that survives regulator scrutiny",
      "Use a 90-day readiness roadmap with measurable milestones and audit-ready artifacts",
    ],
  },
  {
    slug: "state-of-dspm-report-2026",
    title: "The State of DSPM Report 2026",
    description:
      "Annual research report based on data from over 500 enterprises covering DSPM adoption, attack path analysis maturity, and the AI-driven evolution of the category.",
    type: "Report",
    category: "Research",
    pages: 42,
    downloadSize: "6.8 MB",
    date: "Apr 2026",
    featured: true,
    abstract:
      "Data Security Posture Management has moved past discovery as a category-defining capability. This year's State of DSPM Report analyzes responses from 500+ security leaders, 2.4 million scanned data stores, and 18 months of remediation telemetry to identify the practices separating top-decile programs from the rest. Topics include attack path analysis maturity curves, the consolidation of DSPM with PrivacyOps, AI-driven classification benchmarks, and the new role of automated remediation in measurable risk reduction.",
    keyTakeaways: [
      "60-80% of enterprise data lives outside formal inventories — and that is where most breaches happen",
      "Top-decile programs measure remediation SLA compliance, not just finding counts",
      "AI-driven classification reaches 94% accuracy on unstructured data when paired with schema inference",
      "Unified DSPM and PrivacyOps platforms are growing 3x faster than point tools in enterprise spend",
      "Identity-aware attack path analysis is the single highest-impact capability added in 2025-2026",
      "Predictive risk scoring reduces incident-relevant findings by 41% on average through smarter triage",
    ],
  },
  {
    slug: "dsar-automation-30-days-to-30-seconds",
    title: "DSAR Automation: From 30 Days to 30 Seconds",
    description:
      "A practical guide to automating data subject access requests end-to-end, covering identity matching, fail-closed redaction, and cross-system orchestration.",
    type: "Guide",
    category: "PrivacyOps",
    pages: 18,
    downloadSize: "2.4 MB",
    date: "Apr 2026",
    abstract:
      "DSAR volumes are growing forty percent year-over-year while the regulatory clock keeps ticking. This guide walks privacy and engineering teams through the architecture of a modern DSAR program — one that turns thirty-day manual processes into thirty-second automated workflows. We cover identity graph design, fail-closed redaction at extraction time, cross-system orchestration patterns, and the SLA management practices that prove timeliness to regulators.",
    keyTakeaways: [
      "Design an identity graph that resolves a Data Principal across every system in your environment",
      "Apply fail-closed redaction at extraction time so third-party data never leaks into a response",
      "Orchestrate fan-out across hundreds of systems with reusable connector adapters",
      "Instrument SLA tracking as a first-class concern with automatic escalation",
      "Verify identity without creating new privacy risk through risk-tiered verification",
      "Handle joint accounts, deceased Principals, and DPDPA Section 14 nominations correctly",
    ],
  },
  {
    slug: "top-3-indian-bank-unified-compliance",
    title: "Top-3 Indian Bank Case Study: Unified Compliance",
    description:
      "How a top-three Indian private bank deployed unified DSPM and PrivacyOps across 200+ data stores in 90 days to meet DPDPA, RBI, and SEBI obligations simultaneously.",
    type: "Case Study",
    category: "Banking",
    pages: 12,
    downloadSize: "1.8 MB",
    date: "Mar 2026",
    abstract:
      "Indian banks face an exceptional regulatory load — DPDPA, the RBI Master Direction on IT Governance, the SEBI Cybersecurity Framework, and sector-specific data localization rules all apply at once. This case study walks through how a top-three private bank consolidated five legacy data security tools into a unified platform, completed deployment across 200+ data stores in 90 days, and achieved measurable improvements in DSAR response time, classification accuracy, and audit preparation effort.",
    keyTakeaways: [
      "200+ structured and unstructured data stores onboarded in 90 days through automated discovery",
      "DSAR median response time reduced from 24 days to under 5 days at full DPDPA scale",
      "Five legacy tools consolidated into one platform with measurable license and operational savings",
      "Audit preparation effort reduced by 70% through continuous evidence collection",
      "Compliance posture across DPDPA, RBI, and SEBI frameworks managed from a single console",
      "Identity graph reduced false-positive PII findings by 38% through cross-system correlation",
    ],
  },
  {
    slug: "healthcare-network-hipaa-dpdpa",
    title: "Healthcare Network Case Study: HIPAA + DPDPA",
    description:
      "A multi-country healthcare network's journey to unified compliance across HIPAA, DPDPA, and emerging state-level regulations through a single data security platform.",
    type: "Case Study",
    category: "Healthcare",
    pages: 14,
    downloadSize: "2.1 MB",
    date: "Mar 2026",
    abstract:
      "Healthcare data is among the most regulated in the world, and multi-country healthcare networks face the additional challenge of harmonizing obligations across legal regimes. This case study documents how a healthcare network operating in the US, India, and Singapore unified compliance across HIPAA, DPDPA, and the Singapore PDPA using a single platform — reducing audit overhead, accelerating breach response, and improving patient trust through transparent rights fulfillment.",
    keyTakeaways: [
      "PHI discovery across 1.8 million files in former-employee accounts that legacy DLP missed entirely",
      "DSAR response time reduced 95% through patient-identity matching across clinical and billing systems",
      "Cross-regime compliance harmonized into a single control framework with regime-specific overlays",
      "Breach response time-to-containment improved by 64% through pre-mapped attack paths",
      "Independent auditor confirmation that controls satisfy HIPAA, DPDPA, and Singapore PDPA simultaneously",
      "Patient trust metrics improved measurably after launch of self-service rights portal",
    ],
  },
  {
    slug: "ai-governance-playbook-production-controls",
    title: "AI Governance Playbook: Production Controls",
    description:
      "From policy documents to production controls — a playbook for implementing fail-closed redaction, circuit breakers, and audit trails across enterprise AI systems.",
    type: "Guide",
    category: "AI Security",
    pages: 32,
    downloadSize: "5.1 MB",
    date: "Mar 2026",
    featured: true,
    abstract:
      "Most enterprise AI governance lives in PDFs that never reach production. This playbook closes the gap. It walks engineering and security leaders through the three runtime controls that separate aspirational governance from real governance — fail-closed redaction at the model gateway, circuit breakers for runaway agents and prompt injection, and audit trails that survive regulator scrutiny. Includes architecture diagrams, vendor evaluation criteria, and a 12-week implementation sequence.",
    keyTakeaways: [
      "Architect fail-closed redaction so no sensitive data ever reaches a model without explicit authorization",
      "Implement circuit breakers tuned to token consumption, output classification, and tool-call frequency",
      "Build audit trails that answer the four regulator-relevant questions about every model interaction",
      "Vendor-evaluate AI governance tools using questions that reveal real architecture, not marketing claims",
      "Sequence the 12-week implementation so each step delivers value before the next begins",
      "Align with NIST AI RMF, EU AI Act, and emerging India AI guidelines without redundant control sets",
    ],
  },
  {
    slug: "shadow-data-discovery-toolkit",
    title: "Shadow Data Discovery Toolkit",
    description:
      "A ready-to-use toolkit for running your first shadow data discovery sprint — questionnaires, scope templates, and remediation playbooks for common findings.",
    type: "Template",
    category: "DSPM",
    pages: 8,
    downloadSize: "1.1 MB",
    date: "Feb 2026",
    abstract:
      "Most enterprises have never run a serious shadow data discovery exercise, and the absence of a starting template is one of the reasons. This toolkit provides what you need to run a focused 90-day sprint — a stakeholder questionnaire, a scope-definition template, an enumeration runbook for the major cloud providers, and remediation playbooks for the ten most common findings. Designed to produce defensible evidence and measurable cleanup within a single quarter.",
    keyTakeaways: [
      "Stakeholder questionnaire that surfaces undocumented data flows during discovery scoping",
      "Scope-definition template covering cloud accounts, SaaS surfaces, and on-premises legacy stores",
      "Enumeration runbooks for AWS, Azure, GCP, and the top SaaS providers with API specifics",
      "Remediation playbooks for the ten most common findings with priority and effort estimates",
      "Reporting templates that translate technical findings into executive-ready risk narratives",
      "90-day sprint plan with weekly milestones and exit criteria",
    ],
  },
  {
    slug: "gdpr-article-by-article-matrix",
    title: "GDPR Article-by-Article Compliance Matrix",
    description:
      "Every operational article of the GDPR mapped to specific platform controls, with evidence-collection guidance for each, ready to drop into your compliance program.",
    type: "Template",
    category: "Compliance",
    pages: 24,
    downloadSize: "3.2 MB",
    date: "Feb 2026",
    abstract:
      "GDPR enforcement remains the strictest in the world by fine volume, and the operational articles of the regulation continue to surprise even mature programs. This matrix maps every operational article — from Article 5 principles through Article 35 DPIAs — to specific platform controls and continuous evidence-collection mechanisms. Designed to be dropped directly into compliance programs and used as the basis for both internal audits and supervisory authority responses.",
    keyTakeaways: [
      "Every operational GDPR article mapped to specific control implementations",
      "Evidence-collection guidance for each control, including automation opportunities",
      "Cross-references to ISO 27001, SOC 2, and DPDPA controls for unified frameworks",
      "DPIA template aligned to Article 35 with worked examples for high-risk processing",
      "Records of Processing Activities (ROPA) template aligned to Article 30 requirements",
      "Supervisory authority response playbook for breach notification and rights complaints",
    ],
  },
  {
    slug: "privacy-first-engineering-culture",
    title: "Building Privacy-First Engineering Culture",
    description:
      "On-demand webinar with leading privacy engineering practitioners on how to embed privacy into daily engineering workflows without slowing teams down.",
    type: "Webinar",
    category: "PrivacyOps",
    duration: "45 min",
    date: "Feb 2026",
    abstract:
      "Privacy programs that live in legal departments do not survive contact with engineering teams shipping features on weekly cadences. This panel webinar brings together privacy engineering leaders from Fortune 500 enterprises and high-growth startups to discuss what actually works — privacy review patterns that scale, automation that prevents rather than detects problems, and the cultural practices that make engineers want to design with privacy in mind.",
    keyTakeaways: [
      "Privacy review patterns that scale from 10 engineers to 10,000 without becoming a bottleneck",
      "Automation strategies that prevent privacy issues at design time rather than catching them in production",
      "Metrics that demonstrate privacy as a business enabler, not a tax on velocity",
      "Career paths and team structures for privacy engineers in modern organizations",
      "Practical answers to the five most common privacy-engineering objections from product teams",
      "Real examples of privacy-engineering wins from Stripe, Atlassian, and a global Indian SaaS leader",
    ],
  },
  {
    slug: "dspm-vs-casb-vs-dlp-buyers-guide",
    title: "DSPM vs CASB vs DLP: A Buyer's Guide",
    description:
      "Clarifies the overlapping data security categories with a structured framework for deciding what your enterprise actually needs and where the markets are converging.",
    type: "Whitepaper",
    category: "Industry",
    pages: 22,
    downloadSize: "3.6 MB",
    date: "Jan 2026",
    abstract:
      "DSPM, CASB, and DLP are three categories with overlapping marketing claims and surprisingly different actual capabilities. This whitepaper provides a structured comparison — what each category does well, where they fail, and how the market is converging. Includes a decision framework that maps enterprise size, regulatory exposure, and data architecture to the right category mix, and explains why the three are increasingly being absorbed into unified data security platforms.",
    keyTakeaways: [
      "Crisp definitions for DSPM, CASB, and DLP with the capabilities each category genuinely owns",
      "Decision framework matching enterprise size and regulatory exposure to the right category mix",
      "Honest assessment of where each category fails and where overlap creates redundant spend",
      "Convergence patterns showing how unified platforms are absorbing all three into single products",
      "Total cost of ownership analysis comparing best-of-breed portfolios to unified platform deployments",
      "Vendor-neutral RFP question library for evaluating tools across the converging categories",
    ],
  },
  {
    slug: "attack-path-analysis-in-practice",
    title: "Attack Path Analysis in Practice",
    description:
      "Live-recorded technical webinar walking through real attack-path analyses across cloud environments, including the questions every CISO should be asking.",
    type: "Webinar",
    category: "DSPM",
    duration: "38 min",
    date: "Jan 2026",
    abstract:
      "Attack path analysis is the highest-impact DSPM capability added in the past two years, but most teams use it superficially. This technical webinar walks through three real attack paths discovered in customer environments — including a sensitive data store reachable from the public internet through six identity hops, a service account with cross-cloud blast radius, and an over-shared SaaS folder exposing PII to third-party contractors. Each example includes the analysis methodology and the remediation that followed.",
    keyTakeaways: [
      "Methodology for tracing identity-to-data attack paths across cloud and SaaS boundaries",
      "Three real-world attack-path case studies with the analysis steps and remediation actions",
      "Questions every CISO should ask the security team about identity-to-data exposure",
      "Common configurations that produce the most dangerous attack paths in modern environments",
      "Tooling capabilities to look for when evaluating attack path analysis vendors",
      "Metrics for tracking attack path reduction over time as a board-reportable risk measure",
    ],
  },
  {
    slug: "ropa-automation-7-days",
    title: "RoPA Automation in 7 Days",
    description:
      "How to move Records of Processing Activities from a quarterly spreadsheet exercise to a continuous, automated, audit-ready artifact in a single sprint.",
    type: "Guide",
    category: "Compliance",
    pages: 16,
    downloadSize: "2.0 MB",
    date: "Jan 2026",
    abstract:
      "Records of Processing Activities under GDPR Article 30 and equivalents under DPDPA are universally maintained and almost universally out of date. This guide shows how to move RoPA from a quarterly spreadsheet exercise to a continuous artifact generated automatically from your live data fabric. The 7-day implementation plan covers data fabric integration, processing-purpose tagging, automated change detection, and the audit-ready export formats supervisory authorities expect.",
    keyTakeaways: [
      "Integrate RoPA generation with your live data fabric so the record reflects reality, not a snapshot",
      "Tag every processing activity with purpose, lawful basis, retention, and recipients automatically",
      "Detect changes in processing activities continuously and alert the privacy team to material updates",
      "Export RoPA in the formats supervisory authorities expect for both Article 30 and DPDPA equivalents",
      "Reduce RoPA maintenance effort by 90% through automation while improving accuracy materially",
      "Use RoPA automation as the foundation for DPIAs, transfer impact assessments, and breach notification",
    ],
  },
];
