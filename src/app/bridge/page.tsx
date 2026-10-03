"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Clock, 
  Volume2, 
  ShieldCheck, 
  Award,
  Layers,
  GraduationCap
} from "lucide-react";
import { QUALIFICATION_PACKS, QualificationPack, RPLBridgeModule } from "@/lib/rpl/qualification-packs";

export default function BridgeModulesPage() {
  const [selectedQpId, setSelectedQpId] = useState<string>("auto-service-tech-l4");
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);
  const [isRetestOpen, setIsRetestOpen] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [retestPassed, setRetestPassed] = useState<boolean>(false);

  const qp: QualificationPack = QUALIFICATION_PACKS[selectedQpId] || QUALIFICATION_PACKS["auto-service-tech-l4"];
  const currentModule: RPLBridgeModule = qp.bridgeModules[activeModuleIndex] || qp.bridgeModules[0];

  const handleAnswerSubmit = (optionIndex: number) => {
    setSelectedAnswer(optionIndex);
    if (optionIndex === 1) { // Correct answer index
      setRetestPassed(true);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs font-semibold px-2.5 py-0.5">
                Zone of Proximal Development (ZPD) Gap Engine
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                PMKVY 4.0 Orientation & Gap Remediation Standard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-amber-400" /> १२ तासांचे टेलर्ड ब्रिज मॉड्यूल (12-Hour Micro-Bridge Course)
            </h1>
            <p className="text-sm text-muted-foreground/90 mt-1 max-w-2xl leading-relaxed">
              Never reject experienced craftsmen. If an assessment reveals a 15% deficit, PathFinder RPL synthesizes an accredited 12-hour micro-bridge module to close the gap and certify the candidate.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-9 px-4 rounded-xl font-bold shadow-[0_0_15px_rgba(249,115,22,0.25)]">
              <Link href="/certificate">
                Inspect Digital RPL Certificate <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Trade Selection Tabs - Responsive 5-column grid */}
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Select Trade to Inspect Bridge Remediation (5 National QPs):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.values(QUALIFICATION_PACKS).map((pack) => {
              const isSelected = pack.id === selectedQpId;
              return (
                <button
                  key={pack.id}
                  onClick={() => {
                    setSelectedQpId(pack.id);
                    setActiveModuleIndex(0);
                    setIsRetestOpen(false);
                    setSelectedAnswer(null);
                    setRetestPassed(false);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-amber-500/15 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-400 font-bold">{pack.qpCode}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-zinc-300">
                      L{pack.nsqfLevel}
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-white mt-1.5 line-clamp-1">{pack.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{pack.titleHindi}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ZPD Competency Radar / Score Gap Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card border-white/10 p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Diagnostic Assessment Score
              </span>
              <div className={`text-3xl font-extrabold mt-1 ${retestPassed ? "text-emerald-400" : "text-amber-400"}`}>
                {retestPassed ? "92% (Certified)" : "64% (Gap Detected)"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {retestPassed 
                  ? "Candidate successfully cleared ZPD micro-retest! Meets NSQF Level standard."
                  : "Candidate demonstrated 64% overall competence against 70% certification threshold."}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5">
              <span className={`text-xs font-bold ${retestPassed ? "text-emerald-400" : "text-rose-400"}`}>
                {retestPassed ? "✓ DEFICIT CLOSED: Ready for W3C Credentials" : "Target Deficit: 6% gap in diagnostics & safety"}
              </span>
            </div>
          </Card>

          <Card className="glass-card border-white/10 p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Synthesized Remediation Duration
              </span>
              <div className="text-3xl font-extrabold text-white mt-1">12 Hours</div>
              <p className="text-xs text-muted-foreground mt-1">
                Completed over 3 evening shifts without missing daily factory employment.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Volume2 className="h-3.5 w-3.5" /> Audio & Vernacular Enabled
              </span>
            </div>
          </Card>

          <Card className="glass-card border-white/10 p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Projected Post-Bridge Pass Rate
              </span>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                {retestPassed ? "100% (Passed)" : "96.8%"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Calibrated across historical PMKVY RPL batches upon bridge completion.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5">
              <span className="text-xs font-bold text-zinc-300">Fast-Track Re-Assessment Ready</span>
            </div>
          </Card>
        </div>

        {/* Detailed Bridge Curriculum Syllabus */}
        {currentModule && (
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold">
                    NOS Gap: {currentModule.nosCode}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    Accredited 12-Hour Curriculum
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">
                    <Clock className="mr-1 h-3 w-3" /> {currentModule.hoursRequired} Hours Self-Paced
                  </Badge>
                </div>
              </div>

              <CardTitle className="text-lg sm:text-xl font-bold text-white mt-3 leading-snug">
                {currentModule.title}
              </CardTitle>
              <CardDescription className="text-sm text-zinc-300 mt-0.5">
                {currentModule.titleHindi}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Learning Outcomes */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4" /> Targeted Theoretical & Diagnostic Outcomes:
                  </span>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {currentModule.learningOutcomes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Practical Shop-Floor Checklist */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Practical Hands-On Verification Checklist:
                  </span>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {currentModule.practicalChecklist.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Fast-Track Re-Assessment Widget */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-950/40 via-amber-950/20 to-black border border-orange-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" /> Ready for Instant ZPD Gap Remediation?
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Take the 2-minute fast-track re-assessment right now to demonstrate mastery and unlock certification.
                    </p>
                  </div>
                  {!retestPassed ? (
                    <Button 
                      size="sm" 
                      onClick={() => setIsRetestOpen(!isRetestOpen)}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold h-9 px-6 rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.25)]"
                    >
                      {isRetestOpen ? "Hide Retest Challenge" : "Launch Fast-Track Retest"} <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold h-9 px-6 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <Link href="/certificate">
                        View Unlocked Certificate <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>

                {/* Interactive In-Page Retest Quiz */}
                {isRetestOpen && !retestPassed && (
                  <div className="p-4 rounded-xl bg-zinc-950/80 border border-amber-500/30 space-y-3 mt-3 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-bold">
                        Remediation Verification Question
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">Passing Threshold: 100% (Safety Critical)</span>
                    </div>

                    <p className="text-sm font-semibold text-white">
                      According to standard workshop SOP, what is the mandatory immediate action when encountering an insulation breakdown or high-voltage leakage alert?
                    </p>

                    <div className="space-y-2 pt-1">
                      {[
                        "Continue testing under load to confirm whether the breaker trips automatically.",
                        "Isolate upstream power supply, apply Lockout/Tagout (LOTO), wear rated PPE, and verify zero voltage with an insulation tester before touching.",
                        "Wrap electrical tape around the terminal connection and reset the master switch."
                      ].map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswerSubmit(idx)}
                          className={`w-full p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                            selectedAnswer === idx
                              ? idx === 1
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                                : "bg-rose-500/20 border-rose-500 text-rose-300"
                              : "bg-white/[0.02] border-white/10 text-zinc-300 hover:border-white/20"
                          }`}
                        >
                          <span className="font-bold mr-2 text-white">[{String.fromCharCode(65 + idx)}]</span>
                          {opt}
                        </button>
                      ))}
                    </div>

                    {selectedAnswer !== null && selectedAnswer !== 1 && (
                      <p className="text-xs text-rose-400 font-semibold pt-1">
                        ⚠ Incorrect. Safety protocol requires immediate isolation and LOTO. Review the checklist above and try again.
                      </p>
                    )}
                  </div>
                )}

                {/* Retest Passed Celebration Banner */}
                {retestPassed && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4 mt-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-300">
                          Remediation Completed! NSQF Competency Gap Closed
                        </div>
                        <p className="text-xs text-zinc-300">
                          The candidate has achieved 92% re-assessment score. The W3C Verifiable RPL Certificate is now cryptographically unlocked.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
