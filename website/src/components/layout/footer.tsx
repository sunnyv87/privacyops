import { Shield } from "lucide-react";
import Link from "next/link";

const footerLinks = {
  Platform: [
    { href: "/platform", label: "Architecture" },
    { href: "/privacyops", label: "PrivacyOps" },
    { href: "/dspm", label: "DSPM" },
    { href: "/ai-copilot", label: "AI Co-Pilot" },
    { href: "/connectors", label: "Connectors" },
    { href: "/security", label: "Security & Trust" },
  ],
  Solutions: [
    { href: "/compliance", label: "Compliance" },
    { href: "/industries/bfsi", label: "BFSI" },
    { href: "/industries/healthcare", label: "Healthcare" },
    { href: "/industries/saas", label: "SaaS Companies" },
    { href: "/industries/government", label: "Government" },
    { href: "/industries/manufacturing", label: "Manufacturing" },
  ],
  Resources: [
    { href: "/blog", label: "Blog" },
    { href: "/resources", label: "Resource Center" },
    { href: "/pricing", label: "Pricing" },
    { href: "#", label: "Documentation" },
    { href: "#", label: "API Reference" },
    { href: "#", label: "Changelog" },
  ],
  Company: [
    { href: "/about", label: "About TechD" },
    { href: "/contact", label: "Contact Us" },
    { href: "#", label: "Careers" },
    { href: "#", label: "Press" },
    { href: "#", label: "Partners" },
    { href: "#", label: "Legal" },
  ],
};

const certifications = [
  "SOC 2 Type II",
  "ISO 27001",
  "GDPR Compliant",
  "HIPAA Ready",
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="py-16 lg:py-20">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-8 lg:mb-0">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-bold">
                  TechD <span className="text-primary">PrivacyOps</span>
                </span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xs">
                AI-native Data Security Posture Management and Privacy Operations platform for the modern enterprise.
              </p>
              <div className="flex flex-wrap gap-2">
                {certifications.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">
                  {category}
                </h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} TechD Cybersecurity. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</Link>
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Status</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
