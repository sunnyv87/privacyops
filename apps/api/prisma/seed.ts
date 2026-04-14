import { PrismaClient } from '@prisma/client';
import { randomUUID, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Guard: seed should only run in development/test environments
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Seed script must not run in production. Use a proper migration or admin provisioning workflow.',
    );
  }

  console.log('Seeding database...');

  // ============================================================================
  // System Roles
  // ============================================================================
  const roles = [
    {
      id: randomUUID(),
      name: 'Super Admin',
      slug: 'super-admin',
      description: 'Full platform access',
      isSystem: true,
      permissions: ['*'],
    },
    {
      id: randomUUID(),
      name: 'Tenant Admin',
      slug: 'tenant-admin',
      description: 'Full tenant administration',
      isSystem: true,
      permissions: [
        'admin:tenant:configure',
        'admin:users:manage',
        'admin:roles:manage',
        'dspm:*',
        'discovery:*',
        'classification:*',
        'consent:*',
        'dsar:*',
        'risk:*',
        'breach:*',
        'retention:*',
        'vendors:*',
        'compliance:*',
        'ropa:*',
        'dashboard:*',
        'audit:read',
      ],
    },
    {
      id: randomUUID(),
      name: 'DPO / Privacy Officer',
      slug: 'dpo',
      description: 'Data Protection Officer',
      isSystem: true,
      permissions: [
        'dspm:findings:read',
        'dspm:connectors:read',
        'discovery:assets:read',
        'classification:*',
        'consent:*',
        'dsar:*',
        'risk:*',
        'breach:*',
        'retention:*',
        'vendors:read',
        'compliance:*',
        'ropa:*',
        'dashboard:*',
        'audit:read',
      ],
    },
    {
      id: randomUUID(),
      name: 'CISO',
      slug: 'ciso',
      description: 'Chief Information Security Officer',
      isSystem: true,
      permissions: [
        'dspm:*',
        'discovery:*',
        'classification:read',
        'breach:*',
        'risk:*',
        'compliance:read',
        'dashboard:*',
        'audit:read',
      ],
    },
    {
      id: randomUUID(),
      name: 'Compliance Manager',
      slug: 'compliance-manager',
      description: 'Compliance and regulatory management',
      isSystem: true,
      permissions: [
        'dspm:findings:read',
        'discovery:assets:read',
        'classification:read',
        'consent:*',
        'dsar:*',
        'risk:*',
        'breach:read',
        'retention:*',
        'vendors:*',
        'compliance:*',
        'ropa:*',
        'dashboard:*',
        'audit:read',
      ],
    },
    {
      id: randomUUID(),
      name: 'Security Analyst',
      slug: 'security-analyst',
      description: 'Security operations and analysis',
      isSystem: true,
      permissions: [
        'dspm:findings:read',
        'dspm:findings:update',
        'dspm:connectors:read',
        'discovery:assets:read',
        'classification:read',
        'breach:*',
        'dashboard:read',
      ],
    },
    {
      id: randomUUID(),
      name: 'Data Steward',
      slug: 'data-steward',
      description: 'Data ownership and stewardship',
      isSystem: true,
      permissions: [
        'discovery:assets:read',
        'discovery:assets:update',
        'classification:read',
        'classification:review',
        'dsar:requests:read',
        'dsar:requests:collect',
        'retention:read',
        'dashboard:read',
      ],
    },
    {
      id: randomUUID(),
      name: 'Auditor',
      slug: 'auditor',
      description: 'Read-only audit access',
      isSystem: true,
      permissions: [
        'dspm:findings:read',
        'discovery:assets:read',
        'classification:read',
        'consent:read',
        'dsar:read',
        'risk:read',
        'breach:read',
        'retention:read',
        'vendors:read',
        'compliance:*',
        'ropa:read',
        'dashboard:read',
        'audit:read',
      ],
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { tenantId_slug: { tenantId: null as any, slug: role.slug } },
      update: { permissions: role.permissions },
      create: {
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        isSystem: role.isSystem,
        permissions: role.permissions,
        tenantId: null,
      },
    });
  }

  console.log(`Created ${roles.length} system roles`);

  // ============================================================================
  // Classification Labels (India-first + Global)
  // ============================================================================
  const labels = [
    // India-specific PII
    { name: 'Aadhaar Number', category: 'pii', sensitivityLevel: 5, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b[2-9]\\d{3}\\s?\\d{4}\\s?\\d{4}\\b'] } },
    { name: 'PAN Number', category: 'pii', sensitivityLevel: 4, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b[A-Z]{5}\\d{4}[A-Z]\\b'] } },
    { name: 'Indian Mobile Number', category: 'pii', sensitivityLevel: 3, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b(?:\\+91[\\s-]?)?[6-9]\\d{9}\\b'] } },
    { name: 'GSTIN', category: 'business', sensitivityLevel: 2, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b\\d{2}[A-Z]{5}\\d{4}[A-Z]\\d[Z][A-Z\\d]\\b'] } },
    { name: 'Indian Passport Number', category: 'pii', sensitivityLevel: 5, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b[A-Z]\\d{7}\\b'], keywords: ['passport'] } },
    { name: 'IFSC Code', category: 'pfi', sensitivityLevel: 2, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b[A-Z]{4}0[A-Z\\d]{6}\\b'] } },
    { name: 'Indian Voter ID', category: 'pii', sensitivityLevel: 4, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b[A-Z]{3}\\d{7}\\b'], keywords: ['voter', 'epic'] } },

    // Global PII
    { name: 'Email Address', category: 'pii', sensitivityLevel: 3, regulationTags: ['DPDP', 'GDPR'], detectionPatterns: { regex: ['\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b'] } },
    { name: 'Phone Number', category: 'pii', sensitivityLevel: 3, regulationTags: ['DPDP', 'GDPR'], detectionPatterns: { regex: ['\\b\\+?\\d{1,3}[\\s-]?\\d{3,14}\\b'], keywords: ['phone', 'mobile', 'tel'] } },
    { name: 'Full Name', category: 'pii', sensitivityLevel: 2, regulationTags: ['DPDP', 'GDPR'], detectionPatterns: { keywords: ['name', 'full_name', 'first_name', 'last_name', 'customer_name'] } },
    { name: 'Date of Birth', category: 'pii', sensitivityLevel: 3, regulationTags: ['DPDP', 'GDPR'], detectionPatterns: { keywords: ['dob', 'birth_date', 'date_of_birth', 'birthday'] } },
    { name: 'Physical Address', category: 'pii', sensitivityLevel: 3, regulationTags: ['DPDP', 'GDPR'], detectionPatterns: { keywords: ['address', 'street', 'city', 'postal_code', 'pincode', 'zip'] } },
    { name: 'IP Address', category: 'pii', sensitivityLevel: 2, regulationTags: ['GDPR'], detectionPatterns: { regex: ['\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b'] } },

    // Financial (PFI)
    { name: 'Credit Card Number', category: 'pfi', sensitivityLevel: 5, regulationTags: ['PCI-DSS'], detectionPatterns: { regex: ['\\b(?:\\d{4}[\\s-]?){3}\\d{4}\\b'] } },
    { name: 'Bank Account Number', category: 'pfi', sensitivityLevel: 5, regulationTags: ['DPDP'], detectionPatterns: { keywords: ['bank_account', 'account_number', 'acct_no'] } },
    { name: 'UPI ID', category: 'pfi', sensitivityLevel: 3, regulationTags: ['DPDP'], detectionPatterns: { regex: ['\\b[\\w.-]+@[a-z]{2,}\\b'], keywords: ['upi', 'vpa'] } },

    // Health (PHI)
    { name: 'Health Record', category: 'phi', sensitivityLevel: 5, regulationTags: ['DPDP', 'GDPR'], detectionPatterns: { keywords: ['diagnosis', 'medical', 'health', 'patient', 'prescription'] } },

    // US-specific
    { name: 'SSN', category: 'pii', sensitivityLevel: 5, regulationTags: ['CCPA'], detectionPatterns: { regex: ['\\b\\d{3}-\\d{2}-\\d{4}\\b'] } },

    // Credentials
    { name: 'Password / Secret', category: 'sensitive', sensitivityLevel: 5, regulationTags: [], detectionPatterns: { keywords: ['password', 'secret', 'api_key', 'token', 'private_key'] } },
  ];

  for (const label of labels) {
    await prisma.classificationLabel.create({
      data: {
        name: label.name,
        category: label.category,
        sensitivityLevel: label.sensitivityLevel,
        regulationTags: label.regulationTags,
        detectionPatterns: label.detectionPatterns,
        isSystem: true,
        tenantId: null,
      },
    });
  }

  console.log(`Created ${labels.length} classification labels`);

  // ============================================================================
  // Regulations
  // ============================================================================
  const dpdpId = randomUUID();
  const gdprId = randomUUID();

  await prisma.regulation.createMany({
    data: [
      {
        id: dpdpId,
        name: 'Digital Personal Data Protection Act, 2023',
        shortName: 'DPDP',
        jurisdiction: 'India',
        version: '2023',
        status: 'active',
        description: 'India\'s comprehensive personal data protection legislation',
      },
      {
        id: gdprId,
        name: 'General Data Protection Regulation',
        shortName: 'GDPR',
        jurisdiction: 'European Union',
        version: '2016/679',
        status: 'active',
        description: 'EU regulation on data protection and privacy',
      },
      {
        name: 'ISO/IEC 27701:2019',
        shortName: 'ISO27701',
        jurisdiction: 'International',
        version: '2019',
        status: 'active',
        description: 'Privacy Information Management System extension to ISO 27001',
      },
    ],
  });

  // Sample DPDP obligations
  await prisma.obligation.createMany({
    data: [
      { regulationId: dpdpId, reference: 'Section 4', title: 'Consent for Processing', description: 'Personal data shall not be processed except for lawful purposes with consent of the Data Principal.', category: 'consent' },
      { regulationId: dpdpId, reference: 'Section 5', title: 'Notice Requirements', description: 'Data Fiduciary must give notice with details of personal data and purpose of processing.', category: 'consent' },
      { regulationId: dpdpId, reference: 'Section 6', title: 'Lawful Purpose', description: 'Processing must be for a lawful purpose for which the Data Principal has given consent.', category: 'purpose_limitation' },
      { regulationId: dpdpId, reference: 'Section 8(1)', title: 'Data Security', description: 'Data Fiduciary shall protect personal data by taking reasonable security safeguards.', category: 'security' },
      { regulationId: dpdpId, reference: 'Section 8(3)', title: 'Data Retention', description: 'Data Fiduciary shall erase personal data when consent is withdrawn or purpose is fulfilled.', category: 'retention' },
      { regulationId: dpdpId, reference: 'Section 8(6)', title: 'Breach Notification', description: 'Data Fiduciary shall inform the Board and affected Data Principals in the event of a personal data breach.', category: 'breach' },
      { regulationId: dpdpId, reference: 'Section 11', title: 'Rights of Data Principal', description: 'Data Principal has the right to access, correct, and erase personal data.', category: 'data_subject_rights' },
    ],
  });

  console.log('Created regulations and obligations');

  // ============================================================================
  // Plan Catalogue (SaaS)
  // ----------------------------------------------------------------------------
  // Catalogue rows are GLOBAL (no tenant_id) and shared across tenants.
  // Feature keys must match the values used in @RequireFeature(...) decorators
  // on premium controllers. Metrics must match MeteringService record() calls.
  // ============================================================================
  type PlanSpec = {
    code: string;
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    billingInterval: string;
    sortOrder: number;
    features: string[];
    limits: Array<{ metric: string; limit: number; quotaEnforced?: boolean; softWarningPct?: number }>;
  };

  const planSpecs: PlanSpec[] = [
    {
      code: 'free',
      name: 'Free',
      description: 'Evaluate the platform with core discovery and DSPM baseline features.',
      priceCents: 0,
      currency: 'USD',
      billingInterval: 'month',
      sortOrder: 10,
      features: [
        'core_discovery',
        'core_classification',
        'core_dspm',
        'compliance_reporting',
        'audit_logs',
      ],
      limits: [
        { metric: 'api_call', limit: 10_000, quotaEnforced: false, softWarningPct: 80 },
        { metric: 'connector_sync', limit: 50, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'dataset_discovered', limit: 1_000, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'risk_scan', limit: 10, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'users', limit: 3, quotaEnforced: true, softWarningPct: 100 },
      ],
    },
    {
      code: 'starter',
      name: 'Starter',
      description: 'Privacy essentials: consent, DSAR automation, ROPA and vendor management.',
      priceCents: 49_900,
      currency: 'USD',
      billingInterval: 'month',
      sortOrder: 20,
      features: [
        'core_discovery',
        'core_classification',
        'core_dspm',
        'compliance_reporting',
        'audit_logs',
        'consent_management',
        'dsar_automation',
        'retention_policies',
        'vendor_management',
        'ropa',
      ],
      limits: [
        { metric: 'api_call', limit: 100_000, quotaEnforced: false, softWarningPct: 80 },
        { metric: 'connector_sync', limit: 500, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'dataset_discovered', limit: 10_000, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'risk_scan', limit: 100, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'users', limit: 10, quotaEnforced: true, softWarningPct: 100 },
      ],
    },
    {
      code: 'pro',
      name: 'Pro',
      description: 'Advanced DSPM: shadow data detection, predictive risk, breach response, SSO.',
      priceCents: 199_900,
      currency: 'USD',
      billingInterval: 'month',
      sortOrder: 30,
      features: [
        'core_discovery',
        'core_classification',
        'core_dspm',
        'compliance_reporting',
        'audit_logs',
        'consent_management',
        'dsar_automation',
        'retention_policies',
        'vendor_management',
        'ropa',
        'shadow_data_detection',
        'advanced_risk_analytics',
        'breach_management',
        'sso_saml',
      ],
      limits: [
        { metric: 'api_call', limit: 1_000_000, quotaEnforced: false, softWarningPct: 80 },
        { metric: 'connector_sync', limit: 5_000, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'dataset_discovered', limit: 100_000, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'risk_scan', limit: 1_000, quotaEnforced: true, softWarningPct: 80 },
        { metric: 'users', limit: 50, quotaEnforced: true, softWarningPct: 100 },
      ],
    },
    {
      code: 'enterprise',
      name: 'Enterprise',
      description: 'Unlimited scale with AI co-pilot, attack path analysis and SCIM provisioning.',
      priceCents: 0, // custom pricing — handled off-platform
      currency: 'USD',
      billingInterval: 'custom',
      sortOrder: 40,
      features: [
        'core_discovery',
        'core_classification',
        'core_dspm',
        'compliance_reporting',
        'audit_logs',
        'consent_management',
        'dsar_automation',
        'retention_policies',
        'vendor_management',
        'ropa',
        'shadow_data_detection',
        'advanced_risk_analytics',
        'breach_management',
        'sso_saml',
        'ai_copilot',
        'attack_path_analysis',
        'scim_provisioning',
      ],
      limits: [
        { metric: 'api_call', limit: -1 },
        { metric: 'connector_sync', limit: -1 },
        { metric: 'dataset_discovered', limit: -1 },
        { metric: 'risk_scan', limit: -1 },
        { metric: 'users', limit: -1 },
      ],
    },
  ];

  for (const spec of planSpecs) {
    const plan = await prisma.plan.upsert({
      where: { code: spec.code },
      update: {
        name: spec.name,
        description: spec.description,
        priceCents: spec.priceCents,
        currency: spec.currency,
        billingInterval: spec.billingInterval,
        isActive: true,
        sortOrder: spec.sortOrder,
      },
      create: {
        code: spec.code,
        name: spec.name,
        description: spec.description,
        priceCents: spec.priceCents,
        currency: spec.currency,
        billingInterval: spec.billingInterval,
        isActive: true,
        sortOrder: spec.sortOrder,
      },
    });

    for (const featureKey of spec.features) {
      await prisma.planFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: { enabled: true },
        create: { planId: plan.id, featureKey, enabled: true },
      });
    }

    for (const limit of spec.limits) {
      await prisma.planLimit.upsert({
        where: { planId_metric: { planId: plan.id, metric: limit.metric } },
        update: {
          limitValue: BigInt(limit.limit),
          period: 'month',
          quotaEnforced: limit.quotaEnforced ?? false,
          softWarningPct: limit.softWarningPct ?? 80,
        },
        create: {
          planId: plan.id,
          metric: limit.metric,
          limitValue: BigInt(limit.limit),
          period: 'month',
          quotaEnforced: limit.quotaEnforced ?? false,
          softWarningPct: limit.softWarningPct ?? 80,
        },
      });
    }
  }

  console.log(`Created ${planSpecs.length} plans with features and limits`);

  // ============================================================================
  // Demo Tenant
  // ============================================================================
  const tenantId = randomUUID();
  const adminUserId = randomUUID();

  // Link the demo tenant to the enterprise plan so every gated feature works.
  const enterprisePlan = await prisma.plan.findUnique({ where: { code: 'enterprise' } });
  if (!enterprisePlan) {
    throw new Error('Enterprise plan not found after seeding — aborting demo tenant creation.');
  }

  await prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'TechD Demo',
      slug: 'techd-demo',
      domain: 'techd.com',
      subscriptionTier: 'enterprise',
      status: 'active',
      dataResidencyRegion: 'ap-south-1',
      encryptionKeyId: 'demo-key-techd',
      planId: enterprisePlan.id,
    },
  });

  // Create a billing account + subscription so the dashboard/billing endpoints
  // have something to show for the demo tenant.
  const billingAccount = await prisma.billingAccount.create({
    data: {
      tenantId,
      provider: 'null',
      billingEmail: 'billing@techd.com',
      billingName: 'TechD Demo',
      addressCountry: 'IN',
    },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { billingAccountId: billingAccount.id },
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.subscription.create({
    data: {
      tenantId,
      planId: enterprisePlan.id,
      status: 'active',
      provider: 'null',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
  });

  await prisma.onboardingState.create({
    data: {
      tenantId,
      currentStep: 'completed',
      status: 'completed',
      completedSteps: [
        'tenant_created',
        'admin_user_created',
        'roles_assigned',
        'subscription_created',
        'billing_account_created',
      ],
      completedAt: now,
    },
  });

  // Generate a random password for the demo admin and hash it
  const demoPassword = process.env.SEED_ADMIN_PASSWORD || randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  await prisma.user.create({
    data: {
      id: adminUserId,
      tenantId,
      email: 'admin@techd.com',
      name: 'Demo Admin',
      passwordHash,
      status: 'active',
      authProvider: 'local',
      mfaEnabled: false,
    },
  });

  // Assign tenant-admin role
  const tenantAdminRole = await prisma.role.findFirst({
    where: { slug: 'tenant-admin', tenantId: null },
  });

  if (tenantAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: adminUserId,
        roleId: tenantAdminRole.id,
      },
    });
  }

  console.log('Created demo tenant and admin user');
  console.log(`  Tenant ID: ${tenantId}`);
  console.log(`  Admin User ID: ${adminUserId}`);
  console.log(`  Email: admin@techd.com`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`  Generated password: ${demoPassword}`);
    console.log('  WARNING: Save this password — it will not be shown again.');
  }

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
