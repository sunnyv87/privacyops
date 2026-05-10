import type { MetadataRoute } from "next";

const BASE_URL = "https://techd.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = [
    "",
    "/platform",
    "/privacyops",
    "/dspm",
    "/ai-copilot",
    "/connectors",
    "/compliance",
    "/security",
    "/about",
    "/pricing",
    "/contact",
    "/blog",
    "/resources",
    "/industries",
    "/industries/bfsi",
    "/industries/healthcare",
    "/industries/saas",
    "/industries/manufacturing",
    "/industries/government",
    "/industries/enterprises",
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : path.split("/").length === 2 ? 0.9 : 0.7,
  }));

  const blogSlugs = [
    "state-of-dspm-2026",
    "dpdpa-readiness-guide",
    "ai-governance-enterprise",
    "shadow-data-hidden-risk",
    "dsar-automation-playbook",
    "unified-platform-vs-point-tools",
  ];

  const resourceSlugs = [
    "dpdpa-readiness-guide-2026",
    "state-of-dspm-report-2026",
    "dsar-automation-30-days-to-30-seconds",
    "top-3-indian-bank-case-study",
    "healthcare-network-case-study",
    "ai-governance-playbook",
    "shadow-data-discovery-toolkit",
    "gdpr-article-by-article-matrix",
    "privacy-first-engineering-culture",
    "dspm-vs-casb-vs-dlp-buyers-guide",
    "attack-path-analysis-in-practice",
    "ropa-automation-7-days",
  ];

  const blogRoutes = blogSlugs.map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const resourceRoutes = resourceSlugs.map((slug) => ({
    url: `${BASE_URL}/resources/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...blogRoutes, ...resourceRoutes];
}
