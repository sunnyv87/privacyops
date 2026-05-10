import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { CTASection } from "@/components/shared/cta-section";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Download,
  FileText,
  Building2,
  BookOpen,
  Video,
  BarChart3,
  ClipboardList,
  Clock,
  Calendar,
  CheckCircle2,
  Lock,
  HardDrive,
} from "lucide-react";
import { resources, type Resource } from "@/data/resources";

/* ------------------------------------------------------------------ */
/*  STATIC PARAMS                                                      */
/* ------------------------------------------------------------------ */
export function generateStaticParams() {
  return resources.map((r) => ({ slug: r.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return params.then(({ slug }) => {
    const r = resources.find((x) => x.slug === slug);
    if (!r) return { title: "Resource not found" };
    return {
      title: `${r.title} — TechD Resources`,
      description: r.description,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  MAPS                                                               */
/* ------------------------------------------------------------------ */
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
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = resources.find((r) => r.slug === slug);
  if (!resource) notFound();

  const Icon = typeIconMap[resource.type];
  const related = resources
    .filter((r) => r.type === resource.type && r.slug !== resource.slug)
    .slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="relative pt-32 pb-12 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg opacity-60" />

        <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all resources
          </Link>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Badge variant={typeBadgeMap[resource.type]}>
                  {resource.type}
                </Badge>
                {resource.featured && (
                  <Badge variant="amber" className="text-[10px]">
                    Editor&apos;s Pick
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {resource.date}
                </span>
                {resource.pages && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    {resource.pages} pages
                  </span>
                )}
                {resource.duration && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {resource.duration}
                  </span>
                )}
                {resource.downloadSize && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <HardDrive className="h-3 w-3" />
                    {resource.downloadSize}
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-6 text-balance">
                {resource.title}
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed text-pretty">
                {resource.description}
              </p>
            </div>

            <div className="lg:col-span-4">
              <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-purple-500/15 border border-border p-1">
                <div className="rounded-xl bg-background/40 backdrop-blur p-10 flex items-center justify-center aspect-[4/5]">
                  <div className="rounded-2xl bg-background/80 border border-border p-6">
                    <Icon className="h-12 w-12 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT — TWO COLUMN */}
      <section className="relative pb-24">
        <div className="relative mx-auto max-w-6xl px-6 lg:px-8 pt-12">
          <div className="grid lg:grid-cols-5 gap-10">
            {/* LEFT — 60% (3/5) */}
            <div className="lg:col-span-3 space-y-12">
              {/* Abstract */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                  Abstract
                </div>
                <p className="text-base leading-[1.85] text-muted-foreground text-pretty">
                  {resource.abstract}
                </p>
              </div>

              {/* Key Takeaways */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                  What You&apos;ll Learn
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-8 text-balance">
                  {resource.keyTakeaways.length} key takeaways from this {resource.type.toLowerCase()}
                </h2>
                <ul className="space-y-4">
                  {resource.keyTakeaways.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-4"
                    >
                      <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-emerald-400" />
                      <span className="text-sm text-foreground/90 leading-relaxed text-pretty">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Related */}
              {related.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                    Related Resources
                  </div>
                  <h3 className="font-display text-xl font-bold tracking-tight mb-6 text-balance">
                    More {resource.type.toLowerCase()}s like this
                  </h3>
                  <div className="space-y-3">
                    {related.map((r) => (
                      <Link
                        key={r.slug}
                        href={`/resources/${r.slug}`}
                        className="block group"
                      >
                        <div className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug truncate">
                              {r.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              {r.description}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — 40% (2/5) — DOWNLOAD FORM */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24">
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="bg-gradient-to-br from-primary/10 to-accent/5 border-b border-border p-6 text-center">
                    <div className="inline-flex rounded-full bg-primary/10 border border-primary/20 p-3 mb-3">
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
                      Free Download
                    </div>
                    <div className="font-display text-xl font-bold tracking-tight text-balance">
                      Get the full {resource.type.toLowerCase()}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {resource.pages
                        ? `${resource.pages} pages · `
                        : ""}
                      {resource.duration
                        ? `${resource.duration} · `
                        : ""}
                      {resource.downloadSize
                        ? `${resource.downloadSize} PDF`
                        : "Instant access"}
                    </div>
                  </div>

                  <form className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Jane Doe"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="jane@company.com"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                        Company
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Acme Corp"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                        Job Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Head of Privacy Engineering"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="glow"
                      size="lg"
                      className="w-full"
                    >
                      <Download className="h-4 w-4" />
                      Download Now
                    </Button>

                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground/80 leading-relaxed pt-1">
                      <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>
                        Your information is used to deliver this download and
                        related content. No sales call required. Read our{" "}
                        <Link
                          href="/contact"
                          className="text-primary hover:underline"
                        >
                          privacy notice
                        </Link>
                        .
                      </span>
                    </div>
                  </form>
                </div>

                {/* Trust strip */}
                <div className="mt-6 rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    Trusted by
                  </div>
                  <div className="text-xs text-foreground/80 leading-relaxed">
                    Privacy and security teams at top-3 Indian banks,
                    multinational healthcare networks, and global SaaS leaders
                    — read by 25,000+ practitioners.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to see"
        titleGradient="the platform?"
        description="Every resource here is grounded in real customer deployments. Book a demo and we will walk you through how the platform addresses the specific topic you just read about."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Browse More Resources"
        secondaryHref="/resources"
      />
    </>
  );
}
