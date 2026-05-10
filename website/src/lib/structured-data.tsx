export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TechD Cybersecurity",
  alternateName: "TechD PrivacyOps",
  url: "https://techd.com",
  logo: "https://techd.com/logo.png",
  description:
    "TechD PrivacyOps is the unified DSPM + PrivacyOps + AI Governance platform for the AI era. Built in Cyber Valley, India.",
  foundingLocation: "Cyber Valley, India",
  sameAs: [
    "https://www.linkedin.com/company/techd",
    "https://twitter.com/techd",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "enterprise@techd.com",
    areaServed: "Worldwide",
    availableLanguage: ["English", "Hindi"],
  },
};

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TechD PrivacyOps Platform",
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  description:
    "Unified Data Security Posture Management (DSPM), Privacy Operations (PrivacyOps), and AI Governance platform for enterprise.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Contact sales for enterprise pricing",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "127",
  },
  featureList: [
    "Data Discovery",
    "Data Classification",
    "Data Graph Intelligence",
    "Attack Path Analysis",
    "Shadow Data Detection",
    "Automated Remediation",
    "DSAR Automation",
    "Consent Management",
    "DPDPA Compliance",
    "GDPR Compliance",
    "HIPAA Compliance",
    "AI Governance",
    "43+ Native Connectors",
    "Hash-Chained Audit Logging",
  ],
};

export const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "TechD PrivacyOps + DSPM Platform",
  description:
    "The unified DSPM + PrivacyOps + AI Security platform. Discover every byte of sensitive data. Map every access path. Remediate every risk automatically.",
  brand: {
    "@type": "Brand",
    name: "TechD Cybersecurity",
  },
  category: "Enterprise Security Software",
};

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function articleSchema(article: {
  title: string;
  description: string;
  author: string;
  datePublished: string;
  slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    author: {
      "@type": "Person",
      name: article.author,
    },
    publisher: {
      "@type": "Organization",
      name: "TechD Cybersecurity",
      logo: {
        "@type": "ImageObject",
        url: "https://techd.com/logo.png",
      },
    },
    datePublished: article.datePublished,
    dateModified: article.datePublished,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://techd.com/blog/${article.slug}`,
    },
  };
}

export function StructuredData({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
