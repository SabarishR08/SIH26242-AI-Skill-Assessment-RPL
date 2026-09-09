"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, type SimulationResult, type PathDetail } from "@/lib/client-api";
import {
  Sliders,
  Calendar,
  Clock,
  Layers,
  ArrowRight,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Zap,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatIfSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnerId: string;
  currentPath: PathDetail | null;
  onApplied?: () => void;
}

const SCENARIOS = [
  { id: "balanced", name: "Balanced", desc: "Topological depth with comprehensive breadth (2 courses/skill)" },
  { id: "fast-track", name: "Fast Track", desc: "SPT shortest-path tree pruned for minimum time to goal" },
  { id: "deep-dive", name: "Deep Dive", desc: "Maximal breadth & mastery across every prerequisite" },
  { id: "interview-prep", name: "Interview Prep", desc: "Algorithms + data structures + project gate focus" },
];

export function WhatIfSimulator({
  open,
  onOpenChange,
  learnerId,
  currentPath,
  onApplied,
}: WhatIfSimulatorProps) {
  const { toast } = useToast();
  const [scenario, setScenario] = useState<string>(currentPath?.scenario ?? "balanced");
  const [hours, setHours] = useState<number>(currentPath?.hoursPerWeek ?? 10);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Sync state when drawer opens or currentPath changes
  useEffect(() => {
    if (open && currentPath) {
      setScenario(currentPath.scenario);
      setHours(currentPath.hoursPerWeek);
      setSimulateFailure(false);
    }
  }, [open, currentPath]);

  // Run simulation whenever controls change
  useEffect(() => {
    if (!open || !learnerId) return;

    let active = true;
    const runSim = async () => {
      setLoading(true);
      try {
        const res = await api.simulatePath(learnerId, {
          scenario,
          hoursPerWeek: hours,
          simulateFailure,
        });
        if (active) {
          setResult(res);
        }
      } catch (err) {
        if (active) {
          toast({
            title: "Simulation preview failed",
            description: err instanceof Error ? err.message : "Unable to compute scenario",
            variant: "destructive",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const timeout = setTimeout(runSim, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [open, learnerId, scenario, hours, simulateFailure, toast]);

  const handleApply = async () => {
    if (!learnerId || !result) return;
    setApplying(true);
    try {
      await api.generatePath(learnerId, scenario, undefined, hours);
      toast({
        title: "Roadmap updated!",
        description: `Applied ${scenario} plan at ${hours}h/week to your active learning path.`,
      });
      onOpenChange(false);
      onApplied?.();
    } catch (err) {
      toast({
        title: "Failed to apply roadmap",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const sim = result?.simulation;
  const curr = result?.current;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6">
        <SheetHeader className="pb-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            <SheetTitle className="text-xl">Interactive &quot;What-If&quot; Simulator</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Explore counterfactual scenarios, adjust your weekly commitment, or simulate failing a gate quiz.
            The engine re-solves the dependency graph in real time without modifying your active roadmap.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pt-5">
          {/* Scenario Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Roadmap Strategy Scenario
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map((s) => {
                const isSelected = scenario === s.id;
                const isCurrent = currentPath?.scenario === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setScenario(s.id)}
                    className={cn(
                      "text-left p-3 rounded-xl border text-xs transition-all flex flex-col justify-between relative",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/60 hover:border-primary/40 bg-card/40"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between font-semibold text-foreground">
                        <span>{s.name}</span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hours Per Week Slider */}
          <div className="space-y-2 rounded-xl border border-border/50 bg-secondary/20 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Weekly Study Commitment
              </span>
              <span className="font-mono text-primary font-bold">{hours} h/week</span>
            </div>
            <input
              type="range"
              min={2}
              max={40}
              step={1}
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value, 10))}
              className="w-full accent-primary mt-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>2h (Casual)</span>
              <span>10h (Balanced)</span>
              <span>20h (Intensive)</span>
              <span>40h (Full-time)</span>
            </div>
          </div>

          {/* Edge Case & Stress Testing Toggles */}
          <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Stress & Adaptive Edge Cases
            </Label>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  Simulate Gate Quiz Failure
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Injects an automated remediation milestone to observe engine recovery & ETA impact.
                </p>
              </div>
              <Switch
                checked={simulateFailure}
                onCheckedChange={setSimulateFailure}
              />
            </div>
          </div>

          {/* Simulation Comparison Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Engine Impact Projection
              </Label>
              {loading && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" /> Calculating graph diff…
                </span>
              )}
            </div>

            {sim && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-secondary/30 border-border/50">
                  <CardContent className="p-3.5 space-y-1">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Completion ETA</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold tracking-tight text-foreground">
                        {sim.totalWeeks} wks
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        ({sim.etaDate})
                      </span>
                    </div>
                    {sim.diff.etaShiftDays !== 0 && (
                      <p className={cn(
                        "text-[11px] font-medium flex items-center gap-1",
                        sim.diff.etaShiftDays < 0 ? "text-emerald-400" : "text-amber-400"
                      )}>
                        {sim.diff.etaShiftDays < 0 ? "-" : "+"}
                        {Math.abs(sim.diff.etaShiftDays)} days vs current
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-secondary/30 border-border/50">
                  <CardContent className="p-3.5 space-y-1">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Milestones & Load</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold tracking-tight text-foreground">
                        {sim.milestonesCount} phases
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        ({sim.totalHours}h total)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {sim.diff.keptCount} preserved · {sim.diff.added.length} added · {sim.diff.removed.length} pruned
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Milestone Diffs */}
          {sim && (sim.diff.added.length > 0 || sim.diff.removed.length > 0 || sim.diff.reasons.length > 0) && (
            <div className="space-y-3 rounded-xl border border-border/50 bg-secondary/15 p-4 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Projected Graph Diffs
              </div>

              {sim.diff.reasons.length > 0 && (
                <div className="space-y-1 text-muted-foreground">
                  {sim.diff.reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px]">
                      <span className="text-primary font-bold">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {sim.diff.added.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Inserted Milestones ({sim.diff.added.length})
                  </span>
                  {sim.diff.added.map((m, i) => (
                    <div key={i} className="border-l-2 border-emerald-500/50 pl-2.5 py-0.5">
                      <div className="font-medium text-foreground text-[11px]">{m.phase}</div>
                      <div className="text-[10px] text-muted-foreground">{m.title}</div>
                    </div>
                  ))}
                </div>
              )}

              {sim.diff.removed.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-destructive font-medium flex items-center gap-1">
                    <Minus className="h-3 w-3" /> Pruned / Bypassed Milestones ({sim.diff.removed.length})
                  </span>
                  {sim.diff.removed.map((m, i) => (
                    <div key={i} className="border-l-2 border-destructive/50 pl-2.5 py-0.5">
                      <div className="font-medium text-foreground text-[11px]">{m.phase}</div>
                      <div className="text-[10px] text-muted-foreground">{m.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setScenario(currentPath?.scenario ?? "balanced");
                setHours(currentPath?.hoursPerWeek ?? 10);
                setSimulateFailure(false);
              }}
              className="text-xs text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to Active
            </Button>

            <Button
              size="sm"
              onClick={handleApply}
              disabled={applying || loading || !result}
              className="glow-primary text-xs"
            >
              {applying ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying Roadmap…
                </>
              ) : (
                <>
                  <Zap className="mr-1.5 h-3.5 w-3.5" /> Apply to My Active Roadmap
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
