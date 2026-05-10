import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
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
  title: {
    default: "TechD PrivacyOps — AI-Native DSPM & Privacy Operations Platform",
    template: "%s | TechD PrivacyOps",
  },
  description:
    "Discover, classify, and remediate data risk automatically. Enterprise-grade Data Security Posture Management and Privacy Operations powered by AI.",
  keywords: [
    "DSPM",
    "PrivacyOps",
    "data security posture management",
    "privacy automation",
    "DSAR automation",
    "AI compliance",
    "data risk intelligence",
    "GDPR compliance",
    "CCPA compliance",
    "data discovery",
    "data classification",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "TechD PrivacyOps",
    title: "TechD PrivacyOps — AI-Native DSPM & Privacy Operations Platform",
    description:
      "Discover, classify, and remediate data risk automatically. Enterprise-grade DSPM and PrivacyOps powered by AI.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TechD PrivacyOps — AI-Native DSPM & Privacy Operations Platform",
    description:
      "Discover, classify, and remediate data risk automatically.",
  },
  robots: {
    index: true,
    follow: true,
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
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
