"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import Link from "next/link";

interface CTASectionProps {
  title?: string;
  titleGradient?: string;
  description?: string;
  primaryCta?: string;
  primaryHref?: string;
  secondaryCta?: string;
  secondaryHref?: string;
}

export function CTASection({
  title = "Ready to Secure Your Data?",
  titleGradient = "Automatically.",
  description = "Join enterprises worldwide who trust TechD PrivacyOps to discover, classify, and remediate data risk across their entire infrastructure.",
  primaryCta = "Book a Demo",
  primaryHref = "/contact",
  secondaryCta = "View Platform",
  secondaryHref = "/platform",
}: CTASectionProps) {
  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 radial-hero" />
      <div className="absolute inset-0 grid-bg" />

      <div className="relative mx-auto max-w-4xl px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8 inline-flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 p-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl mb-6">
            {title}{" "}
            <span className="gradient-text">{titleGradient}</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="glow" size="xl" asChild>
              <Link href={primaryHref} className="gap-2">
                {primaryCta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="secondary" size="xl" asChild>
              <Link href={secondaryHref}>{secondaryCta}</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
