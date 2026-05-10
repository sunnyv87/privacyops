"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock,
  ChevronRight,
  Mail,
  Search,
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
            Resources
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
            Insights & Resources{" "}
            <span className="gradient-text">for Data Security Leaders</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Stay ahead of the curve with expert analysis, best practices, and
            actionable guidance from the TechD security research team.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */
type ArticleCategory = "Blog" | "Whitepaper" | "Case Study" | "Guide";

const filterTabs: ("All" | ArticleCategory)[] = [
  "All",
  "Blog",
  "Whitepaper",
  "Case Study",
  "Guide",
];

const badgeVariantMap: Record<ArticleCategory, "default" | "cyan" | "purple" | "green"> = {
  Blog: "default",
  Whitepaper: "cyan",
  "Case Study": "purple",
  Guide: "green",
};

interface Article {
  category: ArticleCategory;
  title: string;
  description: string;
  date: string;
  readTime: string;
}

const articles: Article[] = [
  {
    category: "Blog",
    title: "The State of DSPM in 2026",
    description:
      "An in-depth look at how Data Security Posture Management has evolved and what security leaders should prioritize this year.",
    date: "May 2, 2026",
    readTime: "8 min read",
  },
  {
    category: "Guide",
    title: "GDPR Compliance Automation Guide",
    description:
      "A step-by-step guide to automating your GDPR compliance workflows, from data mapping to DSAR fulfillment.",
    date: "Apr 18, 2026",
    readTime: "12 min read",
  },
  {
    category: "Blog",
    title: "Building a Privacy-First Culture",
    description:
      "How leading enterprises embed privacy into engineering workflows and why culture matters more than tooling alone.",
    date: "Apr 5, 2026",
    readTime: "6 min read",
  },
  {
    category: "Whitepaper",
    title: "Shadow Data: The Hidden Risk",
    description:
      "Research findings on shadow data proliferation across enterprise environments and strategies for detection and remediation.",
    date: "Mar 22, 2026",
    readTime: "15 min read",
  },
  {
    category: "Blog",
    title: "AI in Data Security: Beyond the Hype",
    description:
      "Separating signal from noise on AI-driven security tools. What actually works, what is marketing, and what to look for.",
    date: "Mar 10, 2026",
    readTime: "10 min read",
  },
  {
    category: "Guide",
    title: "DSAR Processing Best Practices",
    description:
      "Proven workflows and automation strategies to reduce DSAR response times from weeks to hours while maintaining compliance.",
    date: "Feb 28, 2026",
    readTime: "9 min read",
  },
  {
    category: "Case Study",
    title: "How a Fortune 500 Bank Achieved Continuous Compliance",
    description:
      "Learn how a global financial institution deployed TechD PrivacyOps across 200+ data stores in 90 days.",
    date: "Feb 15, 2026",
    readTime: "7 min read",
  },
  {
    category: "Whitepaper",
    title: "The Enterprise Guide to Data Classification at Scale",
    description:
      "Technical deep-dive into AI-powered classification models, accuracy benchmarks, and deployment patterns for large enterprises.",
    date: "Jan 30, 2026",
    readTime: "18 min read",
  },
  {
    category: "Case Study",
    title: "Reducing DSAR Response Time by 95% in Healthcare",
    description:
      "A national healthcare network shares their journey automating HIPAA-compliant data subject access requests.",
    date: "Jan 12, 2026",
    readTime: "6 min read",
  },
];

/* ------------------------------------------------------------------ */
/*  ARTICLES GRID                                                      */
/* ------------------------------------------------------------------ */
function ArticlesSection() {
  const [activeFilter, setActiveFilter] = useState<"All" | ArticleCategory>("All");

  const filtered =
    activeFilter === "All"
      ? articles
      : articles.filter((a) => a.category === activeFilter);

  return (
    <Section>
      {/* Filter Tabs */}
      <AnimatedSection>
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all cursor-pointer",
                activeFilter === tab
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-secondary/50 text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </AnimatedSection>

      {/* Articles Grid */}
      <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((article) => (
          <StaggerItem key={article.title}>
            <Card className="h-full card-hover group">
              {/* Placeholder image area */}
              <div className="h-48 bg-gradient-to-br from-primary/5 to-accent/5 border-b border-border flex items-center justify-center">
                <div className="rounded-lg bg-secondary/50 border border-border p-4">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={badgeVariantMap[article.category]} className="text-xs">
                    {article.category}
                  </Badge>
                </div>
                <CardTitle className="text-base leading-snug">
                  {article.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {article.description}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {article.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {article.readTime}
                    </span>
                  </div>
                  <span className="inline-flex items-center text-primary font-medium gap-1 group-hover:gap-2 transition-all">
                    Read <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  NEWSLETTER                                                         */
/* ------------------------------------------------------------------ */
function NewsletterSection() {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <Section variant="muted">
      <AnimatedSection>
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex rounded-full bg-primary/10 border border-primary/20 p-3 mb-6">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Stay Ahead of the Curve
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Get the latest data security insights, product updates, and
            compliance guidance delivered to your inbox. No spam, unsubscribe
            anytime.
          </p>

          {subscribed ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <p className="text-emerald-400 font-medium">
                You&apos;re subscribed! Check your inbox for a confirmation email.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubscribed(true);
              }}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                placeholder="you@company.com"
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
              />
              <Button variant="glow" size="default" type="submit">
                Subscribe <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </AnimatedSection>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function BlogPage() {
  return (
    <>
      <HeroSection />
      <ArticlesSection />
      <NewsletterSection />
    </>
  );
}
