"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLearner } from "@/hooks/use-learner";
import { api, type PathDetail } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import {
  Route as RouteIcon,
  Lock,
  PlayCircle,
  CheckCircle2,
  Clock,
  Calendar,
  Hammer,
  Zap,
  ArrowRight,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Target,
  Plus,
  Minus,
  ArrowUpDown,
  AlertTriangle,
  Sparkles,
  Sliders,
} from "lucide-react";
import { WhatIfSimulator } from "@/components/path/WhatIfSimulator";

interface DiffData {
  added: Array<{ phase: string; title: string; reason: string }>;
  removed: Array<{ phase: string; title: string; reason: string }>;
  moved: Array<{ phase: string; title: string; reason: string }>;
  keptCount: number;
  etaShiftDays: number;
  reasons: string[];
}

const STATUS_STYLE: Record<string, { border: string; badge: string; icon: React.ComponentType<{ className?: string }> }> = {
  complete: { border: "border-emerald-500/50", badge: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10", icon: CheckCircle2 },
  in_progress: { border: "border-primary", badge: "border-primary/50 text-primary bg-primary/10", icon: PlayCircle },
  available: { border: "border-amber-500/50", badge: "border-amber-500/50 text-amber-300 bg-amber-500/10", icon: PlayCircle },
  locked: { border: "border-border", badge: "border-border text-muted-foreground", icon: Lock },
};

export default function PathPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { learnerId, setLearnerId, hydrated } = useLearner();
  const [path, setPath] = useState<PathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [simHours, setSimHours] = useState<number | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!learnerId) return;
    setLoading(true);
    try {
      const res = await api.getCurrentPath(learnerId);
      setPath(res.path);
      if (res.path) setSimHours(res.path.hoursPerWeek);
    } catch (e) {
      toast({ title: "Failed to load path", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [learnerId, toast]);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("shareToken") || params.get("token") || params.get("passport") || params.get("passportId") || params.get("learner");
      if (token) {
        router.push(`/dashboard?shareToken=${token}`);
        return;
      }
    }
    if (!learnerId) {
      router.push("/onboarding");
      return;
    }
    void load();
  }, [hydrated, learnerId, router, load]);

  // Time simulator: deterministic client-side recomputation of ETAs.
  const simulated = useMemo(() => {
    if (!path || !simHours || simHours === path.hoursPerWeek) return null;
    let cursor = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const remaining = path.milestones.filter((m) => m.status !== "complete");
    let hoursLeft = 0;
    const perMilestone = remaining.map((m) => {
      const weeks = m.estimatedHours / Math.max(1, simHours);
      const durationMs = Math.max(DAY, Math.round(weeks * 7 * DAY));
      const start = new Date(cursor);
      const end = new Date(cursor + durationMs);
      cursor = end.getTime() + DAY;
      hoursLeft += m.estimatedHours;
      return { id: m.id, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    });
    const totalWeeks = Math.max(1, Math.round(hoursLeft / Math.max(1, simHours)));
    return { perMilestone, hoursLeft, totalWeeks, eta: new Date(cursor).toISOString().slice(0, 10) };
  }, [path, simHours]);

  const sendFeedback = async (kind: string) => {
    if (!learnerId || !feedbackFor) return;
    setBusy(true);
    try {
      const res = await api.sendFeedback(learnerId, feedbackFor, kind, feedbackComment || undefined);
      if (res.replanned && res.diff) {
        setDiff(res.diff);
        setDiffOpen(true);
        await load();
      } else if (res.message) {
        toast({ title: "Feedback logged", description: res.message });
      }
      setFeedbackFor(null);
      setFeedbackComment("");
    } catch (e) {
      toast({ title: "Feedback failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const changeGoal = async () => {
    if (!learnerId || !goalText.trim()) return;
    setBusy(true);
    try {
      const res = await api.changeGoal(learnerId, goalText.trim());
      toast({ title: `Goal updated — path regenerated (v${res.version})` });
      setGoalOpen(false);
      setGoalText("");
      await load();
    } catch (e) {
      toast({ title: "Goal change failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated || loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        </div>
      </AppShell>
    );
  }

  if (!path) {
    return (
      <AppShell>
        <Card className="glass-card max-w-lg mx-auto mt-16">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">No active path yet.</p>
            <Button asChild><Link href="/onboarding">Generate your roadmap</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell learnerName={null} onReset={() => { setLearnerId(null); router.push("/onboarding"); }}>
      {/* Path header */}
      <Card className="glass-card mb-4">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <RouteIcon className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold tracking-tight">
                  {path.scenario[0].toUpperCase() + path.scenario.slice(1)} roadmap
                </h1>
                <Badge variant="secondary" className="font-mono text-[10px]">v{path.version} · {path.algorithm}</Badge>
                {path.replanReason && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                    replanned: {path.replanReason.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {path.progress.completed}/{path.progress.total} phases complete · {path.progress.hoursRemaining}h remaining · {path.totalSkills} {path.totalSkills === 1 ? "skill" : "skills"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => setSimulatorOpen(true)}
              >
                <Sliders className="mr-1.5 h-3.5 w-3.5" /> What-If Simulator
              </Button>
              <Button variant="outline" size="sm" onClick={() => setGoalOpen(true)}>
                <Target className="mr-1.5 h-3.5 w-3.5" /> Change goal
              </Button>
            </div>
          </div>
          <Progress value={path.progress.percent} className="h-1.5 mt-4" />
        </CardContent>
      </Card>

      {/* Shallow goal notice */}
      {path.milestones.length <= 1 && (
        <Card className="glass-card mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                <strong>Foundational Goal:</strong> Your chosen goal is a fundamental building block with no prior prerequisites in the graph. For a richer multi-phase curriculum, consider switching to an advanced specialization or selecting the <strong>Exploratory</strong> scenario.
              </span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0" onClick={() => setGoalOpen(true)}>
              Expand Goal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Time simulator */}
      <Card className="glass-card mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-[220px]">
              <input
                type="range"
                min={2}
                max={40}
                value={simHours ?? path.hoursPerWeek}
                onChange={(e) => setSimHours(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
            <span className="text-sm font-medium w-24">{simHours ?? path.hoursPerWeek} h/week</span>
            <div className="text-xs text-muted-foreground">
              {simulated ? (
                <>
                  At this pace: <span className="text-primary font-medium">~{simulated.totalWeeks} weeks</span> to finish
                  {simulated.eta && <> · ETA {simulated.eta}</>}
                  <button className="ml-3 inline-flex items-center underline hover:text-foreground cursor-pointer" onClick={() => setSimHours(path.hoursPerWeek)}>reset</button>
                </>
              ) : (
                <>Drag to simulate a different weekly commitment — ETAs recompute instantly (engine math, not guesses).</>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestone timeline */}
      <div className="space-y-3">
        {path.milestones.map((m) => {
          const style = STATUS_STYLE[m.status] ?? STATUS_STYLE.locked;
          const sim = simulated?.perMilestone.find((p) => p.id === m.id);
          return (
            <Card key={m.id} className={cn("glass-card transition-colors", style.border, m.status === "in_progress" && "glow-primary")}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <style.icon className={cn("h-4 w-4 shrink-0", m.status === "complete" ? "text-emerald-400" : m.status === "in_progress" ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm font-semibold">{m.phase}</span>
                      <Badge variant="outline" className={cn("text-[10px]", style.badge)}>{m.status.replace("_", " ")}</Badge>
                      {m.hasProject && (
                        <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-300 bg-violet-500/10">
                          <Hammer className="mr-1 h-2.5 w-2.5" /> project
                        </Badge>
                      )}
                      {m.phase.toLowerCase().includes("remediation") && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300 bg-amber-500/10">
                          <AlertTriangle className="mr-1 h-2.5 w-2.5 text-amber-400" /> Remediation (Quiz Refresher)
                        </Badge>
                      )}
                      {m.phase.toLowerCase().includes("consolidation") && (
                        <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300 bg-blue-500/10">
                          <Sparkles className="mr-1 h-2.5 w-2.5 text-blue-400" /> Consolidation (Pace Tuned)
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1.5 leading-snug">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{m.estimatedHours}h</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {sim ? `${sim.start} → ${sim.end}` : m.targetEndAt ? `target ${m.targetEndAt.slice(0, 10)}` : "unscheduled"}
                      </span>
                      <span>{m.skillNames.length} {m.skillNames.length === 1 ? "skill" : "skills"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(m.status === "available" || m.status === "in_progress") && (
                      <Button size="sm" asChild>
                        <Link href={`/milestone/${m.id}`}>
                          {m.status === "available" ? "Start" : "Continue"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                    {m.status === "complete" && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/milestone/${m.id}`}>Review</Link>
                      </Button>
                    )}
                    {(m.status === "in_progress" || m.status === "available") && (
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setFeedbackFor(m.id)} title="Pace feedback">
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feedback dialog */}
      <Dialog open={feedbackFor !== null} onOpenChange={(o) => !o && setFeedbackFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How&apos;s the pace?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This triggers a real replan — the engine regenerates the roadmap and shows you a diff.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => sendFeedback("too_hard")}>
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Too hard — lighten it
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => sendFeedback("too_easy")}>
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Too easy — stretch me
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => sendFeedback("too_theoretical")}>
              Too theoretical
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => sendFeedback("not_relevant")}>
              Not relevant
            </Button>
          </div>
          <Textarea
            placeholder="Optional: what specifically? (feeds the replan rationale)"
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            className="text-sm min-h-[60px]"
          />
          {busy && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Replanning…</p>}
        </DialogContent>
      </Dialog>

      {/* Diff dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto thin-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" /> Roadmap updated
            </DialogTitle>
          </DialogHeader>
          {diff && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-secondary/60 p-3 text-xs">
                {diff.reasons.map((r, i) => <p key={i} className="leading-relaxed">{r}</p>)}
                <p className="mt-2 text-muted-foreground">
                  {diff.keptCount} phases kept · ETA shift {diff.etaShiftDays >= 0 ? "+" : ""}{diff.etaShiftDays} days
                </p>
              </div>
              {diff.added.length > 0 && (
                <div>
                  <p className="font-medium flex items-center gap-1.5 text-emerald-300 mb-1.5"><Plus className="h-3.5 w-3.5" /> Added</p>
                  {diff.added.map((a, i) => (
                    <div key={i} className="border-l-2 border-emerald-500/50 pl-3 py-1 mb-1.5">
                      <p className="text-xs font-medium">{a.phase} — {a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{a.reason}</p>
                    </div>
                  ))}
                </div>
              )}
              {diff.removed.length > 0 && (
                <div>
                  <p className="font-medium flex items-center gap-1.5 text-destructive mb-1.5"><Minus className="h-3.5 w-3.5" /> Removed</p>
                  {diff.removed.map((a, i) => (
                    <div key={i} className="border-l-2 border-destructive/50 pl-3 py-1 mb-1.5">
                      <p className="text-xs font-medium">{a.phase} — {a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{a.reason}</p>
                    </div>
                  ))}
                </div>
              )}
              {diff.moved.length > 0 && (
                <div>
                  <p className="font-medium flex items-center gap-1.5 text-amber-300 mb-1.5"><ArrowUpDown className="h-3.5 w-3.5" /> Reordered</p>
                  {diff.moved.map((a, i) => (
                    <div key={i} className="border-l-2 border-amber-500/50 pl-3 py-1 mb-1.5">
                      <p className="text-xs font-medium">{a.phase} — {a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{a.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Goal change dialog */}
      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change your goal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The roadmap regenerates from the new target — completed milestones are preserved, everything else is re-derived.
          </p>
          <Input
            placeholder='e.g. "become a backend engineer" or "machine learning"'
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && changeGoal()}
          />
          <Button onClick={changeGoal} disabled={busy || !goalText.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
            Regenerate roadmap
          </Button>
        </DialogContent>
      </Dialog>

      {/* What-If Replan Simulator Drawer */}
      <WhatIfSimulator
        open={simulatorOpen}
        onOpenChange={setSimulatorOpen}
        learnerId={learnerId ?? ""}
        currentPath={path}
        onApplied={() => void load()}
      />
    </AppShell>
  );
}
