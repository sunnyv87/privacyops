"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ChevronDown,
  Menu,
  X,
  Database,
  Lock,
  Brain,
  Plug,
  FileCheck,
  Building2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

const navigation = {
  platform: {
    label: "Platform",
    items: [
      { href: "/platform", label: "Architecture", description: "Enterprise-grade platform overview", icon: Database },
      { href: "/privacyops", label: "PrivacyOps", description: "Complete privacy operations suite", icon: Lock },
      { href: "/dspm", label: "DSPM", description: "Data Security Posture Management", icon: Shield },
      { href: "/ai-copilot", label: "AI Co-Pilot", description: "AI-powered intelligence layer", icon: Brain },
    ],
  },
  solutions: {
    label: "Solutions",
    items: [
      { href: "/connectors", label: "Connectors", description: "43+ integrations", icon: Plug },
      { href: "/compliance", label: "Compliance", description: "GDPR, CCPA, HIPAA & more", icon: FileCheck },
      { href: "/industries/bfsi", label: "Industries", description: "BFSI, Healthcare, SaaS", icon: Building2 },
      { href: "/security", label: "Security & Trust", description: "Enterprise security posture", icon: Shield },
    ],
  },
};

const simpleLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "Company" },
  { href: "/blog", label: "Resources" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <nav className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 group-hover:border-primary/40 transition-colors">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">
                TechD <span className="text-primary">PrivacyOps</span>
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {Object.entries(navigation).map(([key, { label, items }]) => (
              <div
                key={key}
                className="relative"
                onMouseEnter={() => setActiveDropdown(key)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg cursor-pointer">
                  {label}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", activeDropdown === key && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {activeDropdown === key && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 pt-2"
                    >
                      <div className="w-80 rounded-xl border border-border bg-card/95 backdrop-blur-xl p-2 shadow-2xl">
                        {items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-start gap-3 rounded-lg p-3 hover:bg-secondary transition-colors group/item"
                          >
                            <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 border border-primary/20 group-hover/item:border-primary/40 transition-colors">
                              <item.icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">{item.label}</div>
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {simpleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contact">Sign In</Link>
            </Button>
            <Button variant="glow" size="sm" asChild>
              <Link href="/contact" className="gap-1.5">
                Book Demo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <button
            className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl"
          >
            <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
              {Object.entries(navigation).map(([key, { label, items }]) => (
                <div key={key}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-secondary transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        <item.icon className="h-4 w-4 text-primary" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-1">
                {simpleLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-lg p-2.5 text-sm hover:bg-secondary transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="pt-4 border-t border-border flex flex-col gap-3">
                <Button variant="secondary" asChild>
                  <Link href="/contact">Sign In</Link>
                </Button>
                <Button variant="glow" asChild>
                  <Link href="/contact">Book Demo</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
