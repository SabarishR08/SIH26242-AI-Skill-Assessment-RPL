import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Github, BrainCircuit, Activity, BookOpen, Layers } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Nav */}
      <header className="fixed top-0 w-full backdrop-blur-xl border-b border-white/5 z-50 bg-black/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <Compass className="h-4.5 w-4.5 text-primary" />
            </span>
            <span className="font-semibold tracking-tight text-lg text-primary">
              PathFinder
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Button asChild size="sm" className="glow-primary rounded-full px-5">
              <Link href="/onboarding">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-16 px-4 sm:px-6 flex flex-col items-center text-center relative z-10">
        {/* Hero */}
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2 border border-white/5">
            <BrainCircuit className="text-primary h-6 w-6" />
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] text-gradient">
            PathFinder AI
          </h1>
          <p className="text-lg sm:text-xl font-medium text-primary/90 -mt-2">
            Powered by Nexus, Your Evidence-Based AI Learning Coach
          </p>
          <p className="mt-2 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            An evidence-based learning system that audits your code and resume, calibrates your skills, and synthesizes a mathematically optimal prerequisite roadmap.
          </p>
          
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Button asChild size="lg" className="glow-button rounded-full px-8 py-6 w-full sm:w-auto">
              <Link href="/onboarding" className="text-lg">
                Begin Your Journey <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="w-full max-w-6xl mx-auto mt-32 grid gap-6 sm:grid-cols-3">
          <div className="glass-card p-8 flex flex-col items-center text-center gap-4 transition-transform duration-300 hover:scale-[1.02]">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-primary">Skill Calibration</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We map your claims against real evidence to identify what you actually know versus what you think you know.
            </p>
          </div>
          
          <div className="glass-card p-8 flex flex-col items-center text-center gap-4 transition-transform duration-300 hover:scale-[1.02]">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-primary">Dynamic Roadmaps</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Generated paths adapt in real-time as you submit projects, fail quizzes, or prove your competence.
            </p>
          </div>

          <div className="glass-card p-8 flex flex-col items-center text-center gap-4 transition-transform duration-300 hover:scale-[1.02]">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Github className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-primary">GitHub Forensics</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We ingest repositories and code activity to automatically prove your baseline skills without manual entry.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 mt-auto relative z-10 bg-black/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>PathFinder — built for the AI hackathon</span>
          <div className="flex gap-4">
            <span className="hover:text-primary transition-colors cursor-default">Experimental Build</span>
            <span className="hover:text-primary transition-colors cursor-default">Nexus Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
