"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { CTASection } from "@/components/shared/cta-section";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Download,
  FileText,
  Building2,
  BookOpen,
  Video,
  BarChart3,
  ClipboardList,
  Star,
  Clock,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resources, type Resource } from "@/data/resources";

/* ------------------------------------------------------------------ */
/*  TYPES & MAPS                                                       */
/* ------------------------------------------------------------------ */
type Filter = "All" | Resource["type"];

const filterTabs: Filter[] = [
  "All",
  "Whitepaper",
  "Case Study",
  "Guide",
  "Webinar",
  "Report",
  "Template",
];

const typeBadgeMap: Record<
  Resource["type"],
  "default" | "cyan" | "purple" | "green" | "amber" | "dpdpa"
> = {
  Whitepaper: "cyan",
  "Case Study": "purple",
  Guide: "green",
  Webinar: "amber",
  Report: "default",
  Template: "dpdpa",
};

const typeIconMap: Record<Resource["type"], React.ComponentType<{ className?: string }>> = {
  Whitepaper: FileText,
  "Case Study": Building2,
  Guide: BookOpen,
  Webinar: Video,
  Report: BarChart3,
  Template: ClipboardList,
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
            RESOURCE CENTER
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6 max-w-4xl mx-auto text-balance">
            Resources for{" "}
            <span className="gradient-text">data security leaders</span>.
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 text-pretty">
            Whitepapers, research reports, case studies, and practitioner-grade
            guides — all written by the engineering team building the TechD
            platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileDown className="h-3.5 w-3.5 text-primary" />
              {resources.length} downloadable resources
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              {resources.filter((r) => r.featured).length} featured this month
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FEATURED                                                           */
/* ------------------------------------------------------------------ */
function FeaturedSection() {
  const featured = resources.filter((r) => r.featured);

  return (
    <Section variant="muted">
      <AnimatedSection>
        <div className="flex items-center gap-2 mb-2 justify-center">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            Editor&apos;s Picks
          </div>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center mb-12 text-balance">
          Featured this <span className="gradient-text">quarter</span>
        </h2>
      </AnimatedSection>

      <StaggerContainer className="grid md:grid-cols-3 gap-6">
        {featured.map((r) => {
          const Icon = typeIconMap[r.type];
          return (
            <StaggerItem key={r.slug}>
              <Link href={`/resources/${r.slug}`} className="block h-full group">
                <Card className="h-full card-hover overflow-hidden relative">
                  {/* Featured ribbon */}
                  <div className="absolute top-0 right-0 z-10">
                    <div className="bg-amber-500/15 border-l border-b border-amber-500/30 text-amber-400 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-bl-lg">
                      Featured
                    </div>
                  </div>

                  {/* Cover */}
                  <div className="relative h-48 bg-gradient-to-br from-primary/15 via-accent/10 to-purple-500/15 border-b border-border overflow-hidden">
                    <div className="absolute inset-0 grid-bg opacity-30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-2xl bg-background/60 backdrop-blur border border-border p-4">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                  </div>

                  <CardHeader className="pb-3">
                    <Badge
                      variant={typeBadgeMap[r.type]}
                      className="w-fit mb-3 text-[10px]"
                    >
                      {r.type}
                    </Badge>
                    <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors text-balance">
                      {r.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3 text-pretty">
                      {r.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
                      <div className="flex items-center gap-3">
                        {r.pages && (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {r.pages} pages
                          </span>
                        )}
                        {r.duration && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {r.duration}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center text-primary font-medium gap-1 group-hover:gap-2 transition-all">
                        Download <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  ALL RESOURCES                                                      */
/* ------------------------------------------------------------------ */
function AllResourcesSection() {
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  const filtered =
    activeFilter === "All"
      ? resources
      : resources.filter((r) => r.type === activeFilter);

  return (
    <Section>
      <AnimatedSection>
        <div className="text-center mb-12">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            Browse the Library
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-balance">
            Every resource we&apos;ve <span className="gradient-text">published</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
            Filter by format. Every resource is gated only by an email — no
            sales calls required to access the content.
          </p>
        </div>
      </AnimatedSection>

      {/* Filter Tabs */}
      <AnimatedSection>
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {filterTabs.map((tab) => {
            const count =
              tab === "All"
                ? resources.length
                : resources.filter((r) => r.type === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-2",
                  activeFilter === tab
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-secondary/50 text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground"
                )}
              >
                {tab}
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                    activeFilter === tab
                      ? "bg-primary-foreground/20"
                      : "bg-background/60"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </AnimatedSection>

      <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((r) => {
          const Icon = typeIconMap[r.type];
          return (
            <StaggerItem key={r.slug}>
              <Link href={`/resources/${r.slug}`} className="block h-full group">
                <Card className="h-full card-hover flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="rounded-lg bg-primary/10 border border-primary/20 p-2">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <Badge variant={typeBadgeMap[r.type]} className="text-[10px]">
                        {r.type}
                      </Badge>
                    </div>
                    <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors text-balance">
                      {r.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3 text-pretty">
                      {r.description}
                    </p>

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {r.pages && (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {r.pages} pages
                          </span>
                        )}
                        {r.duration && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {r.duration}
                          </span>
                        )}
                        {!r.pages && !r.duration && <span>{r.date}</span>}
                      </div>
                      <span className="inline-flex items-center text-primary font-medium gap-1 group-hover:gap-2 transition-all">
                        Download <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No resources of this type yet — check back soon.
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function ResourcesPage() {
  return (
    <>
      <HeroSection />
      <FeaturedSection />
      <AllResourcesSection />
      <CTASection
        title="See it work on"
        titleGradient="your data."
        description="The platform behind these guides is the same one shipping in production at top-tier banks, healthcare networks, and global SaaS leaders. Book a demo and we will run it on a slice of your environment."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Read the Blog"
        secondaryHref="/blog"
      />
    </>
  );
}
