"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock,
  ChevronRight,
  Mail,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { blogPosts, type BlogPost } from "@/data/blog-posts";

/* ------------------------------------------------------------------ */
/*  TYPES & MAPS                                                       */
/* ------------------------------------------------------------------ */
type Filter = "All" | BlogPost["category"];

const filterTabs: Filter[] = [
  "All",
  "DSPM",
  "PrivacyOps",
  "AI Security",
  "Compliance",
  "Industry",
];

const badgeVariantMap: Record<
  BlogPost["category"],
  "default" | "cyan" | "purple" | "green" | "amber" | "dpdpa"
> = {
  DSPM: "cyan",
  PrivacyOps: "purple",
  "AI Security": "amber",
  Compliance: "dpdpa",
  Industry: "green",
};

/* ------------------------------------------------------------------ */
/*  HERO                                                               */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative min-h-[60vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 radial-hero" />
      <div className="absolute inset-0 grid-bg" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20 w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-5">
            BLOG · INSIGHTS · RESEARCH
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6 max-w-4xl mx-auto text-balance">
            Insights from the{" "}
            <span className="gradient-text">TechD Engineering Team</span>.
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 text-pretty">
            Field-tested perspectives on DSPM, PrivacyOps, AI governance, and the
            regulatory frontier — written by the people building the platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              {blogPosts.length} long-form articles
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Updated weekly
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  ARTICLES SECTION                                                   */
/* ------------------------------------------------------------------ */
function ArticlesSection() {
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  const filtered =
    activeFilter === "All"
      ? blogPosts
      : blogPosts.filter((p) => p.category === activeFilter);

  return (
    <Section>
      {/* Filter Tabs */}
      <AnimatedSection>
        <div className="flex flex-wrap gap-2 justify-center mb-14">
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
        {filtered.map((post) => (
          <StaggerItem key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="block h-full group">
              <Card className="h-full card-hover overflow-hidden flex flex-col">
                {/* Cover area */}
                <div className="relative h-44 bg-gradient-to-br from-primary/10 via-accent/5 to-purple-500/10 border-b border-border overflow-hidden">
                  <div className="absolute inset-0 grid-bg opacity-30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-xl bg-background/50 backdrop-blur border border-border px-4 py-2 text-xs font-mono text-muted-foreground">
                      /{post.slug}
                    </div>
                  </div>
                  <div className="absolute top-3 left-3">
                    <Badge variant={badgeVariantMap[post.category]} className="text-[10px]">
                      {post.category}
                    </Badge>
                  </div>
                </div>

                <CardHeader className="pb-3">
                  <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors text-balance">
                    {post.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3 text-pretty">
                    {post.description}
                  </p>

                  <div className="mt-auto pt-4 border-t border-border space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {post.readTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-medium text-foreground/80">
                          {post.author.name}
                        </div>
                        <div className="text-muted-foreground/80">
                          {post.author.title}
                        </div>
                      </div>
                      <span className="inline-flex items-center text-primary text-xs font-medium gap-1 group-hover:gap-2 transition-all">
                        Read article <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No articles found in this category yet.
        </div>
      )}
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
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-4 text-balance">
            The TechD Briefing
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed text-pretty">
            One concise email every other Tuesday. The DSPM and PrivacyOps
            stories that matter, distilled for security and privacy leaders. No
            spam. Unsubscribe anytime.
          </p>

          {subscribed ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <p className="text-emerald-400 font-medium">
                You&apos;re subscribed. Check your inbox for a confirmation email.
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
