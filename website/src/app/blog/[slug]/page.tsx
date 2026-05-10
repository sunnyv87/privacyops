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
  Calendar,
  Clock,
  ChevronRight,
  User,
  Share2,
  Bookmark,
} from "lucide-react";
import { blogPosts, type BlogPost } from "@/data/blog-posts";

/* ------------------------------------------------------------------ */
/*  STATIC PARAMS                                                      */
/* ------------------------------------------------------------------ */
export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return params.then(({ slug }) => {
    const post = blogPosts.find((p) => p.slug === slug);
    if (!post) return { title: "Article not found" };
    return {
      title: `${post.title} — TechD Blog`,
      description: post.description,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  CATEGORY BADGE MAP                                                 */
/* ------------------------------------------------------------------ */
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
/*  MARKDOWN PARSER                                                    */
/*  Handles: ## headings, paragraphs, "- " bullet lists                */
/* ------------------------------------------------------------------ */
function renderContent(content: string) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let buffer: string[] = [];
  let mode: "para" | "list" | null = null;
  let key = 0;

  const flush = () => {
    if (mode === "para" && buffer.length) {
      blocks.push(
        <p
          key={key++}
          className="text-base leading-[1.85] text-muted-foreground mb-6 text-pretty"
        >
          {buffer.join(" ")}
        </p>
      );
    } else if (mode === "list" && buffer.length) {
      blocks.push(
        <ul key={key++} className="space-y-3 mb-8 pl-1">
          {buffer.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-base leading-[1.75] text-muted-foreground text-pretty"
            >
              <ChevronRight className="h-4 w-4 mt-1.5 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    }
    buffer = [];
    mode = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith("## ")) {
      flush();
      blocks.push(
        <h2
          key={key++}
          className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-12 mb-5 text-balance"
        >
          {line.slice(3)}
        </h2>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      if (mode !== "list") flush();
      mode = "list";
      buffer.push(line.slice(2));
      continue;
    }

    if (line === "") {
      flush();
      continue;
    }

    if (mode !== "para") flush();
    mode = "para";
    buffer.push(line);
  }
  flush();

  return blocks;
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  const related = blogPosts
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  const variant = badgeVariantMap[post.category];

  return (
    <>
      {/* HERO */}
      <section className="relative pt-32 pb-12 overflow-hidden">
        <div className="absolute inset-0 radial-hero" />
        <div className="absolute inset-0 grid-bg opacity-60" />

        <div className="relative mx-auto max-w-4xl px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all articles
          </Link>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Badge variant={variant}>{post.category}</Badge>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {post.date}
            </span>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {post.readTime}
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-6 text-balance">
            {post.title}
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-10 text-pretty">
            {post.description}
          </p>

          <div className="flex items-center justify-between border-t border-b border-border py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 border border-primary/20 p-2.5">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  {post.author.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {post.author.title}
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button className="rounded-lg border border-border bg-secondary/50 p-2 hover:border-primary/30 transition-colors cursor-pointer">
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="rounded-lg border border-border bg-secondary/50 p-2 hover:border-primary/30 transition-colors cursor-pointer">
                <Bookmark className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ARTICLE BODY */}
      <section className="relative pb-20">
        <div className="relative mx-auto max-w-3xl px-6 lg:px-8 pt-12">
          <article className="prose-content">{renderContent(post.content)}</article>

          {/* Author footer */}
          <div className="mt-16 pt-8 border-t border-border">
            <div className="rounded-2xl border border-border bg-secondary/30 p-6 flex items-start gap-4">
              <div className="rounded-full bg-primary/10 border border-primary/20 p-3 shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground mb-0.5">
                  {post.author.name}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {post.author.title}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                  Part of the TechD engineering team building unified DSPM and
                  PrivacyOps for global enterprises. Have feedback on this
                  article?{" "}
                  <Link
                    href="/contact"
                    className="text-primary hover:underline"
                  >
                    Reach out
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RELATED ARTICLES */}
      {related.length > 0 && (
        <Section variant="muted">
          <div className="mb-10">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Continue Reading
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              More from{" "}
              <span className="gradient-text">{post.category}</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((r) => (
              <Link key={r.slug} href={`/blog/${r.slug}`} className="block group">
                <Card className="h-full card-hover">
                  <CardHeader>
                    <Badge variant={badgeVariantMap[r.category]} className="w-fit mb-3 text-[10px]">
                      {r.category}
                    </Badge>
                    <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors text-balance">
                      {r.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 text-pretty">
                      {r.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.date}</span>
                      <span className="inline-flex items-center text-primary font-medium gap-1 group-hover:gap-2 transition-all">
                        Read <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button variant="outline" asChild>
              <Link href="/blog" className="gap-2">
                Browse all articles <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Section>
      )}

      <CTASection
        title="See the platform behind"
        titleGradient="these insights."
        description="The TechD platform unifies DSPM, PrivacyOps, AI governance, and compliance automation in a single console — built by the engineering team that writes this blog."
        primaryCta="Book a Demo"
        primaryHref="/contact"
        secondaryCta="Explore the Platform"
        secondaryHref="/platform"
      />
    </>
  );
}
