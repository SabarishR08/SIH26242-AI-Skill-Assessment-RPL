"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle,
  Eye,
  Check,
  RotateCcw
} from "lucide-react";
import { QUALIFICATION_PACKS, QualificationPack, PracticalScenario } from "@/lib/rpl/qualification-packs";

export default function PracticalAssessmentPage() {
  const [selectedQpId, setSelectedQpId] = useState<string>("auto-service-tech-l4");
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);
  const [flaggedPoints, setFlaggedPoints] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const qp: QualificationPack = QUALIFICATION_PACKS[selectedQpId] || QUALIFICATION_PACKS["auto-service-tech-l4"];
  const currentScenario: PracticalScenario = qp.practicalScenarios[selectedScenarioIndex] || qp.practicalScenarios[0];

  const handleTogglePoint = (pointId: string) => {
    if (isSubmitted) return;
    setFlaggedPoints(prev => ({
      ...prev,
      [pointId]: !prev[pointId]
    }));
  };

  const handleSubmitAudit = () => {
    setIsSubmitted(true);
  };

  const handleResetAudit = () => {
    setFlaggedPoints({});
    setIsSubmitted(false);
  };

  // Calculate score
  let correctCount = 0;
  if (isSubmitted && currentScenario) {
    currentScenario.inspectionPoints.forEach(p => {
      const flagged = Boolean(flaggedPoints[p.id]);
      if (flagged === p.isDefectOrCritical) {
        correctCount++;
      }
    });
  }
  const scorePct = currentScenario 
    ? Math.round((correctCount / currentScenario.inspectionPoints.length) * 100) 
    : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-xs font-semibold px-2.5 py-0.5">
                Practical Skill Simulation (Hands-On Verification)
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                Bureau of Indian Standards (BIS) & NSQF Level 4 Standard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Wrench className="h-7 w-7 text-cyan-400" /> प्रात्यक्षिक कौशल्य मूल्यांकन (Visual Practical Challenge)
            </h1>
            <p className="text-sm text-muted-foreground/90 mt-1 max-w-2xl leading-relaxed">
              Verify hands-on diagnostic competence without needing physical testing rigs. Candidates inspect component assemblies, identify critical defects, and specify corrective engineering actions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild size="sm" variant="outline" className="border-white/10 text-xs h-9 rounded-xl">
              <Link href="/viva">
                Switch to Oral Viva <ArrowRight className="ml-1.5 h-3.5 w-3.5 text-orange-400" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Trade Selection Tabs */}
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Select Trade Scenario:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(QUALIFICATION_PACKS).map((pack) => {
              const isSelected = pack.id === selectedQpId;
              return (
                <button
                  key={pack.id}
                  onClick={() => {
                    setSelectedQpId(pack.id);
                    setSelectedScenarioIndex(0);
                    handleResetAudit();
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-400 font-bold">{pack.qpCode}</span>
                    <Badge variant="outline" className="text-xs border-white/10 text-zinc-300">
                      NSQF L{pack.nsqfLevel}
                    </Badge>
                  </div>
                  <div className="text-sm font-bold text-white mt-1.5">{pack.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{pack.titleHindi}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scenario Card */}
        {currentScenario && (
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs font-bold">
                    {currentScenario.category.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    NOS: {currentScenario.nosCode}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">
                  Tap inspection items to flag critical defects
                </Badge>
              </div>

              <CardTitle className="text-lg sm:text-xl font-bold text-white mt-2">
                {currentScenario.title}
              </CardTitle>
              <CardDescription className="text-sm text-zinc-300 mt-1 leading-relaxed">
                {currentScenario.scenarioDescription}
              </CardDescription>
              <p className="text-xs text-muted-foreground/80 italic mt-0.5">
                {currentScenario.scenarioDescriptionHindi}
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Inspection Points Checkpoints */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
                  Component Inspection Checkpoints (Click to Flag Defects):
                </span>
                <div className="space-y-3">
                  {currentScenario.inspectionPoints.map((point) => {
                    const isFlagged = Boolean(flaggedPoints[point.id]);
                    const isCorrect = isSubmitted ? (isFlagged === point.isDefectOrCritical) : null;

                    return (
                      <div
                        key={point.id}
                        onClick={() => handleTogglePoint(point.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                          isSubmitted
                            ? isCorrect
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : "bg-rose-500/10 border-rose-500/30"
                            : isFlagged
                            ? "bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10"
                            : "bg-white/[0.02] border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center text-xs font-bold ${
                            isFlagged 
                              ? "bg-amber-500 border-amber-500 text-black" 
                              : "border-white/20 text-transparent"
                          }`}>
                            ✓
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white leading-snug">
                              {point.label}
                            </p>
                            {isSubmitted && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                <strong>Assessment Analysis:</strong> {point.explanation}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          {isSubmitted ? (
                            <Badge className={`text-xs px-2.5 py-0.5 font-bold ${
                              point.isDefectOrCritical
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            }`}>
                              {point.isDefectOrCritical ? "Defect / Hazard" : "Normal Tolerance"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={`text-xs ${isFlagged ? "border-amber-500/40 text-amber-300" : "border-white/10 text-muted-foreground"}`}>
                              {isFlagged ? "Flagged Defect" : "Mark as Defect"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAudit}
                  className="border-white/10 text-xs h-9 rounded-xl"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset Inspection
                </Button>

                {!isSubmitted ? (
                  <Button
                    size="sm"
                    onClick={handleSubmitAudit}
                    className="bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-bold h-9 px-6 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                  >
                    Submit Practical Audit <Check className="ml-1.5 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">
                      Practical Accuracy: <span className="text-cyan-400 text-base">{scorePct}%</span>
                    </span>
                    <Button
                      asChild
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold h-9 px-4 rounded-xl"
                    >
                      <Link href="/bridge">
                        View ZPD Bridge Modules <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Verified Correct Action Display */}
              {isSubmitted && (
                <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Standard Operating Procedure (SOP) Corrective Action:
                  </span>
                  <p className="text-sm text-zinc-200">
                    {currentScenario.correctActionEn}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    {currentScenario.correctActionHi}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
