import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PathFinder AI — Learning paths built on proof",
  description:
    "An evidence-based adaptive learning path engine: multi-round AI onboarding, real skill verification from GitHub, quizzes and projects, deterministic graph-based roadmaps, and replanning that reacts to your progress.",
  keywords: ["learning path", "AI tutor", "skill graph", "personalized learning", "roadmap", "evidence-based"],
  authors: [{ name: "PathFinder AI" }],
  openGraph: {
    title: "PathFinder AI — Learning paths built on proof",
    description: "Evidence-based adaptive learning paths: prove skills, plan with graph algorithms, verify with projects.",
    siteName: "PathFinder AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col overflow-x-hidden max-w-[100vw]`}
      >
        {/*
          Strip Dark Reader-injected attributes from SVGs before React
          hydrates. Without this, browser extensions that modify SVG stroke
          colors cause hydration mismatches on every icon.
        */}
        <Script
          id="dark-reader-cleanup"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `document.querySelectorAll('svg').forEach(svg => {
  svg.removeAttribute('data-darkreader-inline-stroke');
  svg.removeAttribute('data-darkreader-inline-fill');
  const s = svg.getAttribute('style');
  if (s && s.includes('--darkreader-inline')) {
    svg.setAttribute('style', s.replace(/--darkreader-inline-[a-z]+:[^;]+;?/gi, '').trim());
  }
});`,
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
