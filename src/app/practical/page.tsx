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
  RotateCcw,
  Camera,
  Scan,
  ShieldAlert
} from "lucide-react";
import { QUALIFICATION_PACKS, QualificationPack, PracticalScenario } from "@/lib/rpl/qualification-packs";

export default function PracticalAssessmentPage() {
  const [selectedQpId, setSelectedQpId] = useState<string>("auto-service-tech-l4");
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);
  const [flaggedPoints, setFlaggedPoints] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Virtual Tool Simulator States
  const [micrometerVal, setMicrometerVal] = useState<number>(24.52);
  const [multimeterMode, setMultimeterMode] = useState<"DC_V" | "AC_V" | "CONT" | "MEG_MOHM">("AC_V");
  const [multimeterProbe, setMultimeterProbe] = useState<"L1-N" | "L1-E" | "N-E">("L1-N");
  const [isMultimeterTesting, setIsMultimeterTesting] = useState<boolean>(false);
  const [weldAmps, setWeldAmps] = useState<number>(115);
  const [isCaliperLocked, setIsCaliperLocked] = useState<boolean>(false);

  // AI Computer Vision PPE Scanner States
  const [isPpeScanning, setIsPpeScanning] = useState<boolean>(false);
  const [ppeAuditDone, setPpeAuditDone] = useState<boolean>(true);
  const [ppeItems, setPpeItems] = useState<{ label: string; confidence: number; ok: boolean }[]>([
    { label: "BIS Certified Industrial Hard Hat (Helmet)", confidence: 98.4, ok: true },
    { label: "Polycarbonate Safety Eye Goggles (ANSI Z87.1)", confidence: 96.7, ok: true },
    { label: "Heat / High-Voltage Rated Insulated Gloves", confidence: 95.1, ok: true },
    { label: "High-Visibility Reflective Safety Vest", confidence: 97.2, ok: true },
    { label: "Steel-Toe Oil-Resistant Safety Shoes", confidence: 93.8, ok: true },
  ]);

  const handleTriggerPpeScan = () => {
    setIsPpeScanning(true);
    setTimeout(() => {
      setIsPpeScanning(false);
      setPpeAuditDone(true);
    }, 1200);
  };

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
    setIsCaliperLocked(false);
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
              Verify hands-on diagnostic competence without needing physical testing rigs. Candidates inspect component assemblies, simulate digital precision instruments, identify critical defects, and specify corrective engineering actions.
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

        {/* Trade Selection Tabs - Responsive 5-column grid */}
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Select Trade Scenario (5 National QPs Available):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-400 font-bold">{pack.qpCode}</span>
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
              {/* Virtual Precision Tool Simulator Widget */}
              <div className="rounded-2xl border border-cyan-500/30 bg-black/40 p-5 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Virtual Instrument Simulation
                    </span>
                    <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">
                      Live Hands-On Telemetry
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    Calibration Standard: ISO/IEC 17025 Compliant
                  </span>
                </div>

                {/* Instrument variant based on trade */}
                {(selectedQpId === "auto-service-tech-l4" || selectedQpId === "cnc-operator-turning-l4") && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          Digital Vernier Micrometer (0.01mm Resolution)
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Inspect shaft outer diameter / rotor thickness against factory spec (24.50 mm ± 0.05 mm).
                        </p>
                      </div>

                      {/* Digital LCD Readout */}
                      <div className="px-5 py-2.5 rounded-xl bg-zinc-950 border border-cyan-500/40 text-center font-mono shadow-inner">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-widest text-cyan-300">
                          {micrometerVal.toFixed(2)}
                        </span>
                        <span className="text-xs text-cyan-500 font-bold ml-1.5">mm</span>
                      </div>
                    </div>

                    {/* Micrometer Thimble Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>23.80 mm (Undersized)</span>
                        <span className="text-white font-bold">Target: 24.50 mm ± 0.05 mm</span>
                        <span>25.20 mm (Oversized)</span>
                      </div>
                      <input
                        type="range"
                        min="23.80"
                        max="25.20"
                        step="0.01"
                        value={micrometerVal}
                        onChange={(e) => {
                          setMicrometerVal(parseFloat(e.target.value));
                          setIsCaliperLocked(false);
                        }}
                        className="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    {/* Telemetry Status & Verification */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        {micrometerVal >= 24.45 && micrometerVal <= 24.55 ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1 font-bold">
                            ✓ WITHIN TOLERANCE (PASS - Nominal Spec Achieved)
                          </Badge>
                        ) : micrometerVal < 24.45 ? (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs px-3 py-1 font-bold">
                            ⚠ DEFECT: Undersized by {(24.50 - micrometerVal).toFixed(2)}mm (Excessive Friction Wear)
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-3 py-1 font-bold">
                            ⚠ DEFECT: Runout / Thermal Expansion (+{(micrometerVal - 24.50).toFixed(2)}mm)
                          </Badge>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsCaliperLocked(true)}
                        className={`text-xs h-8 border-cyan-500/30 ${
                          isCaliperLocked ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-300 hover:text-white"
                        }`}
                      >
                        {isCaliperLocked ? "✓ Telemetry Locked to Audit" : "Lock & Record Telemetry"}
                      </Button>
                    </div>
                  </div>
                )}

                {(selectedQpId === "solar-pv-installer-l4" || selectedQpId === "electrician-domestic-l4") && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          True-RMS Digital Multimeter & Insulation Tester
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Test AC distribution voltage, DC string polarity, and ground insulation resistance (IS 732).
                        </p>
                      </div>

                      {/* Multimeter LCD Readout */}
                      <div className="px-5 py-2.5 rounded-xl bg-zinc-950 border border-amber-500/40 text-center font-mono shadow-inner min-w-[160px]">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-300">
                          {!isMultimeterTesting 
                            ? "---.-" 
                            : multimeterMode === "AC_V" 
                            ? (multimeterProbe === "L1-N" ? "238.4" : multimeterProbe === "L1-E" ? "237.9" : "0.5")
                            : multimeterMode === "DC_V"
                            ? (multimeterProbe === "L1-N" ? "612.0" : "0.0")
                            : multimeterMode === "CONT"
                            ? (multimeterProbe === "L1-E" ? "0.04" : "O.L")
                            : (multimeterProbe === "L1-E" ? "0.18" : ">999")}
                        </span>
                        <span className="text-xs text-amber-500 font-bold ml-1.5">
                          {multimeterMode === "AC_V" ? "V AC" : multimeterMode === "DC_V" ? "V DC" : multimeterMode === "CONT" ? "Ω 🔊" : "MΩ"}
                        </span>
                      </div>
                    </div>

                    {/* Controls Grid: Mode & Probe */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Rotary Function Dial:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => { setMultimeterMode("AC_V"); setIsMultimeterTesting(false); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              multimeterMode === "AC_V" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "bg-zinc-900 border-white/5 text-zinc-400"
                            }`}
                          >
                            AC Volts (240V~)
                          </button>
                          <button
                            onClick={() => { setMultimeterMode("DC_V"); setIsMultimeterTesting(false); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              multimeterMode === "DC_V" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "bg-zinc-900 border-white/5 text-zinc-400"
                            }`}
                          >
                            DC Solar (600V⎓)
                          </button>
                          <button
                            onClick={() => { setMultimeterMode("CONT"); setIsMultimeterTesting(false); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              multimeterMode === "CONT" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "bg-zinc-900 border-white/5 text-zinc-400"
                            }`}
                          >
                            Continuity (Ω)
                          </button>
                          <button
                            onClick={() => { setMultimeterMode("MEG_MOHM"); setIsMultimeterTesting(false); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              multimeterMode === "MEG_MOHM" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "bg-zinc-900 border-white/5 text-zinc-400"
                            }`}
                          >
                            Megger (500V MΩ)
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Probe Attachment Points:
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={() => { setMultimeterProbe("L1-N"); setIsMultimeterTesting(false); }}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              multimeterProbe === "L1-N" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "bg-zinc-900 border-white/5 text-zinc-400"
                            }`}
                          >
                            Line - Neutral
                          </button>
                          <button
                            onClick={() => { setMultimeterProbe("L1-E"); setIsMultimeterTesting(false); }}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              multimeterProbe === "L1-E" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "bg-zinc-900 border-white/5 text-zinc-400"
                            }`}
                          >
                            Line - Earth
                          </button>
                          <button
                            onClick={() => { setMultimeterProbe("N-E"); setIsMultimeterTesting(false); }}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              multimeterProbe === "N-E" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "bg-zinc-900 border-white/5 text-zinc-400"
                            }`}
                          >
                            Neutral - Earth
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Measure Button & Interpretation */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <Button
                        size="sm"
                        onClick={() => setIsMultimeterTesting(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-8 px-4 rounded-xl"
                      >
                        ⚡ Trigger Test Probes
                      </Button>

                      {isMultimeterTesting && (
                        <div className="text-xs">
                          {multimeterMode === "MEG_MOHM" && multimeterProbe === "L1-E" ? (
                            <span className="text-rose-400 font-bold flex items-center gap-1.5">
                              ⚠ CRITICAL FAULT: Insulation resistance is 0.18 MΩ (&lt; 1.0 MΩ threshold). Severe ground fault danger!
                            </span>
                          ) : multimeterMode === "AC_V" && multimeterProbe === "L1-N" ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                              ✓ HEALTHY: Nominal single-phase supply 238.4V within ±6% CEA regulations.
                            </span>
                          ) : (
                            <span className="text-zinc-300">
                              Diagnostic reading recorded. Proceed with inspection checklist below.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedQpId === "welder-mmaw-l3" && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          Arc Welding Heat Input & Root Penetration Simulator
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Adjust welding current (Amperes) for 3.15mm E6013 electrode on 6mm MS plate.
                        </p>
                      </div>

                      <div className="px-5 py-2.5 rounded-xl bg-zinc-950 border border-orange-500/40 text-center font-mono shadow-inner">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-widest text-orange-400">
                          {weldAmps}
                        </span>
                        <span className="text-xs text-orange-500 font-bold ml-1.5">A ({(weldAmps * 0.0096).toFixed(2)} kJ/mm)</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>75A (Cold Arc - Lack of Fusion)</span>
                        <span className="text-white font-bold">Optimal Window: 100A - 125A</span>
                        <span>160A (Burn-Through & Spatter)</span>
                      </div>
                      <input
                        type="range"
                        min="75"
                        max="160"
                        step="1"
                        value={weldAmps}
                        onChange={(e) => setWeldAmps(parseInt(e.target.value, 10))}
                        className="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-400"
                      />
                    </div>

                    <div className="pt-2">
                      {weldAmps >= 100 && weldAmps <= 125 ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1 font-bold">
                          ✓ SOUND WELD BEAD: Good penetration, even ripple spacing, zero undercut (ISO 5817 Level B).
                        </Badge>
                      ) : weldAmps < 100 ? (
                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs px-3 py-1 font-bold">
                          ⚠ DEFECT: Lack of root penetration and slag inclusions due to insufficient arc energy.
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs px-3 py-1 font-bold">
                          ⚠ DEFECT: Severe undercut (&gt;0.8mm depth) and heavy spatter from excessive amperage.
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Computer Vision Safety & PPE Compliance Inspector */}
              <div className="rounded-2xl border border-emerald-500/30 bg-black/40 p-5 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.08)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Edge AI Computer Vision PPE & Safety Audit
                    </span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 font-mono">
                      YOLOv8-Workshop Model (30 FPS)
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    Mandatory Standard: NSQF Core Safety NOS (ASC/N9801 & CSC/N1335)
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Visual Viewfinder Simulation */}
                  <div className="lg:col-span-5 rounded-xl border border-white/10 bg-zinc-950 p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[170px] text-center">
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-[10px] font-mono font-bold text-zinc-300">CAM_01 • SHOP_FLOOR</span>
                    </div>

                    {isPpeScanning ? (
                      <div className="space-y-2 py-4 animate-in fade-in">
                        <Scan className="h-10 w-10 text-emerald-400 animate-spin mx-auto" />
                        <p className="text-xs text-emerald-300 font-bold">Scanning Candidate Safety Gear...</p>
                        <p className="text-[11px] text-muted-foreground">Running Pose & Bounding-Box Detection</p>
                      </div>
                    ) : (
                      <div className="space-y-2 py-2">
                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                          <ShieldCheck className="h-7 w-7" />
                        </div>
                        <p className="text-xs font-bold text-white">Candidate PPE Verified Active</p>
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block">
                          Safety Audit: 15/15 Marks Awarded
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-2 right-2 text-[10px] text-zinc-500 font-mono">
                      Latency: 28ms (Edge Device)
                    </div>
                  </div>

                  {/* Detected PPE Item Matrix */}
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ppeItems.map((item, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                          <span className="text-zinc-300 text-[11px] truncate max-w-[190px]">{item.label}</span>
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-mono font-bold shrink-0">
                            ✓ {item.confidence}%
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-zinc-400">
                        Zero safety infractions detected. Candidate cleared for mechanical assessment.
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTriggerPpeScan}
                        disabled={isPpeScanning}
                        className="text-xs h-7 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                      >
                        {isPpeScanning ? "Scanning..." : "Re-Scan Camera Feed"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

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
