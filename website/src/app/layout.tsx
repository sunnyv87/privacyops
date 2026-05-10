import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { organizationSchema, softwareApplicationSchema, productSchema } from "@/lib/structured-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://techd.com"),
  title: {
    default: "TechD PrivacyOps — Unified DSPM + PrivacyOps + AI Security Platform",
    template: "%s | TechD PrivacyOps",
  },
  description:
    "The unified DSPM + PrivacyOps + AI Security Platform. Discover every byte of sensitive data. Map every access path. Remediate every risk — automatically. Built for DPDPA, GDPR, HIPAA & the AI era.",
  keywords: [
    "DSPM",
    "DSPM platform",
    "data security posture management",
    "PrivacyOps",
    "privacy operations",
    "AI governance",
    "AI security",
    "DSAR automation",
    "DPDPA compliance",
    "DPDPA India",
    "GDPR compliance",
    "CCPA compliance",
    "HIPAA compliance",
    "data discovery",
    "data classification",
    "attack path analysis",
    "shadow data detection",
    "data graph intelligence",
    "automated remediation",
    "consent management",
    "data risk intelligence",
    "TechD Cybersecurity",
    "Cyber Valley",
  ],
  authors: [{ name: "TechD Cybersecurity" }],
  creator: "TechD Cybersecurity",
  publisher: "TechD Cybersecurity",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://techd.com",
    siteName: "TechD PrivacyOps",
    title: "TechD PrivacyOps — Unified DSPM + PrivacyOps + AI Security Platform",
    description:
      "Discover every byte of sensitive data. Map every access path. Remediate every risk — automatically.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TechD PrivacyOps Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@techd",
    creator: "@techd",
    title: "TechD PrivacyOps — Unified DSPM + PrivacyOps + AI Security Platform",
    description:
      "Discover every byte of sensitive data. Map every access path. Remediate every risk — automatically.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "",
  },
  alternates: {
    canonical: "https://techd.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
