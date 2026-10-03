"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Award, 
  Mic, 
  Wrench, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  FileCheck2, 
  CheckCircle2, 
  Cpu, 
  Users,
  TrendingUp,
  WifiOff,
  Check
} from "lucide-react";

export default function LandingPage() {
  const [dailyInformalRate, setDailyInformalRate] = useState<number>(450);
  const [selectedCalcTrade, setSelectedCalcTrade] = useState<string>("auto");

  // Legal NSQF Level 4 Minimum Wage Rates (under Central Sphere & Scheduled Industries)
  const nsqfRates: Record<string, { title: string; dailyLegalRate: number; monthlyApprentice: number }> = {
    auto: { title: "Automotive Service Technician (Level 4)", dailyLegalRate: 865, monthlyApprentice: 19500 },
    cnc: { title: "CNC Turning Specialist (Level 4)", dailyLegalRate: 890, monthlyApprentice: 21000 },
    solar: { title: "Solar PV Project Technician (Level 4)", dailyLegalRate: 875, monthlyApprentice: 19000 },
    electrician: { title: "Domestic Electrician (Level 4)", dailyLegalRate: 855, monthlyApprentice: 18500 },
    welder: { title: "Welder MMAW (Level 3)", dailyLegalRate: 810, monthlyApprentice: 17500 },
  };

  const currentTradeConfig = nsqfRates[selectedCalcTrade] || nsqfRates.auto;
  const annualInformal = dailyInformalRate * 300; // 300 working days
  const annualCertified = currentTradeConfig.dailyLegalRate * 300;
  const annualGain = annualCertified - annualInformal;
  const percentGain = Math.round((annualGain / annualInformal) * 100);
  return (
    <div className="flex flex-col min-h-screen bg-black text-foreground overflow-x-hidden selection:bg-orange-500/30 selection:text-orange-200">
      <Script
        id="passport-forward"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `const p = new URLSearchParams(window.location.search); const t = p.get('shareToken') || p.get('token') || p.get('passport') || p.get('passportId'); if (t) window.location.replace('/dashboard?shareToken=' + encodeURIComponent(t));`,
        }}
      />

      {/* Ambient background glows */}
      <div className="absolute top-1/6 left-1/4 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Govt Bar */}
      <div className="bg-gradient-to-r from-orange-950/40 via-amber-900/20 to-orange-950/40 border-b border-orange-500/10 px-3 py-1.5 text-center text-xs font-medium text-orange-200/90 flex items-center justify-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>भारत सरकार • कौशल विकास एवं उद्यमशीलता मंत्रालय (MSDE) • Smart India Hackathon 2026 (SIH26242)</span>
        <Badge variant="outline" className="border-orange-500/30 text-orange-300 text-xs py-0 px-2 h-5 ml-1 font-mono">
          RPL AI Skill Assessment Tool
        </Badge>
      </div>

      {/* Master Nav */}
      <header className="sticky top-0 w-full backdrop-blur-xl border-b border-white/5 z-50 bg-black/85">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)] group-hover:border-orange-500/60 transition-colors">
              <Award className="h-5 w-5 text-orange-400 group-hover:scale-110 transition-transform duration-300" />
            </span>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-base sm:text-lg bg-gradient-to-r from-orange-400 via-amber-200 to-white bg-clip-text text-transparent">
                PathFinder <span className="font-semibold text-xs sm:text-sm text-orange-300/80 ml-1">RPL</span>
              </span>
              <span className="text-xs text-muted-foreground/80 tracking-wide font-mono -mt-0.5">
                AI Recognition of Prior Learning
              </span>
            </div>
          </Link>

          {/* Navigation Links with High Readability */}
          <nav className="hidden lg:flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="text-xs xl:text-sm font-semibold h-9 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl">
              <Link href="/onboarding">Candidate Assessment</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs xl:text-sm font-semibold h-9 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl">
              <Link href="/viva">Oral Viva (आवाज)</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs xl:text-sm font-semibold h-9 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl">
              <Link href="/practical">Visual Practical</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs xl:text-sm font-semibold h-9 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl">
              <Link href="/bridge">12-Hr Bridge</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs xl:text-sm font-semibold h-9 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl">
              <Link href="/certificate">Verifiable Certificate</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs xl:text-sm font-semibold h-9 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl">
              <Link href="/admin">MSDE Cockpit</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 text-xs sm:text-sm font-semibold h-9 shadow-[0_0_15px_rgba(249,115,22,0.25)]">
              <Link href="/onboarding">
                Start RPL Assessment <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 sm:pt-24 pb-20 px-4 sm:px-6 flex flex-col items-center text-center relative z-10">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs sm:text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Smart India Hackathon 2026 • Problem Statement SIH26242</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
            Recognizing Experiential Mastery, Certifying India's{" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
              Informal Workforce
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed">
            The AI-assisted assessment engine for <strong>Recognition of Prior Learning (RPL)</strong> under MSDE. Solves the literacy barrier with Vernacular Voice Viva, tests hands-on skill via Visual Practical Challenges, and certifies via W3C Verifiable Credentials.
          </p>

          {/* Quick Metrics Banner */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
            <Badge variant="outline" className="border-white/10 text-xs sm:text-sm py-1.5 px-3.5 bg-white/[0.02] text-zinc-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
              NSQF Level 3 & 4 Aligned
            </Badge>
            <Badge variant="outline" className="border-white/10 text-xs sm:text-sm py-1.5 px-3.5 bg-white/[0.02] text-zinc-300 font-medium">
              <Mic className="w-4 h-4 text-orange-400 mr-2" />
              Oral Viva in Hindi & Marathi
            </Badge>
            <Badge variant="outline" className="border-white/10 text-xs sm:text-sm py-1.5 px-3.5 bg-white/[0.02] text-zinc-300 font-mono font-medium">
              <ShieldCheck className="w-4 h-4 text-cyan-400 mr-2" />
              Ed25519 Cryptographic QR
            </Badge>
          </div>

          {/* CTA Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl px-8 py-6 text-sm sm:text-base font-bold shadow-[0_0_25px_rgba(249,115,22,0.35)] w-full sm:w-auto">
              <Link href="/onboarding">
                Begin Candidate Assessment <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/15 text-white hover:bg-white/5 rounded-2xl px-8 py-6 text-sm sm:text-base font-semibold w-full sm:w-auto">
              <Link href="/viva">
                <Mic className="mr-2 h-5 w-5 text-orange-400" /> Try Oral Viva (आवाज)
              </Link>
            </Button>
          </div>
        </div>

        {/* 5 Feature Command Modules Grid */}
        <div className="w-full max-w-7xl mx-auto mt-24 text-left">
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-xs uppercase font-mono mb-2 px-3 py-1">
              MSDE Architecture
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Engineered to Overcome Every RPL Bottleneck
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground/90 mt-2 max-w-xl mx-auto leading-relaxed">
              Eliminating assessor bias, language barriers, and paper leaks with multi-modal AI intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Link href="/viva" className="group block">
              <div className="glass-card-interactive h-full p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group-hover:border-orange-500/40">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4 group-hover:scale-110 group-hover:border-orange-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                    <Mic className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-orange-300 transition-colors">
                    Vernacular Oral Viva Engine
                  </h3>
                  <p className="text-sm text-muted-foreground/90 mt-2.5 leading-relaxed">
                    Experiential workers speak aloud in Hindi, Marathi, or English. The AI evaluates voice troubleshooting replies against National Occupational Standards (NOS).
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 text-sm text-orange-400 flex items-center gap-1.5 font-semibold">
                  <span>Test Oral Viva</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </Link>

            {/* Feature 2 */}
            <Link href="/practical" className="group block">
              <div className="glass-card-interactive h-full p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group-hover:border-cyan-500/40">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 group-hover:border-cyan-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                    Visual Practical Challenge Simulator
                  </h3>
                  <p className="text-sm text-muted-foreground/90 mt-2.5 leading-relaxed">
                    Fulfils the mandatory 70% practical weightage: candidate inspects real shop-floor assemblies, identifies defects, and verifies tool calibration.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 text-sm text-cyan-400 flex items-center gap-1.5 font-semibold">
                  <span>Launch Practical Challenge</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </Link>

            {/* Feature 3 */}
            <Link href="/bridge" className="group block">
              <div className="glass-card-interactive h-full p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group-hover:border-amber-500/40">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 group-hover:border-amber-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                    12-Hour Tailored Micro-Bridge
                  </h3>
                  <p className="text-sm text-muted-foreground/90 mt-2.5 leading-relaxed">
                    Zero rejection policy: candidates scoring 50%–69% receive a targeted 12-hour audio-guided bridge module to close the delta and unlock certification.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 text-sm text-amber-400 flex items-center gap-1.5 font-semibold">
                  <span>Synthesize Bridge Module</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </Link>

            {/* Feature 4 */}
            <Link href="/certificate" className="group block">
              <div className="glass-card-interactive h-full p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group-hover:border-emerald-500/40">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 group-hover:border-emerald-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Verifiable Digital RPL Certificate
                  </h3>
                  <p className="text-sm text-muted-foreground/90 mt-2.5 leading-relaxed">
                    Ed25519 cryptographically signed W3C Verifiable Credentials with instant mobile QR scanning for factory HR recruiters and DigiLocker integration.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 text-sm text-emerald-400 flex items-center gap-1.5 font-semibold">
                  <span>Verify Credentials</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </Link>

            {/* Feature 5 */}
            <Link href="/admin" className="group block">
              <div className="glass-card-interactive h-full p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group-hover:border-purple-500/40">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 group-hover:border-purple-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                    MSDE Assessor Telemetry Desk
                  </h3>
                  <p className="text-sm text-muted-foreground/90 mt-2.5 leading-relaxed">
                    National real-time command dashboard for ministry evaluators, monitoring batch pass rates, anti-impersonation fraud flags, and district RPL progress.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 text-sm text-purple-400 flex items-center gap-1.5 font-semibold">
                  <span>Open Assessor Cockpit</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </Link>
          </div>

          {/* Interactive Candidate Economic Uplift & Wage Ladder Calculator */}
          <div className="mt-20 p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-zinc-900/90 via-black to-zinc-950 border border-orange-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.1)]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold px-3 py-1">
                    Statutory Economic Impact Model
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    Minimum Wages Act 1948 & NAPS Scheme Linkage
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  The Informal-to-Formal Wage Ladder Calculator
                </h3>
                <p className="text-sm text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                  See how an NSQF Level 3/4 RPL certification elevates unorganized craftsmen from sub-minimum informal wages into legally protected, skilled industrial remuneration.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
                <WifiOff className="h-4 w-4 text-cyan-400" />
                <span className="text-xs text-zinc-300 font-mono">
                  Offline PWA Ready: Runs with zero rural internet
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
              {/* Left Column: Trade & Wage Controls */}
              <div className="lg:col-span-5 space-y-6 text-left">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Select Informal Craftsman Trade:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(nsqfRates).map(([key, item]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedCalcTrade(key)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                          selectedCalcTrade === key
                            ? "bg-orange-500/20 border-orange-500 text-white shadow-sm"
                            : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                        }`}
                      >
                        <span className="line-clamp-1">{item.title.split("(")[0]}</span>
                        <span className="text-[10px] text-orange-400 font-mono block mt-0.5">₹{item.dailyLegalRate}/day standard</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">Current Informal Daily Pay:</span>
                    <span className="font-extrabold text-white text-base font-mono">₹{dailyInformalRate} / day</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="650"
                    step="25"
                    value={dailyInformalRate}
                    onChange={(e) => setDailyInformalRate(parseInt(e.target.value, 10))}
                    className="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>₹300 (Helper)</span>
                    <span>₹450 (Informal Ustad)</span>
                    <span>₹650 (Senior Tech)</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Calculated Impact Breakdown */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between">
                  <div>
                    <span className="text-xs uppercase font-semibold text-muted-foreground">Annual Informal Income</span>
                    <div className="text-2xl sm:text-3xl font-black text-zinc-400 font-mono mt-1">
                      ₹{annualInformal.toLocaleString("en-IN")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on ~300 unorganized working days per annum with zero benefits.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <span className="text-xs text-rose-400 font-medium">Unprotected under labour codes</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-zinc-950 border border-emerald-500/30 flex flex-col justify-between shadow-lg shadow-emerald-500/5">
                  <div>
                    <span className="text-xs uppercase font-semibold text-emerald-400">Post-RPL Certified Income</span>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1">
                      ₹{annualCertified.toLocaleString("en-IN")}
                    </div>
                    <p className="text-xs text-emerald-200/80 mt-1">
                      Legally enforced under Scheduled Employment minimum wage rates.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/20">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> +₹{annualGain.toLocaleString("en-IN")} (+{percentGain}%) Surge
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <span className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Statutory Industry Protections Unlocked:
                    </span>
                    <p className="text-xs text-muted-foreground">
                      ESIC Medical Insurance • EPFO Gratuity & Pension • Direct NAPS Paid Apprenticeship ({currentTradeConfig.monthlyApprentice.toLocaleString("en-IN")}/mo)
                    </p>
                  </div>
                  <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold h-9 px-5 rounded-xl shrink-0 shadow-md">
                    <Link href="/onboarding">
                      Assess & Certify Now <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 mt-auto relative z-10 bg-black/90">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground text-center sm:text-left">
          <div className="flex flex-col gap-1">
            <span className="text-white font-medium">
              PathFinder RPL — Smart India Hackathon 2026 (SIH26242)
            </span>
            <span>
              Ministry of Skill Development and Entrepreneurship (MSDE) • National Skill Development Corporation (NSDC)
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/certificate" className="hover:text-white transition-colors">
              Verifiable RPL Credentials
            </Link>
            <Link href="/admin" className="hover:text-white transition-colors">
              MSDE Assessor Telemetry
            </Link>
            <Link href="https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL" target="_blank" className="hover:text-white transition-colors underline">
              GitHub Repository
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
